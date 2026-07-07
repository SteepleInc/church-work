import { env } from "cloudflare:workers";

import { createServerEnv } from "./create-server-env";

let serverEnv: ReturnType<typeof createServerEnv> | undefined;

// Reading `HYPERDRIVE.connectionString` is only allowed inside a request
// handler, so the worker env is resolved lazily on first access instead of at
// global scope.
export const getServerEnv = () => {
  if (!serverEnv) {
    const { HYPERDRIVE, ...workerEnv } = env;

    serverEnv = createServerEnv({
      ...workerEnv,
      // Prefer pooled Hyperdrive connections over the direct DATABASE_URL
      // when the binding is configured.
      DATABASE_URL: HYPERDRIVE?.connectionString ?? workerEnv.DATABASE_URL,
    });
  }

  return serverEnv;
};
