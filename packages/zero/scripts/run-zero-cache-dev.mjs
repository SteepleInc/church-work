import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const envFile = join(workspaceRoot, ".env.local");

const parseEnvFile = (path) => {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const separatorIndex = line.indexOf("=");
          if (separatorIndex === -1) {
            return [];
          }

          const key = line.slice(0, separatorIndex).trim();
          const rawValue = line.slice(separatorIndex + 1).trim();
          const value = rawValue.replace(/^(["'])(.*)\1$/u, "$2");
          return [key, value];
        })
        .filter(([key]) => key),
    );
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
};

const zeroProcessPatterns = [
  "/@rocicorp+zero@",
  "/node_modules/@rocicorp/zero/",
  "/out/zero-cache/src/",
];

const getWorkspaceZeroPids = () => {
  const result = spawnSync("ps", ["-axo", "pid=,command="], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^(\d+)\s+(.+)$/u.exec(line);
      if (!match) {
        return undefined;
      }

      return { command: match[2], pid: Number(match[1]) };
    })
    .filter((processInfo) => {
      if (!processInfo || processInfo.pid === process.pid) {
        return false;
      }

      return (
        processInfo.command.includes(workspaceRoot) &&
        zeroProcessPatterns.every((pattern) => processInfo.command.includes(pattern))
      );
    })
    .map(({ pid }) => pid);
};

const killPids = (pids, signal) => {
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    } catch (error) {
      if (!error || error.code !== "ESRCH") {
        throw error;
      }
    }
  }
};

const cleanupWorkspaceZeroProcesses = (signal = "SIGTERM") => {
  killPids(getWorkspaceZeroPids(), signal);
};

const zeroEntry = fileURLToPath(import.meta.resolve("@rocicorp/zero"));
const zeroCache = join(dirname(zeroEntry), "cli.js");

cleanupWorkspaceZeroProcesses();

const child = spawn(process.execPath, [zeroCache], {
  detached: true,
  env: {
    ZERO_NUM_SYNC_WORKERS: "3",
    ZERO_CVR_MAX_CONNS: "6",
    ZERO_UPSTREAM_MAX_CONNS: "6",
    NODE_ENV: "development",
    ZERO_ENABLE_STARTUP_MESSAGE: "1",
    ...process.env,
    ...parseEnvFile(envFile),
    NODE_TLS_REJECT_UNAUTHORIZED: "0",
  },
  stdio: ["inherit", "pipe", "pipe"],
});

let shuttingDown = false;
let sawErrorExit = false;
let sawReady = false;

const handleOutput = (stream, chunk) => {
  const output = String(chunk);
  if (output.includes("zero-cache ready")) {
    sawReady = true;
  }
  if (output.includes("exiting with error:")) {
    sawErrorExit = true;
  }
  stream.write(chunk);
};

child.stdout.on("data", (chunk) => handleOutput(process.stdout, chunk));
child.stderr.on("data", (chunk) => handleOutput(process.stderr, chunk));

const stopChildGroup = (signal) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (!error || error.code !== "ESRCH") {
      throw error;
    }
  }

  setTimeout(() => cleanupWorkspaceZeroProcesses("SIGTERM"), 1_000);
};

process.once("SIGINT", () => stopChildGroup("SIGINT"));
process.once("SIGTERM", () => stopChildGroup("SIGTERM"));

child.once("exit", (code, signal) => {
  if (shuttingDown || (code === 255 && sawReady && !sawErrorExit)) {
    cleanupWorkspaceZeroProcesses("SIGTERM");
    setTimeout(() => {
      cleanupWorkspaceZeroProcesses("SIGKILL");
      process.exit(0);
    }, 2_000);
    return;
  }

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
