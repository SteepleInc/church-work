import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

import { createTracerApi } from "./tracer-api";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
config({ override: true, path: fileURLToPath(new URL("../../../.env.local", import.meta.url)) });

const port = Number(process.env.CHURCH_TASK_DEV_API_PORT ?? 2003);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to start the local API server.");
}

const api = createTracerApi(databaseUrl);

const server = createServer(async (incoming, outgoing) => {
  if (incoming.url === "/healthz") {
    outgoing.writeHead(200, { "content-type": "application/json" });
    outgoing.end(JSON.stringify({ ok: true }));
    return;
  }

  const chunks: Array<Buffer> = [];
  for await (const chunk of incoming) chunks.push(Buffer.from(chunk));

  const request = new Request(`http://127.0.0.1:${port}${incoming.url ?? "/"}`, {
    body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
    headers: incoming.headers as ConstructorParameters<typeof Headers>[0],
    method: incoming.method,
  });
  const response = await api.fetch(request);

  outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
});

await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", () => resolve()));
console.info(`Church Task API listening on http://127.0.0.1:${port}`);

const shutdown = async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await api.close();
};

process.once("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});
process.once("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});
