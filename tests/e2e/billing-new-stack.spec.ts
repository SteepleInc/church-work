import { expect, test } from "@playwright/test";

import { startAuthenticatedSession } from "./helpers";

test.skip(
  process.env.CHURCH_WORK_E2E_ONBOARDING_STACK !== "1",
  "Run against the local Postgres/Zero onboarding stack.",
);

test.setTimeout(120_000);

test("shows a new Church owner the Church-scoped Free Plan", async ({ page }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;

  await startAuthenticatedSession(page, {
    churchName: `E2E Billing Church ${suffix}`,
    email: `billing-${suffix}@example.com`,
    userName: "E2E Billing Owner",
  });

  await page.goto("/settings/workspace/billing");

  await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Free Plan", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Upgrade to Paid" }).first()).toBeVisible();
  await expect(page.getByText("No active Church selected.")).not.toBeVisible();
});
