import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createDb, resetAndSeedDatabase, type SeedProfile } from "@church-task/db";
import { sql } from "drizzle-orm";
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

const waitForHttpOk = async (url: string, timeoutMs: number, init?: RequestInit) => {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, init);
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

export const ensureZeroMutationStorage = async (databaseUrl: string, appId: string) => {
  const { db, pool } = createDb(databaseUrl);
  const schemaName = `${appId}_0`;

  if (!/^[A-Za-z0-9_]+$/.test(schemaName)) {
    throw new Error(`Invalid Zero mutation storage schema: ${schemaName}`);
  }

  try {
    await db.execute(sql.raw(`create schema if not exists "${schemaName}"`));
    await db.execute(
      sql.raw(`
        create table if not exists "${schemaName}"."clients" (
          "clientGroupID" text not null,
          "clientID" text not null,
          "lastMutationID" bigint,
          primary key ("clientGroupID", "clientID")
        )
      `),
    );
    await db.execute(
      sql.raw(`
        create table if not exists "${schemaName}"."mutations" (
          "clientGroupID" text not null,
          "clientID" text not null,
          "mutationID" bigint not null,
          "result" json,
          primary key ("clientGroupID", "clientID", "mutationID")
        )
      `),
    );
  } finally {
    await pool.end();
  }
};

export const startPostgresHarness = async (
  options: { readonly seedProfile?: SeedProfile } = {},
) => {
  const container = await new PostgreSqlContainer("postgres:16-alpine")
    .withCommand([
      "postgres",
      "-c",
      "wal_level=logical",
      "-c",
      "max_replication_slots=100",
      "-c",
      "max_wal_senders=100",
      "-c",
      "timezone=UTC",
    ])
    .start();
  const connectionString = container.getConnectionUri();
  const { db, pool } = createDb(connectionString);

  await migrate(db, { migrationsFolder: new URL("../../db/drizzle", import.meta.url).pathname });
  await resetAndSeedDatabase(db, options.seedProfile ?? "empty");

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
  readonly appId?: string;
  readonly apiBaseUrl: string;
  readonly databaseUrl: string;
  readonly port?: number;
}) => {
  const appId = options.appId ?? "tracer";
  const adminPassword = "church-task-e2e-zero-admin-password";
  const statzAuthorization = `Basic ${Buffer.from(`zero:${adminPassword}`).toString("base64")}`;
  const maxAttempts = options.port ? 1 : 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const port = options.port ?? (await getOpenPort());
    const tmpDir = await mkdtemp(join(tmpdir(), "church-task-zero-"));
    const replicaFile = join(tmpDir, "zero.db");
    const zeroUrl = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, [getZeroCacheCliPath()], {
      env: {
        ...process.env,
        DO_NOT_TRACK: "1",
        ZERO_ADMIN_PASSWORD: adminPassword,
        ZERO_APP_ID: appId,
        ZERO_CHANGE_DB: options.databaseUrl,
        ZERO_CVR_DB: options.databaseUrl,
        ZERO_ENABLE_TELEMETRY: "false",
        ZERO_LOG_LEVEL: "warn",
        ZERO_MUTATE_ALLOWED_CLIENT_HEADERS: "cookie",
        ZERO_MUTATE_FORWARD_COOKIES: "true",
        ZERO_MUTATE_URL: `${options.apiBaseUrl}/api/zero/mutate`,
        ZERO_NUM_SYNC_WORKERS: "1",
        ZERO_PORT: String(port),
        ZERO_QUERY_ALLOWED_CLIENT_HEADERS: "cookie",
        ZERO_QUERY_FORWARD_COOKIES: "true",
        ZERO_QUERY_URL: `${options.apiBaseUrl}/api/zero/query`,
        ZERO_REPLICA_FILE: replicaFile,
        ZERO_TASK_ID: `${appId}-e2e`,
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
        waitForHttpOk(`${zeroUrl}/statz`, 60_000, {
          headers: { authorization: statzAuthorization },
        }),
        new Promise<never>((_, reject) => {
          child.once("exit", (code, signal) => {
            reject(
              new Error(`zero-cache exited before ready: code=${code} signal=${signal}\n${output}`),
            );
          });
        }),
      ]);

      await ensureZeroMutationStorage(options.databaseUrl, appId);

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
    } catch (error) {
      child.kill("SIGTERM");
      await rm(tmpDir, { force: true, recursive: true });
      if (attempt < maxAttempts && error instanceof Error && error.message.includes("EADDRINUSE")) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Unable to start zero-cache harness");
};
