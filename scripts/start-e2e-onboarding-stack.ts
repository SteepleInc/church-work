import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";

import { createTracerApi } from "@church-task/server";
import type { SeedProfile } from "@church-task/db";
import { startPostgresHarness, startZeroCacheHarness } from "@church-task/test-harness";

const rootDir = resolve(import.meta.dirname, "..");
const webDir = resolve(rootDir, "apps/web");
const apiPort = Number(process.env.E2E_API_PORT ?? 2103);
const webPort = Number(process.env.E2E_WEB_PORT ?? 2101);
const apiUrl = `http://127.0.0.1:${apiPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
const seedProfiles = new Set<SeedProfile>(["empty", "app", "admin"]);

const getSeedProfile = (): SeedProfile => {
  const profile = process.env.E2E_SEED_PROFILE ?? "empty";
  if (seedProfiles.has(profile as SeedProfile)) return profile as SeedProfile;

  throw new Error(`Unsupported E2E_SEED_PROFILE ${profile}. Expected empty, app, or admin.`);
};

const waitForHttpOk = async (url: string, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }

  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${url}`);
};

const children = new Set<ChildProcess>();
let shuttingDown = false;

const runChild = (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string,
  env: NodeJS.ProcessEnv,
) => {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: "inherit",
  });

  children.add(child);
  child.once("exit", (code, signal) => {
    children.delete(child);
    if (!shuttingDown && code !== 0) {
      throw new Error(`${command} ${args.join(" ")} exited: code=${code} signal=${signal}`);
    }
  });

  return child;
};

const seedProfile = getSeedProfile();
console.info(`Starting onboarding E2E Postgres harness with ${seedProfile} seed profile`);
const postgres = await startPostgresHarness({ seedProfile });
process.env.E2E_SITE_URL = webUrl;
process.env.BETTER_AUTH_URL = webUrl;
process.env.SITE_URL = webUrl;
const api = createTracerApi(postgres.connectionString);
const apiServer = createServer(async (incoming, outgoing) => {
  const chunks: Array<Buffer> = [];
  for await (const chunk of incoming) {
    chunks.push(Buffer.from(chunk));
  }

  const request = new Request(`${apiUrl}${incoming.url ?? "/"}`, {
    body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
    headers: incoming.headers as ConstructorParameters<typeof Headers>[0],
    method: incoming.method,
  });
  const response = await api.fetch(request);

  outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
});
await new Promise<void>((resolveListen) =>
  apiServer.listen(apiPort, "127.0.0.1", () => resolveListen()),
);
console.info("Starting onboarding E2E Zero cache");
const zero = await startZeroCacheHarness({
  apiBaseUrl: apiUrl,
  appId: "onboarding_e2e",
  databaseUrl: postgres.connectionString,
});

const webEnv = {
  ...process.env,
  CHURCH_TASK_E2E_API_URL: apiUrl,
  DATABASE_URL: postgres.connectionString,
  E2E_SITE_URL: webUrl,
  NODE_ENV: "development",
  OTP_CAPTURE_ENABLED: "1",
  SITE_URL: webUrl,
  VITE_PORT: String(webPort),
  VITE_ZERO_CACHE_URL: zero.url,
};

console.info(`Starting onboarding E2E web app at ${webUrl}`);
runChild("bun", ["run", "dev", "--", "--mode", "e2e", "--host", "127.0.0.1"], webDir, webEnv);
await waitForHttpOk(webUrl, 120_000);
console.info("Onboarding E2E stack ready");
console.info(`- API: ${apiUrl}`);
console.info(`- Web/API: ${webUrl}`);
console.info(`- Zero: ${zero.url}`);

const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed && child.exitCode === null) child.kill("SIGTERM");
  }

  await Promise.all(
    [...children].map(
      (child) => new Promise<void>((resolveChild) => child.once("exit", () => resolveChild())),
    ),
  );
  await zero.stop();
  await new Promise<void>((resolveClose) => apiServer.close(() => resolveClose()));
  await api.close();
  await postgres.stop();
};

process.once("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});
process.once("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});
