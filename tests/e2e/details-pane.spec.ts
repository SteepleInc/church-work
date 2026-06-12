import { expect, type Page, test } from "@playwright/test";

import { completeOnboarding, signInWithOtp } from "./helpers";

test.skip(
  process.env.CHURCH_TASK_E2E_READY !== "1",
  process.env.CHURCH_TASK_E2E_SKIP_REASON ?? "E2E environment is not configured.",
);

function getDetailsPaneSearchValue(page: Page) {
  return new URL(page.url()).searchParams.get("details-pane");
}

test("opens a Task details pane from URL state and supports reload/deep-link", async ({
  page,
  context,
}, testInfo) => {
  const email = `details-pane-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Details Pane Church ${Date.now()}`;
  const taskTitle = `Details Pane Task ${Date.now()}`;

  await signInWithOtp(page, email);
  await completeOnboarding(page, churchName);

  await page.getByRole("main").getByRole("button", { name: "Create Task" }).click();
  const createTaskDialog = page.getByRole("dialog", { name: /New Task/ });
  await createTaskDialog.getByPlaceholder("Task title").fill(taskTitle);
  await createTaskDialog.getByRole("button", { name: "Create Task" }).click();
  const taskCard = page.getByLabel(`Task card ${taskTitle}`);
  await expect(taskCard).toBeVisible();

  await taskCard.click();

  const detailsPane = page.getByRole("dialog", { name: "Details Pane" });
  await expect(detailsPane).toBeVisible();
  await expect(detailsPane.getByText("Task details", { exact: true })).toBeVisible();
  await expect(detailsPane.getByRole("heading", { name: taskTitle })).toBeVisible();

  const detailsPaneSearchValue = getDetailsPaneSearchValue(page);
  expect(detailsPaneSearchValue).toContain('"_tag":"task"');
  expect(detailsPaneSearchValue).toContain('"tab":"details"');

  const deepLinkUrl = page.url();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Details Pane" })).toBeVisible();
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();

  const deepLinkPage = await context.newPage();
  await deepLinkPage.goto(deepLinkUrl);
  await expect(deepLinkPage.getByRole("dialog", { name: "Details Pane" })).toBeVisible();
  await expect(deepLinkPage.getByRole("heading", { name: taskTitle })).toBeVisible();
});
