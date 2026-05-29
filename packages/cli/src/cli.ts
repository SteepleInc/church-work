import { api } from "@church-task/backend/convex/_generated/api";
import type { CurrentUserResponse } from "@church-task/backend/agent/operations";
import { ConvexHttpClient } from "convex/browser";
import { Context, Data, Effect, Layer } from "effect";

export type CliEnv = Record<string, string | undefined>;

export type CliResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

type HealthStatus = "OK";
type CliError = BackendError | MissingBackendConfigError | UnknownCommandError;

export type BackendClientService = {
  readonly healthCheck: Effect.Effect<HealthStatus, BackendError>;
  readonly currentUser: Effect.Effect<CurrentUserResponse, BackendError>;
};

export class BackendError extends Data.TaggedError("BackendError")<{
  readonly cause: unknown;
}> {}

class MissingBackendConfigError extends Data.TaggedError("MissingBackendConfigError")<{}> {}

class UnknownCommandError extends Data.TaggedError("UnknownCommandError")<{
  readonly command: string | undefined;
}> {}

export class BackendClient extends Context.Tag("@church-task/cli/BackendClient")<
  BackendClient,
  BackendClientService
>() {}

const readBackendUrl = (env: CliEnv) =>
  Effect.sync(() => env.CHURCH_TASK_CONVEX_URL?.trim()).pipe(
    Effect.flatMap((url) =>
      url ? Effect.succeed(url) : Effect.fail(new MissingBackendConfigError()),
    ),
  );

const makeConvexBackendLayer = (env: CliEnv) =>
  Layer.effect(
    BackendClient,
    Effect.gen(function* () {
      const convexUrl = yield* readBackendUrl(env);
      const client = new ConvexHttpClient(convexUrl, { logger: false });

      return {
        healthCheck: Effect.tryPromise({
          try: () => client.query(api.healthCheck.get),
          catch: (cause) => new BackendError({ cause }),
        }),
        currentUser: Effect.tryPromise({
          try: () => client.query(api.agent.currentUser),
          catch: (cause) => new BackendError({ cause }),
        }),
      };
    }),
  );

const runHealth = Effect.gen(function* () {
  const backend = yield* BackendClient;
  const status = yield* backend.healthCheck;

  return success({ ok: true, operation: "health", status });
});

const runCurrentUser = Effect.gen(function* () {
  const backend = yield* BackendClient;
  const currentUser = yield* backend.currentUser;

  return success(currentUser);
});

const runCliEffect = (
  args: ReadonlyArray<string>,
): Effect.Effect<CliResult, BackendError | UnknownCommandError, BackendClient> => {
  const command = args[0];

  if (command === "health") {
    return runHealth;
  }

  if (command === "current-user") {
    return runCurrentUser;
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

const formatError = (error: CliError) => {
  switch (error._tag) {
    case "BackendError":
      return failure({
        code: "backend_unavailable",
        message: "Backend operation failed.",
      });
    case "MissingBackendConfigError":
      return failure({
        code: "missing_backend_config",
        message: "Set CHURCH_TASK_CONVEX_URL to your Convex deployment URL.",
      });
    case "UnknownCommandError":
      return failure({
        code: "unknown_command",
        message: "Run `church-task health` or `church-task current-user`.",
      });
  }
};

export const runCli = (
  args: ReadonlyArray<string>,
  options: {
    readonly env: CliEnv;
    readonly backendLayer?: Layer.Layer<BackendClient, never>;
  },
): Promise<CliResult> => {
  const layer = options.backendLayer ?? makeConvexBackendLayer(options.env);
  const program: Effect.Effect<CliResult, CliError, never> = runCliEffect(args).pipe(
    Effect.provide(layer),
  );

  return Effect.runPromise(
    program.pipe(Effect.catchAll((error) => Effect.succeed(formatError(error)))),
  );
};
