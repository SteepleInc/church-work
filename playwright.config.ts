import { defineConfig, devices } from "@playwright/test";

const onboardingStackE2e = process.env.CHURCH_TASK_E2E_ONBOARDING_STACK === "1";

process.env.CHURCH_TASK_E2E_READY = "1";
process.env.CHURCH_TASK_E2E_SKIP_REASON = "";

const e2ePort = Number(process.env.E2E_WEB_PORT ?? 32101);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${e2ePort}`;
const newStackTestMatch = [
  /admin-collections\.spec\.ts$/,
  /invitations\.spec\.ts$/,
  /labels-new-stack\.spec\.ts$/,
  /onboarding-new-stack\.spec\.ts$/,
  /task-details-pickers-new-stack\.spec\.ts$/,
  /task-hover-keybindings\.spec\.ts$/,
  /tasks-boards-new-stack\.spec\.ts$/,
  /templates-new-stack\.spec\.ts$/,
  /teams-workflows-new-stack\.spec\.ts$/,
];
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
  fullyParallel: onboardingStackE2e ? false : undefined,
  workers: onboardingStackE2e ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      ...(onboardingStackE2e ? { testMatch: newStackTestMatch } : {}),
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: webServers,
});
