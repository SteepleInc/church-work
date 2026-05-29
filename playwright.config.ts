import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.e2e" });

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
