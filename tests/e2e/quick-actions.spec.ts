import { expect, test } from "@playwright/test";

import { completeOnboarding, signInWithOtp } from "./helpers";

test.skip(
  process.env.CHURCH_TASK_E2E_READY !== "1",
  process.env.CHURCH_TASK_E2E_SKIP_REASON ?? "E2E environment is not configured.",
);

test("opens Quick Actions and completes a copied create-task action", async ({
  page,
}, testInfo) => {
  const email = `quick-actions-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Quick Actions Church ${Date.now()}`;
  const taskTitle = `Quick Action Task ${Date.now()}`;

  await signInWithOtp(page, email);
  await completeOnboarding(page, churchName);

  await page.getByRole("button", { name: "Open quick actions" }).click();
  await expect(page.getByRole("dialog", { name: "Quick Actions Menu" })).toBeVisible();
  await expect(page.getByText("Quick Action", { exact: true })).toBeVisible();
  await expect(page.getByText("Big Actions", { exact: true })).not.toBeVisible();
  await page.getByRole("option", { name: "Create Task" }).click();

  const createTaskDialog = page.getByRole("dialog", { name: /New Task/ });
  await expect(createTaskDialog).toBeVisible();
  await createTaskDialog.getByPlaceholder("Task title").fill(taskTitle);
  await createTaskDialog.getByRole("button", { name: "Create Task" }).click();
  await expect(page).toHaveURL(/\/my-work$/);
  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Our Work" }).click();
  await expect(page.getByText(taskTitle).first()).toBeVisible();

  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  await expect(page.getByRole("dialog", { name: "Quick Actions Menu" })).toBeVisible();
  await expect(page.getByText("Invite Member", { exact: true })).toBeVisible();
});
