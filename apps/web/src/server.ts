import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import {
  runCloudflareRolloverMaintenance,
  type RolloverMaintenanceEnv,
} from "./rollover-maintenance";

type ScheduledWorker = Omit<ExportedHandler<Env>, "scheduled"> & {
  scheduled(
    controller: ScheduledController,
    env: RolloverMaintenanceEnv,
  ): ReturnType<typeof runCloudflareRolloverMaintenance>;
};

export const applyWorkerEnv = (env: unknown) => {
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
  fetch(request: Request) {
    return handler.fetch(request);
  },
});

const worker = {
  fetch(request: Request, env: Env) {
    applyWorkerEnv(env);
    return serverEntry.fetch(request);
  },
  async scheduled(controller: ScheduledController, env: RolloverMaintenanceEnv) {
    applyWorkerEnv(env);
    return runCloudflareRolloverMaintenance(controller, env);
  },
} satisfies ScheduledWorker;

// Cloudflare ignores a scheduled handler's resolved value, while returning the
// summary gives high-level tests and other direct callers a stable result seam.
export default worker;
