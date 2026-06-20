import { expect, test } from "@playwright/test";

import {
  openTemplateCreate,
  selectTemplateShape,
  signInAndCompleteOnboarding,
  stepperNext,
} from "./helpers";

test.skip(
  process.env.CHURCH_TASK_E2E_READY !== "1",
  process.env.CHURCH_TASK_E2E_SKIP_REASON ?? "E2E environment is not configured.",
);

async function gotoTemplates(page: import("@playwright/test").Page) {
  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Templates" }).click();
  await expect(page).toHaveURL(/\/templates$/);
}

test("authors and schedules a weekly service Template", async ({ page }, testInfo) => {
  const email = `templates-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Templates Church ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { churchName, email });

  await gotoTemplates(page);

  // The Collection starts empty and prompts creating the first Template.
  await expect(page.getByText("No Templates yet")).toBeVisible({ timeout: 20_000 });

  await openTemplateCreate(page);
  await selectTemplateShape(page, "Weekly service");
  await expect(page.getByRole("heading", { name: "New Weekly Service Template" })).toBeVisible();

  // Step 1: Details (name).
  await page.getByLabel("Template name").fill("Sunday Service Template");
  await stepperNext(page);

  // Step 2: Schedule (service weekday).
  await page.getByRole("button", { exact: true, name: "Sun" }).click();
  await stepperNext(page);

  // Step 3: Tasks.
  await page.getByRole("button", { name: "Add Template Task" }).first().click();
  await page.getByPlaceholder("Template Task title").fill("Plan worship set");
  await expect(page.getByText("1 Template Task")).toBeVisible();
  await stepperNext(page);

  // Step 4: Save.
  await expect(page.getByText("Repeats every week")).toBeVisible();
  await page.getByRole("button", { name: "Save and schedule" }).click();

  await expect(page.getByText(/Template saved/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { exact: true, name: "Done" }).click();

  // The new Template now appears in the Collection.
  await expect(page.getByRole("link", { name: "Sunday Service Template" })).toBeVisible({
    timeout: 20_000,
  });

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

test("soft-deletes and restores a scheduled Template from the Library", async ({
  page,
}, testInfo) => {
  test.slow();

  const email = `templates-delete-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Template Delete Church ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { churchName, email });

  await gotoTemplates(page);

  await openTemplateCreate(page);
  await selectTemplateShape(page, "Weekly service");
  await page.getByLabel("Template name").fill("Template To Restore");
  await stepperNext(page);
  await page.getByRole("button", { exact: true, name: "Sun" }).click();
  await stepperNext(page);
  await page.getByRole("button", { name: "Add Template Task" }).first().click();
  await page.getByPlaceholder("Template Task title").fill("Prepare restoration plan");
  await stepperNext(page);
  await page.getByRole("button", { name: "Save and schedule" }).click();
  await expect(page.getByText(/Template saved/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { exact: true, name: "Done" }).click();

  await page.getByRole("tab", { exact: true, name: "Library" }).click();
  await expect(page).toHaveURL(/\/templates\/library$/);
  const templateCard = page.getByRole("link", { name: /Template To Restore/ }).locator("..");
  await expect(templateCard).toBeVisible({ timeout: 20_000 });

  await templateCard.hover();
  await templateCard
    .getByRole("button", { name: "Template actions for Template To Restore" })
    .click();
  await page.getByRole("menuitem", { name: "Delete Template" }).click();

  await expect(page.getByRole("heading", { name: "Delete “Template To Restore”?" })).toBeVisible();
  await expect(page.getByText("stops projecting future work")).toBeVisible();
  await page.getByRole("button", { name: "Delete Template" }).click();

  await expect(page.getByText("Template deleted")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: /Template To Restore/ })).toBeHidden({
    timeout: 20_000,
  });

  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("Template To Restore restored")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: /Template To Restore/ })).toBeVisible({
    timeout: 20_000,
  });
});

test("duplicates a scheduled Template from the Library", async ({ page }, testInfo) => {
  test.slow();

  const email = `templates-duplicate-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Template Duplicate Church ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { churchName, email });

  await gotoTemplates(page);

  await openTemplateCreate(page);
  await selectTemplateShape(page, "Weekly service");
  await page.getByLabel("Template name").fill("Template To Duplicate");
  await stepperNext(page);
  await page.getByRole("button", { exact: true, name: "Sun" }).click();
  await stepperNext(page);
  await page.getByRole("button", { name: "Add Template Task" }).first().click();
  await page.getByPlaceholder("Template Task title").fill("Prepare duplicate plan");
  await stepperNext(page);
  await page.getByRole("button", { name: "Save and schedule" }).click();
  await expect(page.getByText(/Template saved/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { exact: true, name: "Done" }).click();

  await page.getByRole("tab", { exact: true, name: "Library" }).click();
  await expect(page).toHaveURL(/\/templates\/library$/);
  const templateCard = page.getByRole("link", { name: /Template To Duplicate/ }).locator("..");
  await expect(templateCard).toBeVisible({ timeout: 20_000 });

  await templateCard.hover();
  await templateCard
    .getByRole("button", { name: "Template actions for Template To Duplicate" })
    .click();
  await page.getByRole("menuitem", { name: "Duplicate Template" }).click();

  await expect(page.getByText("Template To Duplicate duplicated")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: /Template To Duplicate Copy/ })).toBeVisible({
    timeout: 20_000,
  });
});

test("authors and schedules a Key Date Template", async ({ page }, testInfo) => {
  const email = `key-date-template-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Key Date Templates Church ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { churchName, email });

  await gotoTemplates(page);

  await openTemplateCreate(page);
  await selectTemplateShape(page, "Key Date");
  await expect(page.getByRole("heading", { name: "New Key Date Template" })).toBeVisible();

  // Step 1: Name.
  await page.getByLabel("Key Date Template name").fill("Easter Prep Template");
  await stepperNext(page);

  // Step 2: Key Date.
  await page.getByRole("button", { name: "Select Key Date" }).click();
  await page.getByRole("button", { name: /Easter/ }).click();
  await expect(page.getByText("Next occurrence")).toBeVisible();
  await stepperNext(page);

  // Step 3: Tasks.
  await page.getByRole("button", { name: "Add Template Task" }).first().click();
  await page.getByPlaceholder("Template Task title").fill("Prepare Easter volunteers");
  await expect(page.getByText("1 Template Task")).toBeVisible();
  await stepperNext(page);

  // Step 4: Save.
  await expect(page.getByText("Repeats every year")).toBeVisible();
  await page.getByRole("button", { name: "Save and schedule" }).click();

  await expect(page.getByText(/Template saved and scheduled for Easter/)).toBeVisible({
    timeout: 20_000,
  });
});

test("authors a monthly period Template shape", async ({ page }, testInfo) => {
  const email = `period-templates-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Period Templates Church ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { churchName, email });

  await gotoTemplates(page);

  await openTemplateCreate(page);
  await selectTemplateShape(page, "Monthly");
  await expect(page.getByRole("heading", { name: "New Monthly Template" })).toBeVisible();

  // Step 1: Details (period shapes show the name + a shape switcher).
  await page.getByLabel("Template name").fill("Monthly Ops Template");
  await stepperNext(page);

  // Step 2: Schedule shows the normalized five-Cycle month frame.
  await expect(page.getByText("5 Cycles").first()).toBeVisible();
  await stepperNext(page);

  // Step 3: Tasks.
  await page.getByRole("button", { name: "Add Template Task" }).first().click();
  await page.getByPlaceholder("Template Task title").fill("Prepare monthly report");
  await expect(page.getByText("1 Template Task")).toBeVisible();
  await stepperNext(page);

  // Step 4: Save.
  await expect(page.getByText("Repeats every month")).toBeVisible();
  await page.getByRole("button", { name: /Save (and schedule|Template)/ }).click();
  await expect(page.getByText(/Template saved/)).toBeVisible({ timeout: 20_000 });
});
