import { expect, type Locator, type Page, test } from "@playwright/test";

import { startAuthenticatedSession } from "./helpers";

test.skip(
  process.env.CHURCH_WORK_E2E_ONBOARDING_STACK !== "1",
  "Run with bun run test:e2e:task-list-scroll to boot the local Postgres/Zero onboarding stack.",
);

test.setTimeout(180_000);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const taskCard = (page: Page, title: string) => page.getByLabel(`Task card ${title}`);

async function chooseCardOption(task: Locator, label: string, optionName: string) {
  await task.getByRole("combobox", { name: label }).first().click();
  await task
    .page()
    .getByRole("option", { name: new RegExp(`^${escapeRegExp(optionName)}(?:\\s|$)`) })
    .click();
}

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

test("keeps list group headers pinned and surfaces an off-screen-below beacon while scrolling", async ({
  page,
}, testInfo) => {
  // Use a normal viewport while seeding Tasks so the create dialog fits and the
  // board renders fully; the viewport is shrunk later to force list scrolling.
  await page.setViewportSize({ height: 900, width: 1024 });

  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const email = `task-list-scroll-${suffix}@example.com`;

  await startAuthenticatedSession(page, {
    churchName: `E2E List Scroll Church ${suffix}`,
    email,
    userName: "E2E List Scroll Owner",
  });

  // Land on the Worship Team's current Week, where Create Task attaches Tasks to
  // the in-scope Cycle so they show on the board/list.
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  const worshipTeamItem = sidebar.locator('[data-sidebar="menu-item"]', {
    has: page.getByRole("link", { name: "Worship" }),
  });
  const worshipLink = worshipTeamItem.getByRole("link", { name: "Worship" });
  await expect(worshipLink).toBeVisible({ timeout: 20_000 });
  const worshipHref = await worshipLink.getAttribute("href");
  const teamPath = worshipHref!;
  const teamPathPattern = new RegExp(`${escapeRegExp(teamPath)}(?:[/?]|$)`);

  const expandButton = worshipTeamItem.getByRole("button", { name: "Expand Worship" });
  if (await expandButton.isVisible().catch(() => false)) {
    await expandButton.click();
  }
  await worshipTeamItem.getByRole("link", { name: "Current" }).click();
  await expect(page).toHaveURL(teamPathPattern);

  // Create enough Tasks to overflow the short viewport, spread across all three
  // Workflow Status groups so the list renders multiple sticky group headers.
  const todoTitles = Array.from({ length: 6 }, (_, i) => `Todo Task ${i + 1} ${suffix}`);
  const inProgressTitles = Array.from({ length: 6 }, (_, i) => `Progress Task ${i + 1} ${suffix}`);
  const doneTitles = Array.from({ length: 6 }, (_, i) => `Done Task ${i + 1} ${suffix}`);

  for (const title of [...todoTitles, ...inProgressTitles, ...doneTitles]) {
    await createTask(page, title, "Worship");
    await expect(taskCard(page, title)).toBeVisible({ timeout: 20_000 });
  }

  // Show every Workflow Status (All tab) so Done Tasks stay visible after their
  // status change — the default Active tab hides Done work.
  await page.getByRole("tab", { name: "All" }).click();

  // Move the In Progress and Done groups into their Workflow Statuses on the
  // board (the list shares the same grouping) so all three groups are populated.
  for (const title of inProgressTitles) {
    await chooseCardOption(taskCard(page, title), "Change status", "In Progress");
    await expect(page.getByLabel("In Progress Tasks").getByText(title)).toBeVisible({
      timeout: 20_000,
    });
  }
  for (const title of doneTitles) {
    await chooseCardOption(taskCard(page, title), "Change status", "Done");
    await expect(page.getByLabel("Done Tasks").getByText(title)).toBeVisible({ timeout: 20_000 });
  }

  // Shrink the viewport so only the first group fits and later groups sit well
  // below the fold, forcing the off-screen-below beacon to appear.
  await page.setViewportSize({ height: 420, width: 1024 });

  // Switch to List view via the Board/List layout shortcut (⌘/Ctrl+B).
  await page.locator("body").press("ControlOrMeta+KeyB");

  // The list renders ScrollSections group sections with sticky headers.
  const todoGroup = page.getByRole("region", { name: "To Do group" });
  const doneGroup = page.getByRole("region", { name: "Done group" });
  await expect(todoGroup).toBeVisible({ timeout: 20_000 });
  await expect(todoGroup.getByText(todoTitles[0]!)).toBeVisible({ timeout: 20_000 });

  // The scroll viewport is the ScrollSections' ScrollArea Viewport.
  const viewport = page.locator('[data-slot="scroll-sections"] [data-slot="scroll-area-viewport"]');
  await expect(viewport).toBeVisible();
  // Sanity check: the list actually overflows so scrolling is meaningful.
  await expect
    .poll(async () => viewport.evaluate((node) => node.scrollHeight - node.clientHeight))
    .toBeGreaterThan(0);

  // Before scrolling, the To Do header sits at the top of the viewport.
  const todoHeader = todoGroup.getByText("To Do", { exact: true }).first();
  await expect(todoHeader).toBeVisible();

  // Scroll to the bottom: the Done group's header is now pinned at the top, and
  // the To Do group (scrolled past) no longer occupies the top.
  await viewport.evaluate((node) => {
    node.scrollTo({ top: node.scrollHeight });
  });

  // The Done group's first task is now visible after scrolling to the bottom.
  await expect(doneGroup.getByText(doneTitles.at(-1)!)).toBeVisible({ timeout: 20_000 });

  // Scroll back to the top and assert the off-screen-below beacon appears for a
  // group whose header is below the fold (the bottom overlay surfaces a
  // clickable "Scroll to <group>" button). It must scroll that group into view.
  await viewport.evaluate((node) => {
    node.scrollTo({ top: 0 });
  });

  const beacon = page.getByRole("button", { name: /^Scroll to (In Progress|Done)$/ }).first();
  await expect(beacon).toBeVisible({ timeout: 20_000 });

  const beaconName = (await beacon.getAttribute("aria-label")) ?? "";
  const targetGroupName = beaconName.replace(/^Scroll to /, "");
  // The beacon retargets as the smooth scroll progresses (the next below-fold
  // group takes over), so click without waiting for post-action stability.
  await beacon.click({ force: true });

  // After clicking, the targeted group's tasks are scrolled into view.
  const targetGroup = page.getByRole("region", { name: `${targetGroupName} group` });
  await expect(targetGroup).toBeVisible();
  await expect
    .poll(async () => viewport.evaluate((node) => node.scrollTop), { timeout: 20_000 })
    .toBeGreaterThan(0);
});
