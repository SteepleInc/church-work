import { defineConfig, devices } from "@playwright/test";

const tracerE2e = process.env.CHURCH_TASK_E2E_TRACER === "1";
const onboardingStackE2e = process.env.CHURCH_TASK_E2E_ONBOARDING_STACK === "1";

process.env.CHURCH_TASK_E2E_READY = "1";
process.env.CHURCH_TASK_E2E_SKIP_REASON = "";

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
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ]
    : []),
];

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: tracerE2e || onboardingStackE2e ? false : undefined,
  workers: tracerE2e || onboardingStackE2e ? 1 : undefined,
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
  ...(!tracerE2e
    ? {
        webServer: webServers,
      }
    : {}),
});
