import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

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

export default createServerEntry({
  fetch(request: Request, env: unknown) {
    applyWorkerEnv(env);
    return handler.fetch(request);
  },
});
