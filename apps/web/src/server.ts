import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import { runCloudflareRolloverMaintenance } from "./rollover-maintenance";

const applyWorkerEnv = (env: unknown) => {
  if (!env || typeof env !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      process.env[key] = value;
    }
  }
};

const serverEntry = createServerEntry({
  fetch(request: Request, env: unknown) {
    applyWorkerEnv(env);
    return handler.fetch(request);
  },
});

export default {
  fetch(request, env) {
    applyWorkerEnv(env);
    return serverEntry.fetch(request);
  },
  async scheduled(controller, env) {
    await runCloudflareRolloverMaintenance(controller, env);
  },
} satisfies ExportedHandler<Env>;
