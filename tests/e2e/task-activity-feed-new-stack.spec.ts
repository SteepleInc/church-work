import { expect, type Page, test } from "@playwright/test";

import { startAuthenticatedSession } from "./helpers";

// The Activity Feed is fed by Activities written through Zero in the same
// mutation as each Task change, so this needs the local Postgres/Zero stack
// booted by `bun run test:e2e` with CHURCH_TASK_E2E_ONBOARDING_STACK=1.
test.skip(
  process.env.CHURCH_TASK_E2E_ONBOARDING_STACK !== "1",
  "Run with the onboarding stack (CHURCH_TASK_E2E_ONBOARDING_STACK=1) to boot the local Postgres/Zero stack.",
);

test.setTimeout(120_000);

const detailsPane = (page: Page) => page.getByRole("dialog", { name: "Details Pane" });

const activityFeed = (page: Page) => detailsPane(page).getByRole("list", { name: "Activity" });

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

test.describe("Task details Activity Feed", () => {
  test("shows a created entry and a rich status-change entry", async ({ page }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    await startAuthenticatedSession(page, {
      churchName: `E2E Activity Church ${suffix}`,
      email: `activity-${suffix}@example.com`,
      userName: "E2E Activity Owner",
    });

    const pane = await openTaskDetails(page, `Activity Task ${suffix}`, "Worship");

    // The Activity section header and the creation line render for a fresh Task.
    await expect(pane.getByRole("heading", { name: "Activity" })).toBeVisible();
    await expect(pane.getByText("created this task", { exact: false })).toBeVisible({
      timeout: 20_000,
    });

    // Change the status via the pane's shortcut + picker. The mutator writes a
    // task.status_changed Activity carrying { from: To Do, to: In Progress },
    // which the feed renders as a single from/to line.
    await page.keyboard.press("KeyS");
    await page.getByRole("option", { name: "In Progress" }).click();

    await expect(
      pane.getByText("moved this from To Do to In Progress", { exact: false }),
    ).toBeVisible({ timeout: 20_000 });

    // The actor's name leads the entry, and the entries survive a reload (proving
    // they are persisted Activities, not optimistic UI only).
    await expect(activityFeed(page).getByText("E2E Activity Owner").first()).toBeVisible();

    await page.reload();
    await expect(detailsPane(page)).toBeVisible();
    await expect(
      detailsPane(page).getByText("moved this from To Do to In Progress", { exact: false }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(detailsPane(page).getByText("created this task", { exact: false })).toBeVisible();
  });

  test("renders a rich team-change entry", async ({ page }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    await startAuthenticatedSession(page, {
      churchName: `E2E Activity Team Church ${suffix}`,
      email: `activity-team-${suffix}@example.com`,
      userName: "E2E Activity Team Owner",
    });

    const pane = await openTaskDetails(page, `Activity Team Task ${suffix}`, "Worship");

    // Move the Task to a different Team. The mutator writes a task.team_changed
    // Activity with { from: Worship, to: Production }, rendered as a single line.
    const teamChip = pane.getByRole("combobox", { name: "Change team" });
    await page.keyboard.press("KeyT");
    await page.getByRole("option", { name: "Production" }).click();
    await expect(teamChip).toContainText("Production");

    await expect(pane.getByText("moved this to the Production team", { exact: false })).toBeVisible(
      { timeout: 20_000 },
    );
  });
});
