import { expect, test } from "@playwright/test";

import {
  promoteCurrentUserToAppAdmin,
  signInWithOtp,
  signOut,
  startAuthenticatedSession,
} from "./helpers";

test.skip(
  process.env.CHURCH_TASK_E2E_READY !== "1",
  process.env.CHURCH_TASK_E2E_SKIP_REASON ?? "E2E environment is not configured.",
);

test("App Administration collections show cross-Church data while normal members stay isolated", async ({
  page,
}, testInfo) => {
  const runId = `${Date.now()}-${testInfo.workerIndex}`;
  const otherEmail = `collection-other-${runId}@example.com`;
  const otherChurch = `E2E Collection Other ${runId}`;
  const primaryEmail = `collection-primary-${runId}@example.com`;
  const primaryChurch = `E2E Collection Primary ${runId}`;

  await startAuthenticatedSession(page, {
    churchName: otherChurch,
    email: otherEmail,
    userName: `Other Member ${runId}`,
  });
  await signOut(page);

  await startAuthenticatedSession(page, {
    churchName: primaryChurch,
    email: primaryEmail,
    userName: `Primary Member ${runId}`,
  });

  await page.getByRole("button", { name: new RegExp(primaryChurch) }).click();
  await expect(page.getByRole("menuitem", { name: new RegExp(otherChurch) })).not.toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/admin/orgs");
  await expect(page.getByRole("heading", { name: "Access Restricted" })).toBeVisible();
  await expect(page.getByText("App Administrator access required")).toBeVisible();
  await expect(page.getByText(otherChurch)).not.toBeVisible();

  await promoteCurrentUserToAppAdmin(page);
  await signOut(page);
  await signInWithOtp(page, primaryEmail);

  await page.goto("/admin/orgs");
  await expect(page.getByRole("table").getByText(primaryChurch)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("table").getByText(otherChurch)).toBeVisible({ timeout: 20_000 });

  await page.goto("/admin/users");
  const usersTable = page.getByRole("table");
  await expect(usersTable.getByText(primaryEmail)).toBeVisible({ timeout: 20_000 });
  await expect(usersTable.getByText(otherEmail)).toBeVisible({ timeout: 20_000 });
  await expect(usersTable.getByText(primaryChurch)).toBeVisible({ timeout: 20_000 });
  await expect(usersTable.getByText(otherChurch)).toBeVisible({ timeout: 20_000 });
});
