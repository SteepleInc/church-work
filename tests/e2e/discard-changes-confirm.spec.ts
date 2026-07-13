import { randomUUID } from "node:crypto";

import { expect } from "@playwright/test";

import { createAuthenticatedTest } from "./authenticated-test";
import { openTemplateCreate, selectTemplateShape } from "./helpers";

const test = createAuthenticatedTest({
  churchNamePrefix: "E2E Discard Changes Church",
  emailPrefix: "discard-changes",
  mode: "test-session",
  userName: "E2E Discard Changes Owner",
});

test.skip(
  process.env.CHURCH_WORK_E2E_READY !== "1",
  process.env.CHURCH_WORK_E2E_SKIP_REASON ?? "E2E environment is not configured.",
);

test.beforeEach(async ({ page }) => {
  await page.goto("/my-work");
  await expect(page.getByRole("button", { name: "Open quick actions" })).toBeVisible();

  const draftsLink = page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: /Drafts/ });
  const hasDrafts = await draftsLink.waitFor({ state: "visible", timeout: 2_000 }).then(
    () => true,
    () => false,
  );
  if (!hasDrafts) return;

  await draftsLink.click();
  await expect(page).toHaveURL(/\/drafts$/);

  const discardAll = page.getByRole("button", { name: "Discard all drafts" });
  const emptyState = page.getByText("No active drafts");
  await expect(discardAll).toBeVisible({ timeout: 20_000 });
  await discardAll.click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Discard all", exact: true }).click();
  await expect(emptyState).toBeVisible();
  await page.goto("/my-work");
});

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
}) => {
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

test("create-Task quick action saves dirty work from the close dialog", async ({ page }) => {
  const title = `A task for later ${randomUUID()}`;
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  await expect(sidebar.getByRole("link", { name: /Drafts/ })).not.toBeVisible();

  const dialog = await openCreateTaskQuickAction(page);
  await dialog.getByPlaceholder("Task title").fill(title);
  await pressEscapeToExit(page);

  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Save" }).click();
  await expect(confirm).not.toBeVisible();
  await expect(dialog).not.toBeVisible();
  await expect(sidebar.getByRole("link", { name: /Drafts/ })).toBeVisible();
  await expect(sidebar.getByText("1", { exact: true })).toBeVisible();
});

test("Drafts page lists saved Task Drafts and supports discarding one or all", async ({ page }) => {
  const suffix = randomUUID();
  const firstTitle = `Draft one ${suffix}`;
  const secondTitle = `Draft two ${suffix}`;

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

  const firstDraftCard = page.getByRole("button", {
    name: new RegExp(firstTitle),
  });
  await firstDraftCard.hover();
  await firstDraftCard.getByRole("button", { name: "Discard draft" }).click();
  const discardOneConfirm = page.getByRole("alertdialog");
  await expect(discardOneConfirm).toBeVisible();
  await discardOneConfirm.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.getByText("Draft discarded.")).toBeVisible();
  await expect(page.getByText(firstTitle)).not.toBeVisible();
  await expect(page.getByText(secondTitle)).toBeVisible();

  // Undo exercises the restore mutator and returns the optimistically hidden
  // Draft to both the list and sidebar count before the bulk-discard flow.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText(firstTitle)).toBeVisible();
  await expect(
    page.locator('[data-sidebar="sidebar"]').getByText("2", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Discard all drafts" }).click();
  const discardAllConfirm = page.getByRole("alertdialog");
  await expect(discardAllConfirm).toBeVisible();
  await expect(discardAllConfirm.getByText("Discard all drafts?")).toBeVisible();
  await discardAllConfirm.getByRole("button", { name: "Discard all", exact: true }).click();
  await expect(page.getByText(firstTitle)).not.toBeVisible();
  await expect(page.getByText(secondTitle)).not.toBeVisible();
  await expect(page.getByText("No active drafts")).toBeVisible();
  await expect(
    page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: /Drafts/ }),
  ).not.toBeVisible();
});

test("Drafts page opens an existing Task Draft for rehydrated autosaved editing", async ({
  page,
}) => {
  const originalTitle = `Openable draft ${randomUUID()}`;
  const editedTitle = `${originalTitle} edited`;

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

  // First Escape blurs the title, the second closes the draft dialog. A Draft
  // autosaves, so closing never prompts.
  await page.keyboard.press("Escape");
  await expect(draftDialog.getByPlaceholder("Task title")).not.toBeFocused();
  await expect(draftDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await expect(draftDialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(editedTitle) })).toBeVisible();
  await expect(page.getByRole("heading", { exact: true, name: originalTitle })).not.toBeVisible();
});

test("creating a Task from an opened Draft removes the Draft card", async ({ page }) => {
  const draftTitle = `Draft to create ${randomUUID()}`;

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

test("create-Task quick action closes a pristine draft without prompting", async ({ page }) => {
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

test("create-Template big action confirms before discarding unsaved edits", async ({ page }) => {
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

test("create-Template big action closes a pristine flow without prompting", async ({ page }) => {
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
