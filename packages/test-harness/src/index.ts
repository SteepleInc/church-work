import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createDb } from "@church-task/db";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { PostgreSqlContainer } from "@testcontainers/postgresql";

const getOpenPort = async () => {
  const { createServer } = await import("node:net");
  const server = createServer();

  return new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address) {
        const { port } = address;
        server.close(() => resolve(port));
        return;
      }

      server.close(() => reject(new Error("Unable to allocate an open port")));
    });
  });
};

const waitForHttpOk = async (url: string, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${url}`);
};

const getZeroCacheCliPath = () => {
  const zeroEntry = fileURLToPath(import.meta.resolve("@rocicorp/zero"));
  return join(zeroEntry, "..", "cli.js");
};

export const startPostgresHarness = async () => {
  const container = await new PostgreSqlContainer("postgres:16-alpine")
    .withCommand(["postgres", "-c", "wal_level=logical"])
    .start();
  const connectionString = container.getConnectionUri();
  const { db, pool } = createDb(connectionString);

  await migrate(db, { migrationsFolder: new URL("../../db/drizzle", import.meta.url).pathname });

  return {
    connectionString,
    db,
    async stop() {
      await pool.end();
      await container.stop();
    },
  };
};

export const startZeroCacheHarness = async (options: {
  readonly apiBaseUrl: string;
  readonly databaseUrl: string;
}) => {
  const port = await getOpenPort();
  const tmpDir = await mkdtemp(join(tmpdir(), "church-task-zero-"));
  const replicaFile = join(tmpDir, "zero.db");
  const zeroUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [getZeroCacheCliPath()], {
    env: {
      ...process.env,
      DO_NOT_TRACK: "1",
      ZERO_APP_ID: "tracer",
      ZERO_CHANGE_DB: options.databaseUrl,
      ZERO_CVR_DB: options.databaseUrl,
      ZERO_ENABLE_TELEMETRY: "false",
      ZERO_LOG_LEVEL: "warn",
      ZERO_MUTATE_ALLOWED_CLIENT_HEADERS: "cookie",
      ZERO_MUTATE_URL: `${options.apiBaseUrl}/api/zero/mutate`,
      ZERO_NUM_SYNC_WORKERS: "1",
      ZERO_PORT: String(port),
      ZERO_QUERY_ALLOWED_CLIENT_HEADERS: "cookie",
      ZERO_QUERY_URL: `${options.apiBaseUrl}/api/zero/query`,
      ZERO_REPLICA_FILE: replicaFile,
      ZERO_UPSTREAM_DB: options.databaseUrl,
      ZERO_UPSTREAM_MAX_CONNS: "6",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    output += String(chunk);
  });

  try {
    await Promise.race([
      waitForHttpOk(`${zeroUrl}/statz`, 60_000),
      new Promise<never>((_, reject) => {
        child.once("exit", (code, signal) => {
          reject(
            new Error(`zero-cache exited before ready: code=${code} signal=${signal}\n${output}`),
          );
        });
      }),
    ]);
  } catch (error) {
    child.kill("SIGTERM");
    await rm(tmpDir, { force: true, recursive: true });
    throw error;
  }

  return {
    port,
    url: zeroUrl,
    async stop() {
      if (!child.killed && child.exitCode === null) {
        child.kill("SIGTERM");
        await new Promise<void>((resolve) => child.once("exit", () => resolve()));
      }
      await rm(tmpDir, { force: true, recursive: true });
    },
  };
};
