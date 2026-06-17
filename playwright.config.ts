import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import { existsSync } from "node:fs";

const e2eEnvFile = ".env.e2e";
const hasE2eEnvFile = existsSync(e2eEnvFile);
const tracerE2e = process.env.CHURCH_TASK_E2E_TRACER === "1";
const onboardingStackE2e = process.env.CHURCH_TASK_E2E_ONBOARDING_STACK === "1";

if (hasE2eEnvFile) {
  config({ path: e2eEnvFile, quiet: true });
}

const requiredEnvNames = ["VITE_CONVEX_URL", "VITE_CONVEX_SITE_URL"] as const;
const missingEnvNames = requiredEnvNames.filter((name) => !process.env[name]);
const allowsProcessE2eEnv = Boolean(process.env.CI);
const e2eEnvReady =
  tracerE2e ||
  onboardingStackE2e ||
  (missingEnvNames.length === 0 && (hasE2eEnvFile || allowsProcessE2eEnv));
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
const tracerPort = Number(process.env.E2E_TRACER_PORT ?? 2102);
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${tracerE2e ? tracerPort : e2ePort}`;
const newStackTestMatch = [
  /admin-collections\.spec\.ts$/,
  /invitations\.spec\.ts$/,
  /labels-new-stack\.spec\.ts$/,
  /onboarding-new-stack\.spec\.ts$/,
  /tasks-boards-new-stack\.spec\.ts$/,
  /teams-workflows-new-stack\.spec\.ts$/,
];
if (onboardingStackE2e) {
  process.env.CHURCH_TASK_E2E_API_URL = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 2103}`;
}
const repoRoot = process.cwd();
const webServerEnv = {
  ...process.env,
  PATH: process.env.PATH ?? "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin",
  SHELL: process.env.SHELL ?? "/bin/zsh",
};
const convexUrl = process.env.VITE_CONVEX_URL;
const convexSiteUrl = process.env.VITE_CONVEX_SITE_URL;
const shouldStartLocalConvex =
  !onboardingStackE2e && (convexUrl?.startsWith("http://127.0.0.1:") ?? false);
const webServers = [
  ...(onboardingStackE2e
    ? [
        {
          command: "bunx tsx scripts/start-e2e-onboarding-stack.ts",
          cwd: repoRoot,
          env: webServerEnv,
          url: baseURL,
          reuseExistingServer: false,
          timeout: 180_000,
        },
      ]
    : []),
  ...(shouldStartLocalConvex
    ? [
        {
          command: "bun run dev:e2e",
          cwd: `${repoRoot}/packages/backend`,
          env: webServerEnv,
          url: `${convexSiteUrl}/api/auth/get-session`,
          reuseExistingServer: false,
          timeout: 120_000,
        },
      ]
    : []),
  ...(!onboardingStackE2e
    ? [
        {
          command: "bun run dev -- --mode e2e --host 127.0.0.1",
          cwd: `${repoRoot}/apps/web`,
          env: {
            ...webServerEnv,
            VITE_PORT: String(e2ePort),
          },
          url: baseURL,
          reuseExistingServer: !shouldStartLocalConvex && !process.env.CI,
          timeout: 120_000,
        },
      ]
    : []),
];

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: tracerE2e || onboardingStackE2e ? false : !shouldStartLocalConvex,
  workers: tracerE2e || onboardingStackE2e || shouldStartLocalConvex ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /tracer\.spec\.ts$/,
      ...(onboardingStackE2e ? { testMatch: newStackTestMatch } : {}),
      use: { ...devices["Desktop Chrome"] },
    },
    ...(onboardingStackE2e
      ? []
      : [
          {
            name: "tracer",
            testMatch: /tracer\.spec\.ts$/,
            use: { ...devices["Desktop Chrome"] },
          },
        ]),
  ],
  ...(e2eEnvReady && !tracerE2e
    ? {
        webServer: webServers,
      }
    : {}),
});
