import { expect, type Locator, type Page, test } from "@playwright/test";

import { startAuthenticatedSession } from "./helpers";

// Sub-task creation and inline edits persist through Zero, so this needs the
// local Postgres/Zero stack booted by the onboarding-stack e2e run
// (CHURCH_TASK_E2E_ONBOARDING_STACK=1, set in .env.e2e).
test.skip(
  process.env.CHURCH_TASK_E2E_ONBOARDING_STACK !== "1",
  "Run with the onboarding stack (CHURCH_TASK_E2E_ONBOARDING_STACK=1) to boot the local Postgres/Zero stack.",
);

test.setTimeout(120_000);

const detailsPane = (page: Page) => page.getByRole("dialog", { name: "Details Pane" });
const subTasks = (page: Page) => detailsPane(page).getByRole("region", { name: "Sub-tasks" });

/** The row element (the one armed on hover) for a sub-task by its title. */
const subTaskRow = (page: Page, title: string) =>
  subTasks(page)
    .getByText(title, { exact: true })
    .locator("xpath=ancestor::*[@data-sub-task-row][1]");

async function createTask(page: Page, title: string, team: string) {
  await page.getByRole("main").getByRole("button", { name: "Create Task" }).click();
  const dialog = page.getByRole("dialog", { name: /New Task/ });
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder("Task title").fill(title);

  const teamPicker = dialog.getByLabel("Team");
  await expect(teamPicker).toBeVisible();
  await teamPicker.click();
  await page.getByRole("option", { name: team }).click();

  await dialog.getByRole("button", { name: "Create Task" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 20_000 });
}

/** Creates a Task and opens its details pane by clicking the board card. */
async function openTaskDetails(page: Page, title: string, team: string) {
  await createTask(page, title, team);
  const card = page.getByLabel(`Task card ${title}`);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.click();

  const pane = detailsPane(page);
  await expect(pane).toBeVisible();
  await expect(pane.getByRole("textbox", { name: "Task title" })).toHaveValue(title);
  return pane;
}

/**
 * Opens the inline creator from the always-present header "+ Add sub-task"
 * opener. On an empty section a second, large quiet opener also renders, so we
 * target the header button (the first match) to stay unambiguous.
 */
async function openCreator(page: Page): Promise<Locator> {
  await subTasks(page).getByRole("button", { name: "Add sub-task" }).first().click();
  const titleInput = subTasks(page).getByRole("textbox", { name: "Sub-task title" });
  await expect(titleInput).toBeVisible();
  return titleInput;
}

/**
 * Creates one sub-task via the inline creator, waits for its row, then closes
 * the creator so focus leaves its (editable) title input. The hover field
 * shortcuts bail on editable targets, so the creator must be closed before they
 * can be exercised.
 */
async function createSubTask(page: Page, title: string) {
  const titleInput = subTasks(page).getByRole("textbox", { name: "Sub-task title" });
  await titleInput.fill(title);
  await subTasks(page).getByRole("button", { name: "Create" }).click();
  await expect(subTasks(page).getByText(title, { exact: true })).toBeVisible({ timeout: 20_000 });
  // Close the still-open creator via Cancel (Escape would bubble to the pane and
  // close the whole details pane) so focus leaves its editable title input.
  await subTasks(page).getByRole("button", { name: "Cancel" }).click();
  await expect(titleInput).toHaveCount(0);
}

test.describe("Task details pane sub-tasks", () => {
  test("creates a sub-task and keeps the creator open and reset", async ({ page }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    await startAuthenticatedSession(page, {
      churchName: `E2E Sub-tasks Create Church ${suffix}`,
      email: `subtasks-create-${suffix}@example.com`,
      userName: "E2E Sub-tasks Owner",
    });

    await openTaskDetails(page, `Sub-tasks Parent ${suffix}`, "Worship");

    const titleInput = await openCreator(page);
    await titleInput.fill(`Child One ${suffix}`);
    await subTasks(page).getByRole("button", { name: "Create" }).click();

    // The new row appears and the creator stays open with the title cleared so
    // the next sub-task can be typed straight away (rapid-entry decision).
    await expect(subTasks(page).getByText(`Child One ${suffix}`, { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(titleInput).toHaveValue("");
    await expect(titleInput).toBeFocused();

    // The completion count reflects the single, not-yet-done sub-task.
    await expect(subTasks(page).getByRole("heading", { name: /Sub-tasks/ })).toContainText("0/1");

    // Escape closes only the creator (it stops propagation) — the details pane
    // stays open and the created row remains.
    await titleInput.press("Escape");
    await expect(titleInput).toHaveCount(0);
    await expect(detailsPane(page)).toBeVisible();
    await expect(subTasks(page).getByText(`Child One ${suffix}`, { exact: true })).toBeVisible();
  });

  test("Cmd/Ctrl+Enter creates without leaving the keyboard", async ({ page }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    await startAuthenticatedSession(page, {
      churchName: `E2E Sub-tasks Keyboard Church ${suffix}`,
      email: `subtasks-keyboard-${suffix}@example.com`,
      userName: "E2E Sub-tasks Keyboarder",
    });

    await openTaskDetails(page, `Sub-tasks Keyboard Parent ${suffix}`, "Worship");

    const titleInput = await openCreator(page);
    await titleInput.fill(`Keyboard Child ${suffix}`);
    await titleInput.press("ControlOrMeta+Enter");

    await expect(subTasks(page).getByText(`Keyboard Child ${suffix}`, { exact: true })).toBeVisible(
      {
        timeout: 20_000,
      },
    );
    await expect(titleInput).toHaveValue("");
    await expect(titleInput).toBeFocused();
  });

  test("multi-line paste into an empty title creates one sub-task per line", async ({
    page,
  }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    await startAuthenticatedSession(page, {
      churchName: `E2E Sub-tasks Paste Church ${suffix}`,
      email: `subtasks-paste-${suffix}@example.com`,
      userName: "E2E Sub-tasks Paster",
    });

    await openTaskDetails(page, `Sub-tasks Paste Parent ${suffix}`, "Worship");

    const titleInput = await openCreator(page);
    const lines = [`Paste A ${suffix}`, `Paste B ${suffix}`, `Paste C ${suffix}`];

    // Simulate a multi-line clipboard paste into the empty title field.
    await titleInput.focus();
    await titleInput.evaluate((node, text) => {
      const data = new DataTransfer();
      data.setData("text/plain", text);
      node.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true }));
    }, lines.join("\n"));

    for (const line of lines) {
      await expect(subTasks(page).getByText(line, { exact: true })).toBeVisible({
        timeout: 20_000,
      });
    }
    await expect(subTasks(page).getByRole("heading", { name: /Sub-tasks/ })).toContainText("0/3");
  });

  test("hovering a sub-task row arms its field shortcuts and open", async ({ page }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    await startAuthenticatedSession(page, {
      churchName: `E2E Sub-tasks Hover Church ${suffix}`,
      email: `subtasks-hover-${suffix}@example.com`,
      userName: "E2E Sub-tasks Hoverer",
    });

    await openTaskDetails(page, `Sub-tasks Hover Parent ${suffix}`, "Worship");
    await openCreator(page);
    const childTitle = `Hover Child ${suffix}`;
    await createSubTask(page, childTitle);

    const row = subTaskRow(page, childTitle);
    await expect(row).toBeVisible();

    // Hover the row (no click): it becomes the cursor and "S" opens *its* status
    // picker. The pane otherwise binds "S" to the parent Task, so the hovered
    // row winning here proves the arbitration works.
    await row.hover();
    await page.keyboard.press("KeyS");
    await expect(page.getByPlaceholder("Change status...")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder("Change status...")).toHaveCount(0);

    // The same hovered row answers the priority shortcut ("P").
    await row.hover();
    await page.keyboard.press("KeyP");
    await expect(page.getByPlaceholder("Change priority to...")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder("Change priority to...")).toHaveCount(0);

    // "O" on the hovered row opens that sub-task's details, swapping the pane to
    // the sub-task's Task Identifier (ADR 0013).
    const parentIdentifier = new URL(page.url()).searchParams.get("details-pane");
    await row.hover();
    await page.keyboard.press("KeyO");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("details-pane"), { timeout: 20_000 })
      .not.toBe(parentIdentifier);
    await expect(detailsPane(page).getByRole("textbox", { name: "Task title" })).toHaveValue(
      childTitle,
    );
  });

  test("inline status edit on a sub-task row persists", async ({ page }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    await startAuthenticatedSession(page, {
      churchName: `E2E Sub-tasks Edit Church ${suffix}`,
      email: `subtasks-edit-${suffix}@example.com`,
      userName: "E2E Sub-tasks Editor",
    });

    await openTaskDetails(page, `Sub-tasks Edit Parent ${suffix}`, "Worship");
    await openCreator(page);
    const childTitle = `Edit Child ${suffix}`;
    await createSubTask(page, childTitle);

    const row = subTaskRow(page, childTitle);
    await expect(row).toBeVisible();

    // Open the row's status picker via the hover shortcut and pick "In Progress".
    await row.hover();
    await page.keyboard.press("KeyS");
    await page.getByRole("option", { name: "In Progress" }).click();

    // Re-open the sub-task to confirm the change was written through Zero.
    await row.hover();
    await page.keyboard.press("KeyO");
    await expect(detailsPane(page).getByRole("textbox", { name: "Task title" })).toHaveValue(
      childTitle,
    );
    await expect(detailsPane(page).getByRole("combobox", { name: "Change status" })).toContainText(
      "In Progress",
    );
  });
});
