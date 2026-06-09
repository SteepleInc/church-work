import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import { existsSync } from "node:fs";

const e2eEnvFile = ".env.e2e";
const hasE2eEnvFile = existsSync(e2eEnvFile);

if (hasE2eEnvFile) {
  config({ path: e2eEnvFile, quiet: true });
}

const requiredEnvNames = ["VITE_CONVEX_URL", "VITE_CONVEX_SITE_URL"] as const;
const missingEnvNames = requiredEnvNames.filter((name) => !process.env[name]);
const allowsProcessE2eEnv = Boolean(process.env.CI);
const e2eEnvReady = missingEnvNames.length === 0 && (hasE2eEnvFile || allowsProcessE2eEnv);
const e2eSkipReason = hasE2eEnvFile
  ? `Missing ${missingEnvNames.join(", ")} in ${e2eEnvFile}. E2E tests must not fall back to normal development Convex state.`
  : allowsProcessE2eEnv
    ? `Missing ${missingEnvNames.join(", ")} in the CI process environment. Export isolated Convex E2E values or copy .env.e2e.example to ${e2eEnvFile}.`
    : `Missing ${e2eEnvFile}. Local E2E tests require an explicit isolated env file and must not fall back to normal development Convex state.`;

if (!e2eEnvReady && process.env.CI) {
  throw new Error(e2eSkipReason);
}

process.env.CHURCH_TASK_E2E_READY = e2eEnvReady ? "1" : "0";
process.env.CHURCH_TASK_E2E_SKIP_REASON = e2eSkipReason;

const e2ePort = Number(process.env.E2E_WEB_PORT ?? 2101);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${e2ePort}`;
const convexUrl = process.env.VITE_CONVEX_URL;
const convexSiteUrl = process.env.VITE_CONVEX_SITE_URL;
const shouldStartLocalConvex = convexUrl?.startsWith("http://127.0.0.1:") ?? false;
const webServers = [
  ...(shouldStartLocalConvex
    ? [
        {
          command: "bun run dev:e2e",
          cwd: "./packages/backend",
          env: process.env,
          url: `${convexSiteUrl}/api/auth/get-session`,
          reuseExistingServer: false,
          timeout: 120_000,
        },
      ]
    : []),
  {
    command: "bun run dev -- --mode e2e --host 127.0.0.1",
    cwd: "./apps/web",
    env: {
      ...process.env,
      VITE_PORT: String(e2ePort),
    },
    url: baseURL,
    reuseExistingServer: !shouldStartLocalConvex && !process.env.CI,
    timeout: 120_000,
  },
];

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: !shouldStartLocalConvex,
  workers: shouldStartLocalConvex ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  ...(e2eEnvReady
    ? {
        webServer: webServers,
      }
    : {}),
});
