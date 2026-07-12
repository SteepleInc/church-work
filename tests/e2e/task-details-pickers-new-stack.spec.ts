import { randomUUID } from "node:crypto";

import { expect } from "@playwright/test";

import { createAuthenticatedTest } from "./authenticated-test";
import { createTaskAndOpenDetails, taskDetailsPane } from "./task-details-helpers";

const test = createAuthenticatedTest({
  churchNamePrefix: "E2E Details Pickers Church",
  emailPrefix: "details-pickers",
  mode: "test-session",
  userName: "E2E Details Owner",
});

// Same gating as the other onboarding-stack specs: the Task details pickers
// persist through Zero, so this needs the local Postgres/Zero stack booted by
// `bun run test:e2e` with CHURCH_WORK_E2E_ONBOARDING_STACK=1.
test.skip(
  process.env.CHURCH_WORK_E2E_ONBOARDING_STACK !== "1",
  "Run with the onboarding stack (CHURCH_WORK_E2E_ONBOARDING_STACK=1) to boot the local Postgres/Zero stack.",
);

test.setTimeout(120_000);

const detailsPane = taskDetailsPane;

test.describe("Task details pane pickers", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/my-work");
  });

  test("each property shortcut opens its picker while the pane is open", async ({ page }) => {
    await createTaskAndOpenDetails(page, `Details Pickers Task ${randomUUID()}`, "Worship");

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

  test("typing in the title does not trigger field shortcuts", async ({ page }) => {
    const title = `Details Typing Task ${randomUUID()}`;
    const pane = await createTaskAndOpenDetails(page, title, "Worship");

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

  test("changing status from the pane persists and reflects in the chip", async ({ page }) => {
    const pane = await createTaskAndOpenDetails(
      page,
      `Details Status Task ${randomUUID()}`,
      "Worship",
    );

    // New Tasks start in the Worship Workflow's default status ("To Do").
    const statusChip = pane.getByTestId("task-details-status-trigger");
    await expect(statusChip).toContainText("To Do");

    // Open via shortcut, pick "In Progress", and confirm the chip updates. The
    // value is written through Zero, so a stable chip label proves persistence.
    await page.keyboard.press("KeyS");
    await page.getByRole("option", { name: "In Progress" }).click();
    await expect(statusChip).toContainText("In Progress");

    // Reopening the pane from a fresh navigation keeps the committed status.
    await page.reload();
    await expect(detailsPane(page)).toBeVisible();
    await expect(detailsPane(page).getByTestId("task-details-status-trigger")).toContainText(
      "In Progress",
    );
  });

  test("changing team remaps the Task to the destination Workflow default status", async ({
    page,
  }) => {
    const pane = await createTaskAndOpenDetails(
      page,
      `Details Team Task ${randomUUID()}`,
      "Worship",
    );

    const teamChip = pane.getByTestId("task-details-team-trigger");
    await expect(teamChip).toContainText("Worship");

    // Move it to a different Team via the pane's team picker. Server-side the
    // destination Team's Workflow takes over: the status resets to that
    // Workflow's default ("To Do") — see the tasks.update mutator.
    await page.keyboard.press("KeyT");
    await page.getByRole("option", { name: "Production" }).click();
    await expect(teamChip).toContainText("Production");
    await expect(pane.getByTestId("task-details-status-trigger")).toContainText("To Do");
  });

  test("title and description arrow-navigate as one surface in the pane", async ({ page }) => {
    const title = `Details Seam Task ${randomUUID()}`;
    const pane = await createTaskAndOpenDetails(page, title, "Worship");

    const titleEditor = pane.getByRole("textbox", { name: "Task title" });
    const description = pane.getByRole("textbox", { name: "Task description" });

    // From the title, ArrowDown crosses the seam into the description (caret at
    // the top), so typing lands in the description without clicking it.
    await titleEditor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowDown");
    await expect(description).toBeFocused();
    await page.keyboard.type("Seam body");
    await expect(description).toContainText("Seam body");

    // ArrowUp from the first line of the description returns to the title.
    await description.press("ArrowUp");
    await expect(titleEditor).toBeFocused();
  });
});
