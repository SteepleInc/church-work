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

/**
 * Escape is a two-step exit whenever a text field inside the dialog holds focus:
 * the first press blurs the field, the second runs the close / "Save to drafts?"
 * sequence. Helper for the flows that just need to reach the close sequence
 * after typing (the two-Escape behaviour itself is asserted on its own below).
 */
async function pressEscapeToExit(page: import("@playwright/test").Page) {
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
}

test("create-Task quick action offers saving dirty work to drafts before closing", async ({
  page,
}, testInfo) => {
  const email = `discard-task-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Discard Task Church ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { churchName, email });
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  await expect(sidebar.getByRole("link", { name: /Drafts/ })).not.toBeVisible();

  const dialog = await openCreateTaskQuickAction(page);

  // Make the form dirty.
  await dialog.getByPlaceholder("Task title").fill("A task I might abandon");
  await expect(dialog.getByRole("button", { name: "Save as draft" })).toBeVisible();

  await dialog.getByPlaceholder("Task title").fill("");
  await expect(dialog.getByRole("button", { name: "Save as draft" })).not.toBeVisible();
  await dialog.getByPlaceholder("Task title").fill("A task I might abandon");

  // Escape is a two-step exit while a text field holds focus: the first press
  // just blurs the title (no prompt yet), and only the second runs the close
  // sequence — which prompts here because the form is dirty.
  await page.keyboard.press("Escape");
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).not.toBeVisible();
  await expect(dialog.getByPlaceholder("Task title")).not.toBeFocused();
  await page.keyboard.press("Escape");
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
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  await expect(sidebar.getByRole("link", { name: /Drafts/ })).not.toBeVisible();

  const dialog = await openCreateTaskQuickAction(page);
  await dialog.getByPlaceholder("Task title").fill("A task for later");
  await pressEscapeToExit(page);

  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Save" }).click();
  await expect(confirm).not.toBeVisible();
  await expect(dialog).not.toBeVisible();
  await expect(sidebar.getByRole("link", { name: /Drafts/ })).toBeVisible();
  await expect(sidebar.getByText("1", { exact: true })).toBeVisible();
});

test("Drafts page lists saved Task Drafts and supports discarding one or all", async ({
  page,
}, testInfo) => {
  const email = `drafts-page-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Drafts Page Church ${Date.now()}`;
  const firstTitle = `Draft one ${Date.now()}`;
  const secondTitle = `Draft two ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { churchName, email });

  for (const title of [firstTitle, secondTitle]) {
    const dialog = await openCreateTaskQuickAction(page);
    await dialog.getByPlaceholder("Task title").fill(title);
    await pressEscapeToExit(page);
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Save" }).click();
    await expect(confirm).not.toBeVisible();
    await expect(dialog).not.toBeVisible();
  }

  await page
    .locator('[data-sidebar="sidebar"]')
    .getByRole("link", { name: /Drafts/ })
    .click();
  await expect(
    page.locator('[data-sidebar="sidebar"]').getByText("2", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/drafts$/);
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await expect(page.getByText(firstTitle)).toBeVisible();
  await expect(page.getByText(secondTitle)).toBeVisible();

  const firstDraftCard = page.getByRole("button", { name: new RegExp(firstTitle) });
  await firstDraftCard.hover();
  await firstDraftCard.getByRole("button", { name: "Discard draft" }).click();
  const discardOneConfirm = page.getByRole("alertdialog");
  await expect(discardOneConfirm).toBeVisible();
  await discardOneConfirm.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.getByText("Draft discarded.")).toBeVisible();
  await expect(page.getByText(firstTitle)).not.toBeVisible();
  await expect(page.getByText(secondTitle)).toBeVisible();

  await page.getByRole("button", { name: "Discard all drafts" }).click();
  const discardAllConfirm = page.getByRole("alertdialog");
  await expect(discardAllConfirm).toBeVisible();
  await expect(discardAllConfirm.getByText("Discard all drafts?")).toBeVisible();
  await discardAllConfirm.getByRole("button", { name: "Discard all", exact: true }).click();
  await expect(page.getByText(secondTitle)).not.toBeVisible();
  await expect(page.getByText("No active drafts")).toBeVisible();
  await expect(
    page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: /Drafts/ }),
  ).not.toBeVisible();
});

test("Drafts page opens an existing Task Draft for rehydrated autosaved editing", async ({
  page,
}, testInfo) => {
  const email = `open-task-draft-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Open Task Draft Church ${Date.now()}`;
  const originalTitle = `Openable draft ${Date.now()}`;
  const editedTitle = `${originalTitle} edited`;

  await signInAndCompleteOnboarding(page, { churchName, email });

  const dialog = await openCreateTaskQuickAction(page);
  await dialog.getByPlaceholder("Task title").fill(originalTitle);
  await pressEscapeToExit(page);
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Save" }).click();
  await expect(dialog).not.toBeVisible();

  await page
    .locator('[data-sidebar="sidebar"]')
    .getByRole("link", { name: /Drafts/ })
    .click();
  await expect(page).toHaveURL(/\/drafts$/);
  await page.getByText(originalTitle).click();

  const draftDialog = page.getByRole("dialog", { name: /Task Draft/ });
  await expect(draftDialog).toBeVisible();
  await expect(draftDialog.getByText("Draft")).toBeVisible();
  await expect(draftDialog.getByPlaceholder("Task title")).toHaveValue(originalTitle);

  await draftDialog.getByPlaceholder("Task title").fill(editedTitle);
  await expect(page.getByRole("heading", { exact: true, name: editedTitle })).toBeVisible({
    timeout: 15_000,
  });

  // First Escape blurs the title, the second closes the draft dialog. A Draft
  // autosaves, so closing never prompts.
  await page.keyboard.press("Escape");
  await expect(draftDialog.getByPlaceholder("Task title")).not.toBeFocused();
  await expect(draftDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await expect(draftDialog).not.toBeVisible();
  await expect(page.getByText(editedTitle)).toBeVisible();
  await expect(page.getByRole("heading", { exact: true, name: originalTitle })).not.toBeVisible();
});

test("creating a Task from an opened Draft removes the Draft card", async ({ page }, testInfo) => {
  const email = `create-from-draft-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Create From Draft Church ${Date.now()}`;
  const draftTitle = `Draft to create ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { churchName, email });

  const dialog = await openCreateTaskQuickAction(page);
  await dialog.getByPlaceholder("Task title").fill(draftTitle);
  await pressEscapeToExit(page);
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Save" }).click();
  await expect(dialog).not.toBeVisible();

  await page
    .locator('[data-sidebar="sidebar"]')
    .getByRole("link", { name: /Drafts/ })
    .click();
  await expect(page).toHaveURL(/\/drafts$/);
  await expect(page.getByText(draftTitle)).toBeVisible();

  await page.getByText(draftTitle).click();
  const draftDialog = page.getByRole("dialog", { name: /Task Draft/ });
  await expect(draftDialog).toBeVisible();
  await draftDialog.getByRole("button", { name: "Create Task" }).click();

  await expect(draftDialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/drafts$/);
  await expect(page.getByText(draftTitle)).not.toBeVisible();
  await expect(page.getByText("No active drafts")).toBeVisible();
});

test("create-Task quick action closes a pristine draft without prompting", async ({
  page,
}, testInfo) => {
  const email = `discard-task-clean-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Clean Task Church ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { churchName, email });

  const dialog = await openCreateTaskQuickAction(page);

  // The title autofocuses on open, so the first Escape only blurs it — the
  // dialog stays open and never prompts (the form is pristine).
  const title = dialog.getByPlaceholder("Task title");
  await expect(title).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(title).not.toBeFocused();
  await expect(dialog).toBeVisible();

  // With nothing focused, the second Escape closes immediately — no
  // confirmation, since there are no unsaved edits.
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
