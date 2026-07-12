import { randomUUID } from "node:crypto";

import { type BrowserContext, test as base } from "@playwright/test";

import { signInAndCompleteOnboarding, startAuthenticatedSession } from "./helpers";

type AuthenticatedUser = {
  churchName: string;
  email: string;
  storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  userName?: string;
};

type WorkerFixtures = {
  authenticatedUser: AuthenticatedUser;
};

export function createAuthenticatedTest(config: {
  churchNamePrefix: string;
  emailPrefix: string;
  mode: "onboarding" | "test-session";
  userName?: string;
}) {
  return base.extend<{}, WorkerFixtures>({
    authenticatedUser: [
      async ({ browser }, use, workerInfo) => {
        const context = await browser.newContext({
          baseURL: workerInfo.project.use.baseURL,
        });
        const page = await context.newPage();
        const suffix = `${Date.now()}-${workerInfo.workerIndex}-${randomUUID()}`;
        const authenticatedUser = {
          churchName: `${config.churchNamePrefix} ${suffix}`,
          email: `${config.emailPrefix}-${suffix}@example.com`,
          userName: config.userName,
        };

        try {
          if (config.mode === "onboarding") {
            await signInAndCompleteOnboarding(page, authenticatedUser);
          } else {
            await startAuthenticatedSession(page, authenticatedUser);
          }
          await use({
            ...authenticatedUser,
            storageState: await context.storageState(),
          });
        } finally {
          await context.close();
        }
      },
      { scope: "worker" },
    ],
    storageState: async ({ authenticatedUser }, use) => {
      await use(authenticatedUser.storageState);
    },
  });
}
