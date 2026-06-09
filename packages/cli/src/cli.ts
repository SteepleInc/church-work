import { api } from "@church-task/backend/convex/_generated/api";
import type {
  CoreWorkBatchReadArgs,
  CoreWorkBatchReadResponse,
  CoreWorkBatchWriteArgs,
  CoreWorkBatchWriteResponse,
} from "@church-task/backend/agent/coreWorkOperations";
import type {
  ActiveChurchResponse,
  CurrentUserResponse,
} from "@church-task/backend/agent/operations";
import { ConvexHttpClient } from "convex/browser";
import { Context, Data, Effect, Layer } from "effect";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { SpanStatusCode } from "@opentelemetry/api";

import { cliCommandCounter, cliCommandDuration, cliLogger, cliTracer } from "./telemetry";

export type CliEnv = Record<string, string | undefined>;

export type CliResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

type HealthStatus = "OK";
type CliError =
  | BackendError
  | CredentialStorageError
  | MissingBackendConfigError
  | MissingLoginTokenError
  | MissingOptionError
  | UnknownCommandError;

export type CliCredential = {
  readonly id: string;
  readonly name: string;
  readonly token: string;
  readonly start?: string | null;
  readonly createdAt?: string | Date;
};

export type BackendClientService = {
  readonly healthCheck: Effect.Effect<HealthStatus, BackendError>;
  readonly currentUser: Effect.Effect<CurrentUserResponse, BackendError>;
  readonly currentUserWithToken: (
    token: string,
  ) => Effect.Effect<CurrentUserResponse, BackendError>;
  readonly activeChurch: (
    churchId: string | null,
  ) => Effect.Effect<ActiveChurchResponse, BackendError>;
  readonly activeChurchWithToken: (args: {
    readonly token: string;
    readonly churchId: string | null;
  }) => Effect.Effect<ActiveChurchResponse, BackendError>;
  readonly createCliCredential: (args: {
    readonly name: string;
    readonly sessionToken: string;
  }) => Effect.Effect<CliCredential, BackendError>;
  readonly revokeCliCredential: (args: {
    readonly credentialId: string;
    readonly token: string;
  }) => Effect.Effect<{ readonly revoked: boolean }, BackendError>;
  readonly setupBatchRead: (args: {
    readonly token: string;
    readonly operations: CoreWorkBatchReadArgs["operations"];
  }) => Effect.Effect<CoreWorkBatchReadResponse, BackendError>;
  readonly setupBatchWrite: (args: {
    readonly token: string;
    readonly operations: CoreWorkBatchWriteArgs["operations"];
  }) => Effect.Effect<CoreWorkBatchWriteResponse, BackendError>;
  readonly taskTool: (args: {
    readonly token: string;
    readonly tool: string;
    readonly body: Record<string, unknown>;
  }) => Effect.Effect<Record<string, unknown> & { readonly ok?: boolean }, BackendError>;
};

export type CredentialStorageService = {
  readonly read: Effect.Effect<CliCredential | null, CredentialStorageError>;
  readonly write: (credential: CliCredential) => Effect.Effect<void, CredentialStorageError>;
  readonly remove: Effect.Effect<void, CredentialStorageError>;
};

export class BackendError extends Data.TaggedError("BackendError")<{
  readonly cause: unknown;
}> {}

export class CredentialStorageError extends Data.TaggedError("CredentialStorageError")<{
  readonly cause: unknown;
}> {}

class MissingBackendConfigError extends Data.TaggedError("MissingBackendConfigError")<{}> {}

class MissingLoginTokenError extends Data.TaggedError("MissingLoginTokenError")<{}> {}

class MissingOptionError extends Data.TaggedError("MissingOptionError")<{
  readonly option: string;
}> {}

class UnknownCommandError extends Data.TaggedError("UnknownCommandError")<{
  readonly command: string | undefined;
}> {}

export class BackendClient extends Context.Tag("@church-task/cli/BackendClient")<
  BackendClient,
  BackendClientService
>() {}

export class CredentialStorage extends Context.Tag("@church-task/cli/CredentialStorage")<
  CredentialStorage,
  CredentialStorageService
>() {}

const readBackendUrl = (env: CliEnv) =>
  Effect.sync(() => env.CHURCH_TASK_CONVEX_URL?.trim()).pipe(
    Effect.flatMap((url) =>
      url ? Effect.succeed(url) : Effect.fail(new MissingBackendConfigError()),
    ),
  );

const authBaseUrlFromEnv = (env: CliEnv) =>
  Effect.sync(() => {
    const explicitUrl = env.CHURCH_TASK_SITE_URL?.trim();
    if (explicitUrl) return explicitUrl.replace(/\/$/, "");

    const convexUrl = env.CHURCH_TASK_CONVEX_URL?.trim();
    return convexUrl?.endsWith(".convex.cloud")
      ? convexUrl.replace(/\.convex\.cloud$/, ".convex.site")
      : undefined;
  }).pipe(
    Effect.flatMap((url) =>
      url ? Effect.succeed(url) : Effect.fail(new MissingBackendConfigError()),
    ),
  );

const credentialPathFromEnv = (env: CliEnv) =>
  env.CHURCH_TASK_CREDENTIAL_FILE?.trim() ??
  join(env.HOME ?? ".", ".church-task", "credential.json");

const makeFileCredentialStorageLayer = (env: CliEnv) =>
  Layer.succeed(CredentialStorage, {
    read: Effect.tryPromise({
      try: async () => {
        const path = credentialPathFromEnv(env);
        try {
          return JSON.parse(await readFile(path, "utf8")) as CliCredential;
        } catch (cause) {
          if ((cause as { code?: string }).code === "ENOENT") return null;
          throw cause;
        }
      },
      catch: (cause) => new CredentialStorageError({ cause }),
    }),
    write: (credential) =>
      Effect.tryPromise({
        try: async () => {
          const path = credentialPathFromEnv(env);
          await mkdir(dirname(path), { recursive: true, mode: 0o700 });
          await writeFile(path, `${JSON.stringify(credential)}\n`, { mode: 0o600 });
        },
        catch: (cause) => new CredentialStorageError({ cause }),
      }),
    remove: Effect.tryPromise({
      try: async () => {
        const path = credentialPathFromEnv(env);
        try {
          await unlink(path);
        } catch (cause) {
          if ((cause as { code?: string }).code === "ENOENT") return;
          throw cause;
        }
      },
      catch: (cause) => new CredentialStorageError({ cause }),
    }),
  });

const makeConvexBackendLayer = (env: CliEnv) =>
  Layer.effect(
    BackendClient,
    Effect.gen(function* () {
      const convexUrl = yield* readBackendUrl(env);
      const authBaseUrl = yield* authBaseUrlFromEnv(env);
      const client = new ConvexHttpClient(convexUrl, { logger: false });

      const queryCurrentUserWithToken = (token: string) =>
        Effect.tryPromise({
          try: async () => {
            const response = await fetch(`${authBaseUrl}/api/auth/convex/token`, {
              method: "GET",
              headers: { authorization: `Bearer ${token}` },
            });

            if (!response.ok) throw new Error("Convex auth token request failed.");

            const body = (await response.json()) as { token?: string };
            if (!body.token) throw new Error("Convex auth token response was missing a token.");

            client.setAuth(body.token);
            return await client.query(api.agent.currentUser);
          },
          catch: (cause) => new BackendError({ cause }),
        });

      const queryActiveChurch = (churchId: string | null) =>
        Effect.tryPromise({
          try: () => client.query(api.agent.activeChurch, { churchId }),
          catch: (cause) => new BackendError({ cause }),
        });

      const queryActiveChurchWithToken = (args: {
        readonly token: string;
        readonly churchId: string | null;
      }) =>
        Effect.tryPromise({
          try: async () => {
            const response = await fetch(`${authBaseUrl}/api/auth/convex/token`, {
              method: "GET",
              headers: { authorization: `Bearer ${args.token}` },
            });

            if (!response.ok) throw new Error("Convex auth token request failed.");

            const body = (await response.json()) as { token?: string };
            if (!body.token) throw new Error("Convex auth token response was missing a token.");

            client.setAuth(body.token);
            return await client.query(api.agent.activeChurch, { churchId: args.churchId });
          },
          catch: (cause) => new BackendError({ cause }),
        });

      return {
        healthCheck: Effect.tryPromise({
          try: () => client.query(api.healthCheck.get),
          catch: (cause) => new BackendError({ cause }),
        }),
        currentUser: Effect.tryPromise({
          try: () => client.query(api.agent.currentUser),
          catch: (cause) => new BackendError({ cause }),
        }),
        currentUserWithToken: queryCurrentUserWithToken,
        activeChurch: queryActiveChurch,
        activeChurchWithToken: queryActiveChurchWithToken,
        createCliCredential: ({ name, sessionToken }) =>
          Effect.tryPromise({
            try: async () => {
              const response = await fetch(`${authBaseUrl}/api/auth/api-key/create`, {
                method: "POST",
                headers: {
                  authorization: `Bearer ${sessionToken}`,
                  "content-type": "application/json",
                },
                body: JSON.stringify({ name }),
              });

              if (!response.ok) throw new Error("CLI credential creation failed.");

              const body = (await response.json()) as {
                id: string;
                name: string;
                key: string;
                start?: string | null;
                createdAt?: string | Date;
              };

              return {
                id: body.id,
                name: body.name,
                token: body.key,
                start: body.start,
                createdAt: body.createdAt,
              };
            },
            catch: (cause) => new BackendError({ cause }),
          }),
        revokeCliCredential: ({ credentialId, token }) =>
          Effect.tryPromise({
            try: async () => {
              const response = await fetch(`${authBaseUrl}/api/auth/api-key/delete`, {
                method: "POST",
                headers: {
                  authorization: `Bearer ${token}`,
                  "content-type": "application/json",
                },
                body: JSON.stringify({ keyId: credentialId }),
              });

              if (!response.ok) throw new Error("CLI credential revocation failed.");

              const body = (await response.json()) as { success?: boolean };
              return { revoked: body.success === true };
            },
            catch: (cause) => new BackendError({ cause }),
          }),
        setupBatchRead: ({ token, operations }) =>
          Effect.tryPromise({
            try: async () => {
              const response = await fetch(`${authBaseUrl}/api/auth/convex/token`, {
                method: "GET",
                headers: { authorization: `Bearer ${token}` },
              });

              if (!response.ok) throw new Error("Convex auth token request failed.");

              const body = (await response.json()) as { token?: string };
              if (!body.token) throw new Error("Convex auth token response was missing a token.");

              client.setAuth(body.token);
              return await client.query(api.coreWork.batchRead, { operations });
            },
            catch: (cause) => new BackendError({ cause }),
          }),
        setupBatchWrite: ({ token, operations }) =>
          Effect.tryPromise({
            try: async () => {
              const response = await fetch(`${authBaseUrl}/api/auth/convex/token`, {
                method: "GET",
                headers: { authorization: `Bearer ${token}` },
              });

              if (!response.ok) throw new Error("Convex auth token request failed.");

              const body = (await response.json()) as { token?: string };
              if (!body.token) throw new Error("Convex auth token response was missing a token.");

              client.setAuth(body.token);
              return await client.mutation(api.coreWork.batchWrite, { operations });
            },
            catch: (cause) => new BackendError({ cause }),
          }),
        taskTool: ({ token, tool, body }) =>
          Effect.tryPromise({
            try: async () => {
              const response = await fetch(`${authBaseUrl}/api/mcp/tools/${tool}`, {
                method: "POST",
                headers: {
                  authorization: `Bearer ${token}`,
                  "content-type": "application/json",
                },
                body: JSON.stringify(body),
              });

              if (!response.ok) throw new Error("Task tool request failed.");

              return (await response.json()) as Record<string, unknown> & { readonly ok?: boolean };
            },
            catch: (cause) => new BackendError({ cause }),
          }),
      };
    }),
  );

const credentialNameFromArgs = (args: ReadonlyArray<string>) => {
  const nameIndex = args.indexOf("--name");
  const name = nameIndex >= 0 ? args[nameIndex + 1]?.trim() : undefined;

  return name ? Effect.succeed(name) : Effect.fail(new MissingOptionError({ option: "--name" }));
};

const jsonOptionFromArgs = (args: ReadonlyArray<string>) => {
  const jsonIndex = args.indexOf("--json");
  const json = jsonIndex >= 0 ? args[jsonIndex + 1]?.trim() : undefined;

  return json ? Effect.succeed(json) : Effect.fail(new MissingOptionError({ option: "--json" }));
};

const churchIdFromArgs = (args: ReadonlyArray<string>) => {
  const churchIdIndex = args.indexOf("--church-id");
  const churchId = churchIdIndex >= 0 ? args[churchIdIndex + 1]?.trim() : undefined;

  return churchId ?? null;
};

const optionValueFromArgs = (args: ReadonlyArray<string>, option: string) => {
  const optionIndex = args.indexOf(option);
  const value = optionIndex >= 0 ? args[optionIndex + 1]?.trim() : undefined;

  return value || undefined;
};

const requiredOptionFromArgs = (args: ReadonlyArray<string>, option: string) => {
  const value = optionValueFromArgs(args, option);

  return value ? Effect.succeed(value) : Effect.fail(new MissingOptionError({ option }));
};

const nullableIdFromArgs = (args: ReadonlyArray<string>, option: string) => {
  const value = optionValueFromArgs(args, option);
  if (value === undefined) return undefined;
  if (value === "null" || value === "none") return null;

  return value;
};

const firstDefined = <T>(...values: ReadonlyArray<T | undefined>) =>
  values.find((value) => value !== undefined);

const addOptionalValue = (
  body: Record<string, unknown>,
  key: string,
  value: string | null | undefined,
) => {
  if (value !== undefined) body[key] = value;
};

const readEnvToken = (env: CliEnv) => {
  const token = env.CHURCH_TASK_AUTH_TOKEN?.trim();
  return token ? Effect.succeed(token) : Effect.fail(new MissingLoginTokenError());
};

const readAuthToken = Effect.gen(function* () {
  const storage = yield* CredentialStorage;
  const envToken = yield* CurrentEnvToken;
  const storedCredential = envToken ? null : yield* storage.read;
  const token = envToken ?? storedCredential?.token ?? null;

  return token ? yield* Effect.succeed(token) : yield* Effect.fail(new MissingLoginTokenError());
});

const runHealth = Effect.gen(function* () {
  const backend = yield* BackendClient;
  const status = yield* backend.healthCheck;

  return success({ ok: true, operation: "health", status });
});

const runCurrentUser = Effect.gen(function* () {
  const backend = yield* BackendClient;
  const storage = yield* CredentialStorage;
  const envToken = yield* CurrentEnvToken;
  const storedCredential = envToken ? null : yield* storage.read;
  const currentUser = envToken
    ? yield* backend.currentUserWithToken(envToken)
    : storedCredential
      ? yield* backend.currentUserWithToken(storedCredential.token)
      : yield* backend.currentUser;

  return success(currentUser);
});

const runActiveChurch = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const churchId = churchIdFromArgs(args);
    const backend = yield* BackendClient;
    const storage = yield* CredentialStorage;
    const envToken = yield* CurrentEnvToken;
    const storedCredential = envToken ? null : yield* storage.read;
    const activeChurch = envToken
      ? yield* backend.activeChurchWithToken({ token: envToken, churchId })
      : storedCredential
        ? yield* backend.activeChurchWithToken({ token: storedCredential.token, churchId })
        : yield* backend.activeChurch(churchId);

    return activeChurch.ok ? success(activeChurch) : operationFailure(activeChurch);
  });

const runSetupRead = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const churchId = churchIdFromArgs(args);
    if (!churchId) return yield* Effect.fail(new MissingOptionError({ option: "--church-id" }));

    const backend = yield* BackendClient;
    const token = yield* readAuthToken;
    const includeArchived = args.includes("--include-archived");
    const operations: CoreWorkBatchReadArgs["operations"] = [
      {
        id: "teams",
        operation: "listTeams",
        input: includeArchived ? { churchId, includeArchived: true } : { churchId },
      },
      { id: "team-memberships", operation: "listTeamMemberships", input: { churchId } },
      { id: "work-defaults", operation: "readWorkDefaults", input: { churchId } },
      { id: "church-settings", operation: "readChurchSettings", input: { churchId } },
    ];

    const result = yield* backend.setupBatchRead({ token, operations });
    return success(result);
  });

const runSetupWrite = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const json = yield* jsonOptionFromArgs(args);
    const parsed = JSON.parse(json) as {
      readonly operations?: CoreWorkBatchWriteArgs["operations"];
    };
    const operations = parsed.operations ?? [];
    const backend = yield* BackendClient;
    const token = yield* readAuthToken;
    const result = yield* backend.setupBatchWrite({ token, operations });

    return success(result);
  });

const runTaskTool = (tool: string, body: Record<string, unknown>) =>
  Effect.gen(function* () {
    const backend = yield* BackendClient;
    const token = yield* readAuthToken;
    const result = yield* backend.taskTool({ token, tool, body });

    return result.ok === false
      ? operationFailure(result as { readonly ok: false; readonly error: unknown })
      : success(result);
  });

const runTaskList = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const churchId = yield* requiredOptionFromArgs(args, "--church-id");
    const body: Record<string, unknown> = { churchId };

    addOptionalValue(body, "surface", optionValueFromArgs(args, "--surface"));
    addOptionalValue(body, "cycleId", optionValueFromArgs(args, "--cycle-id"));
    addOptionalValue(body, "teamId", nullableIdFromArgs(args, "--team-id"));
    addOptionalValue(
      body,
      "assignedUserId",
      firstDefined(
        nullableIdFromArgs(args, "--assigned-user-id"),
        nullableIdFromArgs(args, "--assignee-id"),
      ),
    );
    addOptionalValue(body, "workflowStatusId", optionValueFromArgs(args, "--workflow-status-id"));
    addOptionalValue(body, "taskState", optionValueFromArgs(args, "--task-state"));

    return yield* runTaskTool("list-tasks", body);
  });

const runTaskGet = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    return yield* runTaskTool("get-task", {
      churchId: yield* requiredOptionFromArgs(args, "--church-id"),
      taskId: yield* requiredOptionFromArgs(args, "--task-id"),
    });
  });

const runTaskCreate = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const body: Record<string, unknown> = {
      churchId: yield* requiredOptionFromArgs(args, "--church-id"),
      title: yield* requiredOptionFromArgs(args, "--title"),
      workflowStatusId: yield* requiredOptionFromArgs(args, "--workflow-status-id"),
      dueDate: yield* requiredOptionFromArgs(args, "--due-date"),
    };

    addOptionalValue(body, "teamId", nullableIdFromArgs(args, "--team-id"));
    addOptionalValue(body, "assignedUserId", nullableIdFromArgs(args, "--assigned-user-id"));
    addOptionalValue(body, "parentTaskId", nullableIdFromArgs(args, "--parent-task-id"));

    return yield* runTaskTool("create-task", body);
  });

const runTaskUpdate = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const body: Record<string, unknown> = {
      churchId: yield* requiredOptionFromArgs(args, "--church-id"),
      taskId: yield* requiredOptionFromArgs(args, "--task-id"),
    };

    addOptionalValue(body, "title", optionValueFromArgs(args, "--title"));
    addOptionalValue(body, "workflowStatusId", optionValueFromArgs(args, "--workflow-status-id"));
    addOptionalValue(body, "dueDate", optionValueFromArgs(args, "--due-date"));
    addOptionalValue(body, "cycleId", optionValueFromArgs(args, "--cycle-id"));

    if (args.includes("--unassign-user")) {
      body.assignedUserId = null;
    } else {
      addOptionalValue(body, "assignedUserId", nullableIdFromArgs(args, "--assigned-user-id"));
    }

    if (args.includes("--unassign-team")) {
      body.teamId = null;
    } else {
      addOptionalValue(body, "teamId", nullableIdFromArgs(args, "--team-id"));
    }

    if (args.includes("--clear-parent")) {
      body.parentTaskId = null;
    } else {
      addOptionalValue(body, "parentTaskId", nullableIdFromArgs(args, "--parent-task-id"));
    }

    return yield* runTaskTool("update-task", body);
  });

const runTaskTransition = (tool: string, args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    return yield* runTaskTool(tool, {
      churchId: yield* requiredOptionFromArgs(args, "--church-id"),
      taskId: yield* requiredOptionFromArgs(args, "--task-id"),
    });
  });

const runLookup = (lookup: string | undefined, args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const churchId = yield* requiredOptionFromArgs(args, "--church-id");
    const body: Record<string, unknown> = { churchId };
    if (lookup === "workflow-statuses") {
      addOptionalValue(body, "workflowId", optionValueFromArgs(args, "--workflow-id"));
    }

    switch (lookup) {
      case "users":
        return yield* runTaskTool("list-users", body);
      case "teams":
        return yield* runTaskTool("list-teams", body);
      case "cycles":
        return yield* runTaskTool("list-cycles", body);
      case "workflow-statuses":
        return yield* runTaskTool("list-workflow-statuses", body);
      default:
        return yield* Effect.fail(new UnknownCommandError({ command: lookup }));
    }
  });

const safeCredentialMetadata = (credential: CliCredential) => ({
  id: credential.id,
  name: credential.name,
  start: credential.start ?? null,
  ...(credential.createdAt ? { createdAt: credential.createdAt } : {}),
});

const runAuthStatus = Effect.gen(function* () {
  const backend = yield* BackendClient;
  const storage = yield* CredentialStorage;
  const envToken = yield* CurrentEnvToken;

  if (envToken) {
    const currentUser = yield* backend.currentUserWithToken(envToken);
    return success({
      ok: true,
      operation: "authStatus",
      authenticated: currentUser.data.user !== null,
      user: currentUser.data.user,
      credential: { source: "environment" },
    });
  }

  const credential = yield* storage.read;
  if (!credential) {
    return success({
      ok: true,
      operation: "authStatus",
      authenticated: false,
      user: null,
      credential: null,
    });
  }

  const currentUser = yield* backend.currentUserWithToken(credential.token);

  return success({
    ok: true,
    operation: "authStatus",
    authenticated: currentUser.data.user !== null,
    user: currentUser.data.user,
    credential: {
      source: "local",
      ...safeCredentialMetadata(credential),
    },
  });
});

const runLogout = Effect.gen(function* () {
  const backend = yield* BackendClient;
  const storage = yield* CredentialStorage;
  const credential = yield* storage.read;

  if (!credential) {
    yield* storage.remove;
    return success({ ok: true, operation: "logout", revoked: false, credential: null });
  }

  const revokeResult = yield* backend.revokeCliCredential({
    credentialId: credential.id,
    token: credential.token,
  });
  yield* storage.remove;

  return success({
    ok: true,
    operation: "logout",
    revoked: revokeResult.revoked,
    credential: safeCredentialMetadata(credential),
  });
});

class CurrentEnvToken extends Context.Tag("@church-task/cli/CurrentEnvToken")<
  CurrentEnvToken,
  string | null
>() {}

const runLogin = (args: ReadonlyArray<string>, env: CliEnv) =>
  Effect.gen(function* () {
    const name = yield* credentialNameFromArgs(args);
    const sessionToken = yield* readEnvToken(env);
    const backend = yield* BackendClient;
    const storage = yield* CredentialStorage;
    const credential = yield* backend.createCliCredential({ name, sessionToken });

    yield* storage.write(credential);

    return success({
      ok: true,
      operation: "login",
      credential: {
        id: credential.id,
        name: credential.name,
        start: credential.start ?? null,
      },
    });
  });

const runCliEffect = (
  args: ReadonlyArray<string>,
  env: CliEnv,
): Effect.Effect<
  CliResult,
  | BackendError
  | CredentialStorageError
  | MissingLoginTokenError
  | MissingOptionError
  | UnknownCommandError,
  BackendClient | CredentialStorage | CurrentEnvToken
> => {
  const command = args[0];

  if (command === "login") {
    return runLogin(args.slice(1), env);
  }

  if (command === "health") {
    return runHealth;
  }

  if (command === "current-user") {
    return runCurrentUser;
  }

  if (command === "active-church") {
    return runActiveChurch(args.slice(1));
  }

  if (command === "setup" && args[1] === "read") {
    return runSetupRead(args.slice(2));
  }

  if (command === "setup" && args[1] === "write") {
    return runSetupWrite(args.slice(2));
  }

  if (command === "task" && args[1] === "list") {
    return runTaskList(args.slice(2));
  }

  if (command === "task" && args[1] === "get") {
    return runTaskGet(args.slice(2));
  }

  if (command === "task" && args[1] === "create") {
    return runTaskCreate(args.slice(2));
  }

  if (command === "task" && args[1] === "update") {
    return runTaskUpdate(args.slice(2));
  }

  if (command === "task" && args[1] === "complete") {
    return runTaskTransition("complete-task", args.slice(2));
  }

  if (command === "task" && args[1] === "cancel") {
    return runTaskTransition("cancel-task", args.slice(2));
  }

  if (command === "task" && args[1] === "reopen") {
    return runTaskTransition("reopen-task", args.slice(2));
  }

  if (command === "lookup") {
    return runLookup(args[1], args.slice(2));
  }

  if (command === "auth" && args[1] === "status") {
    return runAuthStatus;
  }

  if (command === "auth" && args[1] === "logout") {
    return runLogout;
  }

  return Effect.fail(new UnknownCommandError({ command }));
};

const success = (body: unknown): CliResult => ({
  exitCode: 0,
  stdout: `${JSON.stringify(body)}\n`,
  stderr: "",
});

const failure = (error: { readonly code: string; readonly message: string }): CliResult => ({
  exitCode: 1,
  stdout: "",
  stderr: `${JSON.stringify({ ok: false, error })}\n`,
});

const operationFailure = (body: { readonly ok: false; readonly error: unknown }): CliResult => ({
  exitCode: 1,
  stdout: "",
  stderr: `${JSON.stringify(body)}\n`,
});

const formatError = (error: CliError) => {
  switch (error._tag) {
    case "BackendError":
      return failure({
        code: "backend_unavailable",
        message: "Backend operation failed.",
      });
    case "CredentialStorageError":
      return failure({
        code: "credential_storage_failed",
        message: "Credential storage failed.",
      });
    case "MissingBackendConfigError":
      return failure({
        code: "missing_backend_config",
        message: "Set CHURCH_TASK_CONVEX_URL to your Convex deployment URL.",
      });
    case "MissingLoginTokenError":
      return failure({
        code: "missing_login_token",
        message: "Set CHURCH_TASK_AUTH_TOKEN to create a named CLI credential.",
      });
    case "MissingOptionError":
      return failure({
        code: "missing_option",
        message: `Provide ${error.option}.`,
      });
    case "UnknownCommandError":
      return failure({
        code: "unknown_command",
        message:
          "Run `church-task health`, `church-task login --name <name>`, `church-task current-user`, `church-task active-church`, `church-task setup read --church-id <id>`, `church-task setup write --json <batch>`, `church-task task <list|get|create|update|complete|cancel|reopen>`, `church-task lookup <users|teams|cycles|workflow-statuses>`, `church-task auth status`, or `church-task auth logout`.",
      });
  }
};

export const runCli = (
  args: ReadonlyArray<string>,
  options: {
    readonly env: CliEnv;
    readonly backendLayer?: Layer.Layer<BackendClient, never>;
    readonly credentialStorageLayer?: Layer.Layer<CredentialStorage, never>;
  },
): Promise<CliResult> => {
  const command = options.env.npm_lifecycle_event ?? args[0] ?? "unknown";
  const startedAt = performance.now();

  const backendLayer = options.backendLayer ?? makeConvexBackendLayer(options.env);
  const credentialStorageLayer =
    options.credentialStorageLayer ?? makeFileCredentialStorageLayer(options.env);
  const currentEnvTokenLayer = Layer.succeed(
    CurrentEnvToken,
    options.env.CHURCH_TASK_AUTH_TOKEN?.trim() || null,
  );
  const layer = Layer.mergeAll(backendLayer, credentialStorageLayer, currentEnvTokenLayer);
  const program: Effect.Effect<CliResult, CliError, never> = runCliEffect(args, options.env).pipe(
    Effect.provide(layer),
  );

  return cliTracer.startActiveSpan("cli.command", async (span) => {
    span.setAttributes({ "cli.command": command });

    try {
      const result = await Effect.runPromise(
        program.pipe(Effect.catchAll((error) => Effect.succeed(formatError(error)))),
      );
      const outcome = result.exitCode === 0 ? "success" : "failure";
      cliCommandCounter.add(1, { command, outcome });
      cliCommandDuration.record(performance.now() - startedAt, { command, outcome });
      cliLogger.emit({
        severityText: result.exitCode === 0 ? "INFO" : "ERROR",
        body: "CLI command completed",
        attributes: { command, outcome, exitCode: result.exitCode },
      });
      span.setAttributes({ "cli.outcome": outcome, "cli.exit_code": result.exitCode });
      if (result.exitCode !== 0) span.setStatus({ code: SpanStatusCode.ERROR });

      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      cliLogger.emit({
        severityText: "ERROR",
        body: "CLI command failed before result formatting",
        attributes: { command },
      });
      throw error;
    } finally {
      span.end();
    }
  });
};
