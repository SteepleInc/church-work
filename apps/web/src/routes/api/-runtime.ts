import { createTracerApi } from "@church-work/server";

let tracerApi: ReturnType<typeof createTracerApi> | undefined;

const getTracerApi = async () => {
  if (tracerApi) {
    return tracerApi;
  }

  const { serverEnv } = await import("@church-work/env/server");
  tracerApi = createTracerApi(serverEnv.DATABASE_URL);
  return tracerApi;
};

export const handleApiRequest = async (request: Request) => {
  const api = await getTracerApi();
  return api.fetch(request);
};
