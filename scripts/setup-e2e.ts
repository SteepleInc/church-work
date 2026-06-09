import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "..");
const backendDir = resolve(rootDir, "packages/backend");
const envPath = resolve(rootDir, ".env.e2e");
const localConfigPath = resolve(backendDir, ".convex/local/default/config.json");
const localConvexDir = resolve(backendDir, ".convex/local");

const convexCloudPort = 2201;
const convexSitePort = 2202;
const webPort = 2101;
const siteUrl = `http://127.0.0.1:${webPort}`;
const convexUrl = `http://127.0.0.1:${convexCloudPort}`;
const convexSiteUrl = `http://127.0.0.1:${convexSitePort}`;
const betterAuthSecret = "e2e-local-better-auth-secret-do-not-use-in-production";

type LocalConvexConfig = {
  readonly backendVersion: string;
  readonly ports: { cloud: number; site: number };
  readonly adminKey: string;
  readonly instanceSecret: string;
  readonly deploymentName: string;
};

const run = (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
) => {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
};

const stopProcessesOnPort = (port: number) => {
  const result = spawnSync("lsof", ["-ti", `tcp:${port}`], {
    cwd: rootDir,
    encoding: "utf8",
  });

  const pids = result.stdout
    .split("\n")
    .map((pid) => pid.trim())
    .filter(Boolean);

  for (const pid of pids) {
    spawnSync("kill", [pid], { cwd: rootDir, stdio: "ignore" });
  }
};

const readLocalConfig = () => {
  if (!existsSync(localConfigPath)) return null;
  return JSON.parse(readFileSync(localConfigPath, "utf8")) as LocalConvexConfig;
};

stopProcessesOnPort(webPort);
stopProcessesOnPort(convexCloudPort);
stopProcessesOnPort(convexSitePort);
rmSync(localConvexDir, { recursive: true, force: true });
run("bun", ["convex", "deployment", "create", "local"], backendDir);

const localConfig = readLocalConfig();
if (!localConfig) {
  throw new Error("Expected Convex local deployment config to exist after setup.");
}

const normalizedLocalConfig: LocalConvexConfig = {
  ...localConfig,
  ports: { cloud: convexCloudPort, site: convexSitePort },
};
mkdirSync(dirname(localConfigPath), { recursive: true });
writeFileSync(localConfigPath, JSON.stringify(normalizedLocalConfig));

const requiredEnv = new Map([
  ["CONVEX_DEPLOYMENT", `local:${normalizedLocalConfig.deploymentName}`],
  ["CONVEX_URL", convexUrl],
  ["CONVEX_SITE_URL", convexSiteUrl],
  ["VITE_CONVEX_URL", convexUrl],
  ["VITE_CONVEX_SITE_URL", convexSiteUrl],
  ["BETTER_AUTH_SECRET", betterAuthSecret],
  ["NODE_ENV", "development"],
  ["SITE_URL", siteUrl],
  ["E2E_SITE_URL", siteUrl],
  ["OTP_CAPTURE_ENABLED", "1"],
  ["E2E_WEB_PORT", String(webPort)],
]);

const existingLines = existsSync(envPath) ? readFileSync(envPath, "utf8").split("\n") : [];
const seen = new Set<string>();
const nextLines = existingLines.map((line) => {
  const match = line.match(/^([A-Z0-9_]+)=/);
  if (!match) return line;

  const value = requiredEnv.get(match[1]);
  if (value === undefined) return line;

  seen.add(match[1]);
  return `${match[1]}=${value}`;
});

for (const [name, value] of requiredEnv) {
  if (!seen.has(name)) {
    nextLines.push(`${name}=${value}`);
  }
}

writeFileSync(envPath, `${nextLines.join("\n").replace(/\n+$/, "")}\n`);

const convexEnv = [
  ["BETTER_AUTH_SECRET", betterAuthSecret],
  ["NODE_ENV", "development"],
  ["SITE_URL", siteUrl],
  ["E2E_SITE_URL", siteUrl],
  ["OTP_CAPTURE_ENABLED", "1"],
] as const;

const localConvexProcessEnv = {
  ...process.env,
  CONVEX_DEPLOYMENT: `local:${normalizedLocalConfig.deploymentName}`,
  CONVEX_URL: convexUrl,
  CONVEX_SITE_URL: convexSiteUrl,
  VITE_CONVEX_URL: convexUrl,
  VITE_CONVEX_SITE_URL: convexSiteUrl,
};

for (const [name, value] of convexEnv) {
  run(
    "bun",
    ["--env-file=../../.env.e2e", "convex", "env", "set", name, value],
    backendDir,
    localConvexProcessEnv,
  );
}

console.log("E2E environment ready:");
console.log(`- Convex: ${convexUrl}`);
console.log(`- Convex site: ${convexSiteUrl}`);
console.log(`- Web: ${siteUrl}`);
