import { api } from "@church-task/backend/convex/_generated/api";
import type {
  ActiveChurchResponse,
  CurrentUserResponse,
} from "@church-task/backend/agent/operations";
import { ConvexHttpClient } from "convex/browser";
import { Context, Data, Effect, Layer } from "effect";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

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
      };
    }),
  );

const credentialNameFromArgs = (args: ReadonlyArray<string>) => {
  const nameIndex = args.indexOf("--name");
  const name = nameIndex >= 0 ? args[nameIndex + 1]?.trim() : undefined;

  return name ? Effect.succeed(name) : Effect.fail(new MissingOptionError({ option: "--name" }));
};

const churchIdFromArgs = (args: ReadonlyArray<string>) => {
  const churchIdIndex = args.indexOf("--church-id");
  const churchId = churchIdIndex >= 0 ? args[churchIdIndex + 1]?.trim() : undefined;

  return churchId ?? null;
};

const readEnvToken = (env: CliEnv) => {
  const token = env.CHURCH_TASK_AUTH_TOKEN?.trim();
  return token ? Effect.succeed(token) : Effect.fail(new MissingLoginTokenError());
};

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
          "Run `church-task health`, `church-task login --name <name>`, `church-task current-user`, `church-task active-church`, `church-task auth status`, or `church-task auth logout`.",
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

  return Effect.runPromise(
    program.pipe(Effect.catchAll((error) => Effect.succeed(formatError(error)))),
  );
};
