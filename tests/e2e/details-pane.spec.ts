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

  // The pane subtitle shows the Task Identifier (e.g. "KID-1"), which is also
  // what the URL state carries instead of the database id (ADR 0013).
  const identifierLocator = detailsPane.getByText(/^[A-Z0-9]+-\d+$/);
  await expect(identifierLocator).toBeVisible();
  const taskIdentifier = (await identifierLocator.textContent())!;

  const detailsPaneSearchValue = getDetailsPaneSearchValue(page);
  expect(detailsPaneSearchValue).toContain('"_tag":"task"');
  expect(detailsPaneSearchValue).toContain('"tab":"details"');
  expect(detailsPaneSearchValue).toContain(`"id":"${taskIdentifier}"`);

  const deepLinkUrl = page.url();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Details Pane" })).toBeVisible();
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();

  const deepLinkPage = await context.newPage();
  await deepLinkPage.goto(deepLinkUrl);
  await expect(deepLinkPage.getByRole("dialog", { name: "Details Pane" })).toBeVisible();
  await expect(deepLinkPage.getByRole("heading", { name: taskTitle })).toBeVisible();

  // A lowercase identifier resolves case-insensitively and the URL state
  // normalizes to the canonical uppercase Task Identifier (ADR 0013).
  const lowercaseUrl = deepLinkUrl.replace(taskIdentifier, taskIdentifier.toLowerCase());
  const normalizePage = await context.newPage();
  await normalizePage.goto(lowercaseUrl);
  await expect(normalizePage.getByRole("dialog", { name: "Details Pane" })).toBeVisible();
  await expect(normalizePage.getByRole("heading", { name: taskTitle })).toBeVisible();
  await expect
    .poll(() => getDetailsPaneSearchValue(normalizePage))
    .toContain(`"id":"${taskIdentifier}"`);
});
