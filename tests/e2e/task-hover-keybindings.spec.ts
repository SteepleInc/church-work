import { randomUUID } from "node:crypto";

import { expect, type Locator, type Page } from "@playwright/test";

import { createAuthenticatedTest } from "./authenticated-test";

const test = createAuthenticatedTest({
  churchNamePrefix: "E2E Hover Keybindings Church",
  emailPrefix: "hover-keybindings",
  mode: "test-session",
  userName: "E2E Hover Keybindings Owner",
});

// Same gating as the other onboarding-stack specs: only runs against the local
// Postgres/Zero stack booted by `bun run test:e2e:hover-keybindings`.
test.skip(
  process.env.CHURCH_WORK_E2E_ONBOARDING_STACK !== "1",
  "Run with bun run test:e2e:hover-keybindings to boot the local Postgres/Zero onboarding stack.",
);

test.setTimeout(120_000);

test.beforeEach(async ({ page }) => {
  await page.goto("/my-work");
  await expect(page).toHaveURL(/\/my-work$/);
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
});

const taskCard = (page: Page, title: string) => page.getByLabel(`Task card ${title}`);

async function createTask(page: Page, title: string, options: { readonly team?: string } = {}) {
  await page.getByRole("main").getByRole("button", { name: "Create Task" }).click();
  const dialog = page.getByRole("dialog", { name: /New Task/ });
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder("Task title").fill(title);

  const teamPicker = dialog.getByLabel("Team");
  await expect(teamPicker).toBeVisible();
  if (options.team) {
    await teamPicker.click();
    await page.getByRole("option", { name: options.team }).click();
  }

  await dialog.getByRole("button", { name: "Create Task" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 20_000 });
}

/**
 * Hovering a Task card "arms" it (Linear-style), so document-level shortcuts act
 * on that card without clicking it. We assert behaviour, not CSS: a picker only
 * opens because the hovered card is the keyboard cursor.
 */
async function bootBoardWithTask(page: Page, title: string): Promise<Locator> {
  await createTask(page, title, { team: "Worship" });
  const card = taskCard(page, title);
  await expect(card).toBeVisible({ timeout: 20_000 });
  return card;
}

test.describe("Task card hover keybindings", () => {
  test("create-task draft surface keeps field shortcuts live without hijacking typing", async ({
    page,
  }) => {
    await page.getByRole("main").getByRole("button", { name: "Create Task" }).click();
    const dialog = page.getByRole("dialog", { name: /New Task/ });
    await expect(dialog).toBeVisible();

    // The create-Task dialog is a single focused modal, so its field shortcuts
    // are live the whole time it is open (armMode="always") — no hover needed.
    // But typing in editable fields must never be stolen by property shortcuts
    // ("P" would otherwise open Priority).
    const title = dialog.getByPlaceholder("Task title");
    await title.pressSequentially("Plan practice");
    await expect(title).toHaveValue("Plan practice");
    await expect(page.getByPlaceholder("Change priority to...")).toHaveCount(0);

    // Once focus leaves the input, the dialog answers shared Task field
    // shortcuts even though nothing is hovered — the whole modal is the cursor.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("KeyP");
    await expect(page.getByPlaceholder("Change priority to...")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder("Change priority to...")).toHaveCount(0);

    // A different field key opens a different picker, still with nothing hovered.
    await page.keyboard.press("KeyA");
    await expect(page.getByPlaceholder("Assign to...")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder("Assign to...")).toHaveCount(0);

    // The same surface owns the shared context menu.
    const surface = dialog.locator('[data-task-draft-property-surface="true"]');
    await surface.click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: /Status/ })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Priority/ })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("Escape blurs a focused field before it exits the create-Task dialog", async ({ page }) => {
    await page.getByRole("main").getByRole("button", { name: "Create Task" }).click();
    const dialog = page.getByRole("dialog", { name: /New Task/ });
    await expect(dialog).toBeVisible();

    // The title autofocuses on open. The first Escape only blurs it — the dialog
    // stays open — so that the field shortcuts become live with the caret out of
    // the way.
    const title = dialog.getByPlaceholder("Task title");
    await expect(title).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(title).not.toBeFocused();
    await expect(dialog).toBeVisible();

    // With nothing focused, a bare field key now opens its picker (proving the
    // blur handed control to the always-live dialog shortcuts, not a close).
    await page.keyboard.press("KeyP");
    await expect(page.getByPlaceholder("Change priority to...")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder("Change priority to...")).toHaveCount(0);
    await expect(dialog).toBeVisible();

    // Re-focusing the description and pressing Escape blurs it the same way — one
    // press to leave the field, the dialog still open.
    const description = dialog.getByRole("textbox", {
      name: "Add description",
    });
    await description.click();
    await expect(description).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(description).not.toBeFocused();
    await expect(dialog).toBeVisible();

    // Nothing is focused now, so the next Escape exits. If editor focus created
    // an empty dirty description draft, discard the prompt; the behavior under
    // test is that Escape leaves the field before running the close sequence.
    await page.keyboard.press("Escape");
    const confirm = page.getByRole("alertdialog");
    if (await confirm.isVisible()) {
      await confirm.getByRole("button", { name: "Discard" }).click();
    }
    await expect(dialog).not.toBeVisible();
  });

  test("hovering a card arms its status (S) and priority (P) shortcuts", async ({
    page,
  }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}-${randomUUID()}`;
    const title = `Hover Shortcut Task ${suffix}`;
    const card = await bootBoardWithTask(page, title);

    // No card is hovered yet, so a bare "S" must NOT open any picker — the
    // cursor is empty and the shortcut has nowhere to land.
    await page.locator("body").press("KeyS");
    await expect(page.getByPlaceholder("Change status...")).toHaveCount(0);

    // Hover the card (no click): it becomes the cursor and "S" opens its status
    // picker. The unique placeholder proves the *status* picker opened.
    await card.hover();
    await page.keyboard.press("KeyS");
    await expect(page.getByPlaceholder("Change status...")).toBeVisible();

    // Escape closes the picker without committing a change.
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder("Change status...")).toHaveCount(0);

    // The same hovered card answers the priority shortcut ("P").
    await card.hover();
    await page.keyboard.press("KeyP");
    await expect(page.getByPlaceholder("Change priority to...")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder("Change priority to...")).toHaveCount(0);
  });

  test("hover moves the armed card to whichever one is under the mouse", async ({
    page,
  }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}-${randomUUID()}`;
    const firstTitle = `Hover First ${suffix}`;
    const secondTitle = `Hover Second ${suffix}`;
    const first = await bootBoardWithTask(page, firstTitle);
    const second = await bootBoardWithTask(page, secondTitle);

    // Each card also carries a hidden context-menu status picker, so scope to
    // the visible inline trigger to identify the on-card picker unambiguously.
    const statusTrigger = (card: Locator) =>
      card.getByRole("combobox", { name: "Change status" }).filter({ visible: true });

    // Arm the first card and open its status picker scoped within that card.
    await first.hover();
    await page.keyboard.press("KeyS");
    await expect(statusTrigger(first)).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");

    // Moving the mouse to the second card re-arms it: now "S" opens the second
    // card's picker, not the first's.
    await second.hover();
    await page.keyboard.press("KeyS");
    await expect(statusTrigger(second)).toHaveAttribute("aria-expanded", "true");
    await expect(statusTrigger(first)).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Escape");
  });

  test("hover arms select (X) and open (O) without clicking the card", async ({
    page,
  }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}-${randomUUID()}`;
    const title = `Hover Select Task ${suffix}`;
    const card = await bootBoardWithTask(page, title);

    // "X" toggles selection on the hovered card; the card reflects it via
    // data-selected, set by the shared keyboard layer.
    await card.hover();
    await page.keyboard.press("KeyX");
    await expect(card).toHaveAttribute("data-selected", "true");

    // Toggling again clears it.
    await card.hover();
    await page.keyboard.press("KeyX");
    await expect(card).not.toHaveAttribute("data-selected", "true");

    // The card shows its Task Identifier (e.g. "WOR-1"); the open-task shortcut
    // keys the details pane by that Identifier (ADR 0013).
    const cardText = (await card.textContent()) ?? "";
    const identifier = cardText.match(/[A-Z0-9]+-\d+/)?.[0];
    expect(identifier, "card should render a Task Identifier").toBeTruthy();

    // "O" opens the hovered Task's details (Linear's open shortcut) — opening a
    // Task pushes its Identifier onto the details-pane search param.
    await card.hover();
    await page.keyboard.press("KeyO");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("details-pane"), {
        timeout: 20_000,
      })
      .toContain(identifier!);
  });
});
