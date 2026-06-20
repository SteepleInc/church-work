import { expect, type Page, test } from "@playwright/test";

import { startAuthenticatedSession } from "./helpers";

// Same gating as the other onboarding-stack specs: the Task details pickers
// persist through Zero, so this needs the local Postgres/Zero stack booted by
// `bun run test:e2e` with CHURCH_TASK_E2E_ONBOARDING_STACK=1.
test.skip(
  process.env.CHURCH_TASK_E2E_ONBOARDING_STACK !== "1",
  "Run with the onboarding stack (CHURCH_TASK_E2E_ONBOARDING_STACK=1) to boot the local Postgres/Zero stack.",
);

test.setTimeout(120_000);

const detailsPane = (page: Page) => page.getByRole("dialog", { name: "Details Pane" });

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

/**
 * Boots a board with a single Task on the given Team and opens its details pane
 * by clicking the card. The pane title is an editable textbox (Linear-style),
 * not a heading, so it is the stable anchor for "the pane is open on this Task".
 */
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

test.describe("Task details pane pickers", () => {
  test("each property shortcut opens its picker while the pane is open", async ({
    page,
  }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    await startAuthenticatedSession(page, {
      churchName: `E2E Details Pickers Church ${suffix}`,
      email: `details-pickers-${suffix}@example.com`,
      userName: "E2E Details Owner",
    });

    await openTaskDetails(page, `Details Pickers Task ${suffix}`, "Worship");

    // Unlike the board cards (which gate shortcuts on hover), the pane keeps the
    // field shortcuts live the whole time it is open — no hover or trigger focus
    // required. Each unique placeholder proves the matching picker opened, and
    // Escape closes it without committing a change so the next key is clean.
    const cases = [
      { key: "KeyS", placeholder: "Change status..." },
      { key: "KeyP", placeholder: "Change priority to..." },
      { key: "KeyA", placeholder: "Assign to..." },
      { key: "KeyL", placeholder: "Add labels..." },
      { key: "KeyT", placeholder: "Change team..." },
    ] as const;

    for (const { key, placeholder } of cases) {
      await page.keyboard.press(key);
      await expect(page.getByPlaceholder(placeholder)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByPlaceholder(placeholder)).toHaveCount(0);
    }

    // Estimate is the only shifted shortcut (⇧E), matching the board/create
    // dialog convention so the bare "E" never opens it.
    await page.keyboard.press("Shift+E");
    await expect(page.getByPlaceholder("Change estimate to...")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder("Change estimate to...")).toHaveCount(0);

    // Due date opens a calendar (no search input), so assert on the grid.
    await page.keyboard.press("KeyD");
    await expect(page.getByRole("grid")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("grid")).toHaveCount(0);
  });

  test("typing in the title does not trigger field shortcuts", async ({ page }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    await startAuthenticatedSession(page, {
      churchName: `E2E Details Typing Church ${suffix}`,
      email: `details-typing-${suffix}@example.com`,
      userName: "E2E Details Typist",
    });

    const title = `Details Typing Task ${suffix}`;
    const pane = await openTaskDetails(page, title, "Worship");

    // Focus the title editor and type letters that double as picker shortcuts
    // (s, p, a). The keydown listener bails on editable targets, so no picker
    // opens and the characters land in the title instead.
    const titleEditor = pane.getByRole("textbox", { name: "Task title" });
    await titleEditor.click();
    await page.keyboard.type("spat");

    await expect(page.getByPlaceholder("Change status...")).toHaveCount(0);
    await expect(page.getByPlaceholder("Change priority to...")).toHaveCount(0);
    await expect(page.getByPlaceholder("Assign to...")).toHaveCount(0);

    // The characters were inserted into the title (caret position varies, so
    // assert the substring landed) — confirming the shortcut handler stayed out
    // of the way while editing text rather than firing the s/p/a pickers.
    await expect(titleEditor).toHaveValue(/spat/);
  });

  test("changing status from the pane persists and reflects in the chip", async ({
    page,
  }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    await startAuthenticatedSession(page, {
      churchName: `E2E Details Status Church ${suffix}`,
      email: `details-status-${suffix}@example.com`,
      userName: "E2E Details Status Owner",
    });

    const pane = await openTaskDetails(page, `Details Status Task ${suffix}`, "Worship");

    // New Tasks start in the Worship Workflow's default status ("To Do").
    const statusChip = pane.getByRole("combobox", { name: "Change status" });
    await expect(statusChip).toContainText("To Do");

    // Open via shortcut, pick "In Progress", and confirm the chip updates. The
    // value is written through Zero, so a stable chip label proves persistence.
    await page.keyboard.press("KeyS");
    await page.getByRole("option", { name: "In Progress" }).click();
    await expect(statusChip).toContainText("In Progress");

    // Reopening the pane from a fresh navigation keeps the committed status.
    await page.reload();
    await expect(detailsPane(page)).toBeVisible();
    await expect(detailsPane(page).getByRole("combobox", { name: "Change status" })).toContainText(
      "In Progress",
    );
  });

  test("changing team remaps the Task to the destination Workflow default status", async ({
    page,
  }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    await startAuthenticatedSession(page, {
      churchName: `E2E Details Team Church ${suffix}`,
      email: `details-team-${suffix}@example.com`,
      userName: "E2E Details Team Owner",
    });

    const pane = await openTaskDetails(page, `Details Team Task ${suffix}`, "Worship");

    const teamChip = pane.getByRole("combobox", { name: "Change team" });
    await expect(teamChip).toContainText("Worship");

    // Move it to a different Team via the pane's team picker. Server-side the
    // destination Team's Workflow takes over: the status resets to that
    // Workflow's default ("To Do") — see the tasks.update mutator.
    await page.keyboard.press("KeyT");
    await page.getByRole("option", { name: "Production" }).click();
    await expect(teamChip).toContainText("Production");
    await expect(pane.getByRole("combobox", { name: "Change status" })).toContainText("To Do");
  });
});
