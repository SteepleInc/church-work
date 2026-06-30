import { expect, test } from "@playwright/test";

import { openTemplateCreate, selectTemplateShape, signInAndCompleteOnboarding } from "./helpers";

test.skip(
  process.env.CHURCH_WORK_E2E_READY !== "1",
  process.env.CHURCH_WORK_E2E_SKIP_REASON ?? "E2E environment is not configured.",
);

/**
 * Closing a create surface that holds unsaved edits raises an "are you sure"
 * confirmation; closing a pristine one skips the prompt and closes immediately.
 * Covers both the create-Task quick action and the create-Template big action.
 */

async function openCreateTaskQuickAction(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Open quick actions" }).click();
  await expect(page.getByRole("dialog", { name: "Quick Actions Menu" })).toBeVisible();
  await page.getByRole("option", { name: "Create Task" }).click();
  const dialog = page.getByRole("dialog", { name: /New Task/ });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("create-Task quick action offers saving dirty work to drafts before closing", async ({
  page,
}, testInfo) => {
  const email = `discard-task-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Discard Task Church ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { churchName, email });

  const dialog = await openCreateTaskQuickAction(page);

  // Make the form dirty.
  await dialog.getByPlaceholder("Task title").fill("A task I might abandon");
  await expect(dialog.getByRole("button", { name: "Save as draft" })).toBeVisible();

  await dialog.getByPlaceholder("Task title").fill("");
  await expect(dialog.getByRole("button", { name: "Save as draft" })).not.toBeVisible();
  await dialog.getByPlaceholder("Task title").fill("A task I might abandon");

  // Escape requests a close, which prompts because the form is dirty.
  await page.keyboard.press("Escape");
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await expect(confirm.getByText("Save to drafts?")).toBeVisible();
  await expect(confirm.getByText("You can finish this task later from your drafts.")).toBeVisible();

  // "Cancel" dismisses the prompt and leaves the draft intact.
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).not.toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder("Task title")).toHaveValue("A task I might abandon");

  // Closing via the header X also prompts, and "Discard" closes for good.
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Discard" }).click();
  await expect(confirm).not.toBeVisible();
  await expect(dialog).not.toBeVisible();

  // Reopening starts clean — the discarded title is gone.
  const reopened = await openCreateTaskQuickAction(page);
  await expect(reopened.getByPlaceholder("Task title")).toHaveValue("");
});

test("create-Task quick action saves dirty work from the close dialog", async ({
  page,
}, testInfo) => {
  const email = `save-task-draft-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Save Task Draft Church ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { churchName, email });

  const dialog = await openCreateTaskQuickAction(page);
  await dialog.getByPlaceholder("Task title").fill("A task for later");
  await page.keyboard.press("Escape");

  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/zero/mutate") && response.request().method() === "POST",
  );
  await confirm.getByRole("button", { name: "Save" }).click();
  await expect.poll(async () => (await saveResponse).ok()).toBe(true);
  await expect(confirm).not.toBeVisible();
  await expect(dialog).not.toBeVisible();
});

test("create-Task quick action closes a pristine draft without prompting", async ({
  page,
}, testInfo) => {
  const email = `discard-task-clean-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Clean Task Church ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { churchName, email });

  const dialog = await openCreateTaskQuickAction(page);

  // No edits: Escape closes immediately, no confirmation.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await expect(dialog).not.toBeVisible();
});

async function gotoTemplates(page: import("@playwright/test").Page) {
  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Templates" }).click();
  await expect(page).toHaveURL(/\/templates$/);
}

test("create-Template big action confirms before discarding unsaved edits", async ({
  page,
}, testInfo) => {
  const email = `discard-template-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Discard Template Church ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { churchName, email });

  await gotoTemplates(page);
  await openTemplateCreate(page);
  await selectTemplateShape(page, "Weekly service");
  await expect(page.getByRole("heading", { name: "New Template" })).toBeVisible();

  // Make the flow dirty by naming the Template.
  await page.getByLabel("Template name").fill("Template I might abandon");

  // Escape prompts because there are unsaved edits.
  await page.keyboard.press("Escape");
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await expect(confirm.getByText("Discard changes?")).toBeVisible();

  // "Keep editing" returns to the flow untouched.
  await confirm.getByRole("button", { name: "Keep editing" }).click();
  await expect(confirm).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "New Template" })).toBeVisible();
  await expect(page.getByLabel("Template name")).toHaveValue("Template I might abandon");

  // Discard closes the big action for good.
  await page.keyboard.press("Escape");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Discard" }).click();
  await expect(confirm).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "New Template" })).not.toBeVisible();
  await expect(page).toHaveURL(/\/templates$/);
});

test("create-Template big action closes a pristine flow without prompting", async ({
  page,
}, testInfo) => {
  const email = `discard-template-clean-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Clean Template Church ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { churchName, email });

  await gotoTemplates(page);
  await openTemplateCreate(page);
  // The shape picker is on screen but nothing has been entered yet.
  await expect(page.getByRole("heading", { name: "Template shape" })).toBeVisible();

  // No edits: Escape closes immediately, no confirmation.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "New Template" })).not.toBeVisible();
  await expect(page).toHaveURL(/\/templates$/);
});
