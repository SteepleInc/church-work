import { getServerEnv } from "@church-work/env/server";
import { createTracerApi } from "@church-work/server";

// Cloudflare Workers cannot reuse TCP sockets (pg pool connections) across
// requests: awaiting a query on a connection opened by an earlier request
// hangs forever and the runtime cancels the request. On Workers we build a
// fresh API (and pg pools) per request and close it after responding. In
// long-lived Node/Bun dev servers we keep the cached instance.
const isCloudflareWorkers = globalThis.navigator?.userAgent === "Cloudflare-Workers";

let tracerApi: ReturnType<typeof createTracerApi> | undefined;

const getTracerApi = async () => {
  if (tracerApi) {
    return tracerApi;
  }

  tracerApi = createTracerApi(getServerEnv().DATABASE_URL);
  return tracerApi;
};

export const handleApiRequest = async (request: Request) => {
  if (!isCloudflareWorkers) {
    const api = await getTracerApi();
    return api.fetch(request);
  }

  const api = createTracerApi(getServerEnv().DATABASE_URL);
  try {
    return await api.fetch(request);
  } finally {
    await api.close();
  }
};
