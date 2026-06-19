import { expect, test } from "@playwright/test";

import { signInAndCompleteOnboarding } from "./helpers";

test.skip(
  process.env.CHURCH_TASK_E2E_READY !== "1",
  process.env.CHURCH_TASK_E2E_SKIP_REASON ?? "E2E environment is not configured.",
);

test("authors and schedules a weekly service Template", async ({ page }, testInfo) => {
  const email = `templates-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Templates Church ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { churchName, email });

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Templates" }).click();
  await expect(page).toHaveURL(/\/templates$/);
  await expect(page.getByRole("heading", { name: "New weekly service Template" })).toBeVisible();

  await page.getByLabel("Template name").fill("Sunday Service Template");
  await page.getByRole("button", { name: "Sun" }).click();
  await page.getByRole("button", { name: "Add Template Task" }).first().click();
  await page.getByPlaceholder("Template Task title").fill("Plan worship set");

  await expect(page.getByText("1 Template Task")).toBeVisible();
  await expect(page.getByText("Repeats every week")).toBeVisible();
  await page.getByRole("button", { name: "Save and schedule" }).click();

  await expect(page.getByText(/Template saved/)).toBeVisible({ timeout: 20_000 });
});
