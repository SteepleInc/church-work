import type {
  CoreWorkBatchReadArgs,
  CoreWorkBatchReadResponse,
  CoreWorkBatchWriteArgs,
  CoreWorkBatchWriteResponse,
  ActiveChurchResponse,
  CurrentUserResponse,
} from "@church-work/domain";
import { activeChurchAuthenticationRequiredResponse } from "@church-work/domain";
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

export class BackendClient extends Context.Service<BackendClient, BackendClientService>()(
  "@church-work/cli/BackendClient",
) {}

export class CredentialStorage extends Context.Service<
  CredentialStorage,
  CredentialStorageService
>()("@church-work/cli/CredentialStorage") {}

const readBackendUrl = (env: CliEnv) =>
  Effect.sync(() => env.CHURCH_WORK_API_URL?.trim() ?? env.CHURCH_WORK_SITE_URL?.trim()).pipe(
    Effect.flatMap((url) =>
      url ? Effect.succeed(url.replace(/\/$/, "")) : Effect.fail(new MissingBackendConfigError()),
    ),
  );

const credentialPathFromEnv = (env: CliEnv) =>
  env.CHURCH_WORK_CREDENTIAL_FILE?.trim() ??
  join(env.HOME ?? ".", ".church-work", "credential.json");

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

const fetchJson = <ResponseBody>(args: {
  readonly body?: unknown;
  readonly method: "GET" | "POST";
  readonly token?: string;
  readonly url: string;
}) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(args.url, {
        body: args.body === undefined ? undefined : JSON.stringify(args.body),
        headers: {
          ...(args.body === undefined ? {} : { "content-type": "application/json" }),
          ...(args.token ? { authorization: `Bearer ${args.token}` } : {}),
        },
        method: args.method,
      });

      if (!response.ok) throw new Error(`Backend request failed with ${response.status}.`);
      return (await response.json()) as ResponseBody;
    },
    catch: (cause) => new BackendError({ cause }),
  });

const makeHttpBackendLayer = (env: CliEnv) =>
  Layer.effect(
    BackendClient,
    Effect.gen(function* () {
      const baseUrl = yield* readBackendUrl(env);

      return {
        healthCheck: fetchJson<{ readonly ok: true; readonly service: string }>({
          method: "GET",
          url: `${baseUrl}/api/tracer`,
        }).pipe(Effect.as("OK" as const)),
        currentUser: fetchJson<CurrentUserResponse>({
          method: "GET",
          url: `${baseUrl}/api/agent/current-user`,
        }),
        currentUserWithToken: (token) =>
          fetchJson<CurrentUserResponse>({
            method: "GET",
            token,
            url: `${baseUrl}/api/agent/current-user`,
          }),
        activeChurch: (churchId) =>
          fetchJson<ActiveChurchResponse>({
            body: { churchId },
            method: "POST",
            url: `${baseUrl}/api/agent/active-church`,
          }),
        activeChurchWithToken: ({ churchId, token }) =>
          fetchJson<ActiveChurchResponse>({
            body: { churchId },
            method: "POST",
            token,
            url: `${baseUrl}/api/agent/active-church`,
          }),
        createCliCredential: ({ name, sessionToken }) =>
          fetchJson<{
            readonly createdAt?: string | Date;
            readonly id: string;
            readonly key: string;
            readonly name: string;
            readonly start?: string | null;
          }>({
            body: { name },
            method: "POST",
            token: sessionToken,
            url: `${baseUrl}/api/auth/api-key/create`,
          }).pipe(
            Effect.map((body) => ({
              createdAt: body.createdAt,
              id: body.id,
              name: body.name,
              start: body.start,
              token: body.key,
            })),
          ),
        revokeCliCredential: ({ credentialId, token }) =>
          fetchJson<{ readonly success?: boolean }>({
            body: { keyId: credentialId },
            method: "POST",
            token,
            url: `${baseUrl}/api/auth/api-key/delete`,
          }).pipe(Effect.map((body) => ({ revoked: body.success === true }))),
        setupBatchRead: ({ token, operations }) =>
          fetchJson<CoreWorkBatchReadResponse>({
            body: { operations },
            method: "POST",
            token,
            url: `${baseUrl}/api/agent/core-work/batch-read`,
          }),
        setupBatchWrite: ({ token, operations }) =>
          fetchJson<CoreWorkBatchWriteResponse>({
            body: { operations },
            method: "POST",
            token,
            url: `${baseUrl}/api/agent/core-work/batch-write`,
          }),
        taskTool: ({ token, tool, body }) =>
          fetchJson<Record<string, unknown> & { readonly ok?: boolean }>({
            body,
            method: "POST",
            token,
            url: `${baseUrl}/api/mcp/tools/${tool}`,
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

const numberOptionFromArgs = (args: ReadonlyArray<string>, option: string) => {
  const value = optionValueFromArgs(args, option);
  return value === undefined ? undefined : Number(value);
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

const addTaskReference = (
  body: Record<string, unknown>,
  args: ReadonlyArray<string>,
): Effect.Effect<void, MissingOptionError> =>
  Effect.gen(function* () {
    const taskIdentifier = optionValueFromArgs(args, "--task-identifier");
    if (taskIdentifier !== undefined) {
      body.taskIdentifier = taskIdentifier;
      return;
    }

    body.taskId = yield* requiredOptionFromArgs(args, "--task-id");
  });

const readEnvToken = (env: CliEnv) => {
  const token = env.CHURCH_WORK_AUTH_TOKEN?.trim();
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
    const token = envToken ?? storedCredential?.token ?? null;
    if (!token) return operationFailure(activeChurchAuthenticationRequiredResponse());

    const activeChurch = yield* backend.activeChurchWithToken({ token, churchId });

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

const runMcpCall = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const tool = args[0];
    if (!tool) return yield* Effect.fail(new MissingOptionError({ option: "tool" }));
    const json = yield* jsonOptionFromArgs(args.slice(1));
    return yield* runTaskTool(tool, JSON.parse(json) as Record<string, unknown>);
  });

const runJsonBackedTaskTool = (tool: string, args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const json = yield* jsonOptionFromArgs(args);
    return yield* runTaskTool(tool, JSON.parse(json) as Record<string, unknown>);
  });

const runIdBackedTaskTool = (
  tool: string,
  idOption: string,
  idKey: string,
  args: ReadonlyArray<string>,
) =>
  Effect.gen(function* () {
    const body: Record<string, unknown> = {
      churchId: yield* requiredOptionFromArgs(args, "--church-id"),
      [idKey]: yield* requiredOptionFromArgs(args, idOption),
    };
    return yield* runTaskTool(tool, body);
  });

const runChurchScopedTaskTool = (tool: string, args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    return yield* runTaskTool(tool, {
      churchId: yield* requiredOptionFromArgs(args, "--church-id"),
    });
  });

const runTemplateCreateWeeklyService = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const body: Record<string, unknown> = {
      churchId: yield* requiredOptionFromArgs(args, "--church-id"),
      name: yield* requiredOptionFromArgs(args, "--name"),
      teamId: yield* requiredOptionFromArgs(args, "--team-id"),
      startDate: yield* requiredOptionFromArgs(args, "--start-date"),
      weekday: numberOptionFromArgs(args, "--weekday") ?? 6,
    };
    addOptionalValue(body, "key", optionValueFromArgs(args, "--key"));
    addOptionalValue(body, "scheduleName", optionValueFromArgs(args, "--schedule-name"));
    return yield* runTaskTool("template-create-weekly-service", body);
  });

const runTemplateTaskAddAtPlacement = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const body: Record<string, unknown> = {
      churchId: yield* requiredOptionFromArgs(args, "--church-id"),
      templateId: yield* requiredOptionFromArgs(args, "--template-id"),
      teamId: yield* requiredOptionFromArgs(args, "--team-id"),
      title: yield* requiredOptionFromArgs(args, "--title"),
      cycleOffset: numberOptionFromArgs(args, "--cycle-offset") ?? 0,
      weekday: numberOptionFromArgs(args, "--weekday") ?? 6,
    };
    addOptionalValue(body, "description", optionValueFromArgs(args, "--description"));
    addOptionalValue(body, "assignedUserId", nullableIdFromArgs(args, "--assigned-user-id"));
    addOptionalValue(body, "estimate", nullableIdFromArgs(args, "--estimate"));
    addOptionalValue(body, "priority", nullableIdFromArgs(args, "--priority"));
    return yield* runTaskTool("template-task-add-at-placement", body);
  });

const runTaskList = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const churchId = yield* requiredOptionFromArgs(args, "--church-id");
    const body: Record<string, unknown> = { churchId };

    addOptionalValue(body, "surface", optionValueFromArgs(args, "--surface"));
    addOptionalValue(body, "cycleId", optionValueFromArgs(args, "--cycle-id"));
    addOptionalValue(body, "teamId", optionValueFromArgs(args, "--team-id"));
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
    addOptionalValue(body, "priority", nullableIdFromArgs(args, "--priority"));

    return yield* runTaskTool("list-tasks", body);
  });

const runTaskGet = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const body: Record<string, unknown> = {
      churchId: yield* requiredOptionFromArgs(args, "--church-id"),
    };
    yield* addTaskReference(body, args);

    return yield* runTaskTool("get-task", body);
  });

const runTaskCreate = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const body: Record<string, unknown> = {
      churchId: yield* requiredOptionFromArgs(args, "--church-id"),
      title: yield* requiredOptionFromArgs(args, "--title"),
      // Every Task belongs to exactly one Team (ADR 0013).
      teamId: yield* requiredOptionFromArgs(args, "--team-id"),
      workflowStatusId: yield* requiredOptionFromArgs(args, "--workflow-status-id"),
      dueDate: yield* requiredOptionFromArgs(args, "--due-date"),
    };

    addOptionalValue(body, "assignedUserId", nullableIdFromArgs(args, "--assigned-user-id"));
    addOptionalValue(body, "parentTaskId", nullableIdFromArgs(args, "--parent-task-id"));
    addOptionalValue(body, "priority", nullableIdFromArgs(args, "--priority"));

    return yield* runTaskTool("create-task", body);
  });

const runTaskUpdate = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const body: Record<string, unknown> = {
      churchId: yield* requiredOptionFromArgs(args, "--church-id"),
    };
    yield* addTaskReference(body, args);

    addOptionalValue(body, "title", optionValueFromArgs(args, "--title"));
    addOptionalValue(body, "workflowStatusId", optionValueFromArgs(args, "--workflow-status-id"));
    addOptionalValue(body, "dueDate", optionValueFromArgs(args, "--due-date"));
    addOptionalValue(body, "cycleId", optionValueFromArgs(args, "--cycle-id"));
    addOptionalValue(body, "priority", nullableIdFromArgs(args, "--priority"));

    if (args.includes("--unassign-user")) {
      body.assignedUserId = null;
    } else {
      addOptionalValue(body, "assignedUserId", nullableIdFromArgs(args, "--assigned-user-id"));
    }

    // Every Task belongs to exactly one Team (ADR 0013); a Task can move
    // between Teams but never become team-less.
    addOptionalValue(body, "teamId", optionValueFromArgs(args, "--team-id"));

    if (args.includes("--clear-parent")) {
      body.parentTaskId = null;
    } else {
      addOptionalValue(body, "parentTaskId", nullableIdFromArgs(args, "--parent-task-id"));
    }

    return yield* runTaskTool("update-task", body);
  });

const runTaskTransition = (tool: string, args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const body: Record<string, unknown> = {
      churchId: yield* requiredOptionFromArgs(args, "--church-id"),
    };
    yield* addTaskReference(body, args);

    return yield* runTaskTool(tool, body);
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

class CurrentEnvToken extends Context.Service<CurrentEnvToken, string | null>()(
  "@church-work/cli/CurrentEnvToken",
) {}

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

  if (command === "mcp" && args[1] === "call") {
    return runMcpCall(args.slice(2));
  }

  if (command === "template" && args[1] === "create-weekly-service") {
    return runTemplateCreateWeeklyService(args.slice(2));
  }

  if (command === "template" && args[1] === "list") {
    return runChurchScopedTaskTool("template-list", args.slice(2));
  }

  if (command === "template" && args[1] === "get") {
    return runIdBackedTaskTool("template-get", "--template-id", "templateId", args.slice(2));
  }

  if (command === "template" && args[1] === "update") {
    return runJsonBackedTaskTool("template-update", args.slice(2));
  }

  if (command === "template" && args[1] === "delete") {
    return runIdBackedTaskTool("template-delete", "--template-id", "templateId", args.slice(2));
  }

  if (command === "template" && args[1] === "restore") {
    return runIdBackedTaskTool("template-restore", "--template-id", "templateId", args.slice(2));
  }

  if (command === "template" && args[1] === "duplicate") {
    return runJsonBackedTaskTool("template-duplicate", args.slice(2));
  }

  if (command === "template-schedule" && args[1] === "create") {
    return runJsonBackedTaskTool("template-schedule-create", args.slice(2));
  }

  if (command === "template-schedule" && args[1] === "update") {
    return runJsonBackedTaskTool("template-schedule-update", args.slice(2));
  }

  if (command === "template-schedule" && args[1] === "delete") {
    return runIdBackedTaskTool(
      "template-schedule-delete",
      "--template-schedule-id",
      "templateScheduleId",
      args.slice(2),
    );
  }

  if (command === "template-schedule" && args[1] === "restore") {
    return runIdBackedTaskTool(
      "template-schedule-restore",
      "--template-schedule-id",
      "templateScheduleId",
      args.slice(2),
    );
  }

  if (command === "key-date" && args[1] === "list") {
    return runChurchScopedTaskTool("key-date-list", args.slice(2));
  }

  if (command === "key-date" && args[1] === "create") {
    return runJsonBackedTaskTool("key-date-create", args.slice(2));
  }

  if (command === "key-date" && args[1] === "update") {
    return runJsonBackedTaskTool("key-date-update", args.slice(2));
  }

  if (command === "key-date" && args[1] === "delete") {
    return runIdBackedTaskTool("key-date-delete", "--key-date-id", "keyDateId", args.slice(2));
  }

  if (command === "key-date" && args[1] === "restore") {
    return runIdBackedTaskTool("key-date-restore", "--key-date-id", "keyDateId", args.slice(2));
  }

  if (command === "key-date" && args[1] === "preview-occurrences") {
    return runJsonBackedTaskTool("key-date-preview-occurrences", args.slice(2));
  }

  if (command === "template-task" && args[1] === "add-at-placement") {
    return runTemplateTaskAddAtPlacement(args.slice(2));
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
        message: "Set CHURCH_WORK_API_URL or CHURCH_WORK_SITE_URL to your Church Work server URL.",
      });
    case "MissingLoginTokenError":
      return failure({
        code: "missing_login_token",
        message: "Set CHURCH_WORK_AUTH_TOKEN to create a named CLI credential.",
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
          "Run `church-work health`, `church-work login --name <name>`, `church-work current-user`, `church-work active-church`, `church-work setup read --church-id <id>`, `church-work setup write --json <batch>`, `church-work task <list|get|create|update|complete|cancel|reopen>`, `church-work template <list|get|update|delete|restore|duplicate>`, `church-work template-schedule <create|update|delete|restore>`, `church-work key-date <list|create|update|delete|restore|preview-occurrences>`, `church-work lookup <users|teams|cycles|workflow-statuses>`, `church-work auth status`, or `church-work auth logout`.",
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

  const backendLayer = options.backendLayer ?? makeHttpBackendLayer(options.env);
  const credentialStorageLayer =
    options.credentialStorageLayer ?? makeFileCredentialStorageLayer(options.env);
  const currentEnvTokenLayer = Layer.succeed(
    CurrentEnvToken,
    options.env.CHURCH_WORK_AUTH_TOKEN?.trim() || null,
  );
  const layer = Layer.mergeAll(backendLayer, credentialStorageLayer, currentEnvTokenLayer);
  const program: Effect.Effect<CliResult, CliError, never> = runCliEffect(args, options.env).pipe(
    Effect.provide(layer),
  );

  return cliTracer.startActiveSpan("cli.command", async (span) => {
    span.setAttributes({ "cli.command": command });

    try {
      const result = await Effect.runPromise(
        program.pipe(Effect.catch((error) => Effect.succeed(formatError(error)))),
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
