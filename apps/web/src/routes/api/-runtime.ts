import { createTracerApi } from "@church-task/server";

export const tracerApi = process.env.DATABASE_URL ? createTracerApi(process.env.DATABASE_URL) : null;

export const handleApiRequest = (request: Request) => {
  if (!tracerApi) {
    return Response.json(
      { error: "DATABASE_URL is required to handle API requests." },
      { status: 500 },
    );
  }

  return tracerApi.fetch(request);
};
