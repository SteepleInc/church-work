import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import { existsSync } from "node:fs";

const e2eEnvFile = ".env.e2e";

if (!existsSync(e2eEnvFile)) {
  throw new Error(
    `Missing ${e2eEnvFile}. Copy .env.e2e.example to ${e2eEnvFile} and point it at an isolated Convex deployment before running E2E tests.`,
  );
}

config({ path: e2eEnvFile, quiet: true });

for (const name of ["VITE_CONVEX_URL", "VITE_CONVEX_SITE_URL"] as const) {
  if (!process.env[name]) {
    throw new Error(
      `Missing ${name} in ${e2eEnvFile}. E2E tests must not fall back to normal development Convex state.`,
    );
  }
}

const e2ePort = Number(process.env.E2E_WEB_PORT ?? 2101);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
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
  webServer: {
    command: "bun run dev -- --mode e2e --host 127.0.0.1",
    cwd: "./apps/web",
    env: {
      ...process.env,
      VITE_PORT: String(e2ePort),
    },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
