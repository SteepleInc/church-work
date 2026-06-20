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
  await page.getByRole("button", { exact: true, name: "Sun" }).click();
  await page.getByRole("button", { name: "Add Template Task" }).first().click();
  await page.getByPlaceholder("Template Task title").fill("Plan worship set");

  await expect(page.getByText("1 Template Task")).toBeVisible();
  await expect(page.getByText("Repeats every week")).toBeVisible();
  await page.getByRole("button", { name: "Save and schedule" }).click();

  await expect(page.getByText(/Template saved/)).toBeVisible({ timeout: 20_000 });

  const sidebar = page.locator('[data-sidebar="sidebar"]');
  const worshipTeamItem = sidebar.locator('[data-sidebar="menu-item"]', {
    has: page.getByRole("link", { name: "Worship" }),
  });
  const expandButton = worshipTeamItem.getByRole("button", { name: "Expand Worship" });
  if (await expandButton.isVisible().catch(() => false)) await expandButton.click();
  await worshipTeamItem.getByRole("link", { name: "Current" }).click();

  const projectedTask = page.getByLabel("Task card Plan worship set");
  await expect(projectedTask).toBeVisible({ timeout: 20_000 });
  await expect(projectedTask).toContainText("Sunday Service Template");
  await expect(projectedTask).toContainText(/Sunday \w{3} \d{1,2}/);
  await expect(
    projectedTask.getByLabel(/From Template Schedule Sunday Service Template/),
  ).toBeVisible();

  await projectedTask.getByRole("combobox", { name: "Change estimate" }).click();
  await page.getByRole("option", { exact: true, name: "L" }).click();
  await expect(projectedTask.getByLabel("Adjusted for this Cycle")).toBeVisible({
    timeout: 20_000,
  });

  await page.reload();
  const adjustedProjectedTask = page.getByLabel("Task card Plan worship set");
  await expect(adjustedProjectedTask.getByLabel("Adjusted for this Cycle")).toBeVisible({
    timeout: 20_000,
  });
  await expect(adjustedProjectedTask.getByLabel("Estimate: L")).toBeVisible();
});

test("authors and schedules a Key Date Template", async ({ page }, testInfo) => {
  const email = `key-date-template-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Key Date Templates Church ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { churchName, email });

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Templates" }).click();
  await expect(page).toHaveURL(/\/templates$/);

  await page.getByRole("button", { name: /Key Date Template shape/ }).click();
  await expect(page.getByRole("heading", { name: "New Key Date Template" })).toBeVisible();

  await page.getByLabel("Key Date Template name").fill("Easter Prep Template");
  await page.getByRole("button", { name: "Select Key Date" }).click();
  await page.getByRole("button", { name: /Easter/ }).click();
  await expect(page.locator("dt").filter({ hasText: /^Next occurrence$/ })).toBeVisible();

  await page.getByRole("button", { name: "Add Template Task" }).first().click();
  await page.getByPlaceholder("Template Task title").fill("Prepare Easter volunteers");

  await expect(page.getByText("1 Template Task")).toBeVisible();
  await expect(page.getByText("Repeats every year")).toBeVisible();
  await page.getByRole("button", { name: "Save and schedule" }).click();

  await expect(page.getByText(/Template saved and scheduled for Easter/)).toBeVisible({
    timeout: 20_000,
  });
});

test("authors monthly, quarterly, and yearly period Template shapes", async ({
  page,
}, testInfo) => {
  const email = `period-templates-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Period Templates Church ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { churchName, email });

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Templates" }).click();
  await expect(page).toHaveURL(/\/templates$/);

  await page.getByRole("button", { name: /Monthly Template shape/ }).click();
  await expect(page.getByRole("heading", { name: "New monthly Template" })).toBeVisible();
  await expect(page.getByText("5 Cycles").first()).toBeVisible();
  await expect(page.getByText("Repeats every month")).toBeVisible();
  await page.getByRole("button", { name: "Add Template Task" }).first().click();
  await page.getByPlaceholder("Template Task title").fill("Prepare monthly report");
  await expect(page.getByText("1 Template Task")).toBeVisible();

  await page.getByRole("button", { name: /Quarterly Template shape/ }).click();
  await expect(page.getByRole("heading", { name: "New quarterly Template" })).toBeVisible();
  await expect(page.getByText("13 Cycles").first()).toBeVisible();
  await expect(page.getByText("Repeats every quarter")).toBeVisible();

  await page.getByRole("button", { name: /Yearly Template shape/ }).click();
  await expect(page.getByRole("heading", { name: "New yearly Template" })).toBeVisible();
  await expect(page.getByText("52 Cycles").first()).toBeVisible();
  await expect(page.getByText("Nearest one-off this year")).toBeVisible();
  await page.getByText("Repeat every year").click();
  await expect(page.getByText("Repeats every year")).toBeVisible();

  await page.getByRole("button", { name: "Save and schedule" }).click();
  await expect(page.getByText(/Template saved/)).toBeVisible({ timeout: 20_000 });
});
