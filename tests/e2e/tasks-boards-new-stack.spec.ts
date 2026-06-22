import { readFile } from "node:fs/promises";

import { expect, type Locator, type Page, test } from "@playwright/test";

import { getE2eApiUrl, startAuthenticatedSession } from "./helpers";

test.skip(
  process.env.CHURCH_TASK_E2E_ONBOARDING_STACK !== "1",
  "Run with bun run test:e2e:tasks-boards to boot the local Postgres/Zero onboarding stack.",
);

test.setTimeout(120_000);

const taskCard = (page: Page, title: string) => page.getByLabel(`Task card ${title}`);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function expectSearchParam(page: Page, name: string, value: string | RegExp) {
  await expect
    .poll(() => new URL(page.url()).searchParams.get(name))
    .toEqual(
      expect.stringMatching(
        value instanceof RegExp ? value : new RegExp(`^${escapeRegExp(value)}$`),
      ),
    );
}

async function chooseCardOption(task: Locator, label: string, optionName: string) {
  await task.getByRole("combobox", { name: label }).first().click();
  await task
    .page()
    .getByRole("option", { name: new RegExp(`^${escapeRegExp(optionName)}(?:\\s|$)`) })
    .click();
}

async function createTask(
  page: Page,
  title: string,
  options: { readonly team?: string; readonly priority?: string } = {},
) {
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
  if (options.priority) {
    await dialog.getByRole("combobox", { name: "Change priority" }).click();
    await page
      .getByRole("option", { name: new RegExp(`^${escapeRegExp(options.priority)}`) })
      .click();
  }

  await dialog.getByRole("button", { name: "Create Task" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 20_000 });
}

async function expandTeamSubnav(teamItem: Locator, teamName: string) {
  const weeksLink = teamItem.getByRole("link", { name: "Weeks" });
  if (await weeksLink.isVisible().catch(() => false)) return;

  const expandButton = teamItem.getByRole("button", { name: `Expand ${teamName}` });
  await expect(expandButton).toBeVisible({ timeout: 20_000 });
  await expandButton.click();
  await expect(weeksLink).toBeVisible({ timeout: 20_000 });
}

test("creates, assigns, moves, and preserves Task board state on the local Postgres and Zero stack", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const email = `tasks-boards-${suffix}@example.com`;
  const userName = "E2E Task Owner";
  const sharedTaskTitle = `Shared Board Task ${suffix}`;
  const lowPriorityTaskTitle = `Low Priority Task ${suffix}`;

  await startAuthenticatedSession(page, {
    churchName: `E2E Tasks Boards Church ${suffix}`,
    email,
    userName,
  });

  const sidebar = page.locator('[data-sidebar="sidebar"]');
  const worshipTeamItem = sidebar.locator('[data-sidebar="menu-item"]', {
    has: page.getByRole("link", { name: "Worship" }),
  });
  // Teams get a short uppercase Identifier (e.g. "WOR"), so derive the Team's
  // base path from its sidebar link rather than assuming the slug.
  const worshipLink = worshipTeamItem.getByRole("link", { name: "Worship" });
  await expect(worshipLink).toBeVisible({ timeout: 20_000 });
  const worshipHref = await worshipLink.getAttribute("href");
  expect(worshipHref).toMatch(/^\/team\/[A-Z0-9]+$/);
  const teamPath = worshipHref!;
  const teamPathPattern = new RegExp(`${escapeRegExp(teamPath)}(?:[/?]|$)`);

  await expandTeamSubnav(worshipTeamItem, "Worship");
  // "Weeks" is a link straight to the Team's Weeks index; its Current/Upcoming
  // shortcuts render directly beneath it once the Team is expanded.
  await worshipTeamItem.getByRole("link", { name: "Weeks" }).click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(teamPath)}/weeks(?:\\?|$)`));
  await expect(page.getByRole("heading", { name: "Weeks" })).toBeVisible({ timeout: 20_000 });
  await worshipTeamItem.getByRole("link", { name: "Current" }).click();
  await expect(page).toHaveURL(teamPathPattern);
  await expectSearchParam(page, "week", "current");
  await expect(worshipTeamItem.getByRole("link", { name: "Current" })).toHaveAttribute(
    "data-status",
    "active",
  );
  const weekSwitcher = page.getByRole("navigation", { name: "Week" });
  await expect(weekSwitcher).toBeVisible({ timeout: 20_000 });
  await expect(weekSwitcher).toContainText("Worship");
  // The Week label currently shown in the switcher trigger — the breadcrumb's
  // final, interactive segment. Switching Weeks must change it.
  const weekTrigger = weekSwitcher.getByRole("button");
  const currentWeekLabel = (await weekTrigger.textContent())?.trim() ?? "";
  expect(currentWeekLabel).not.toBe("");

  // The final breadcrumb segment is the Linear-style Week switcher: open it and
  // confirm it offers the immediate neighbors with Linear's exact Cycle
  // navigation shortcuts — "Next Week (upcoming)" → ⌥K, "Previous Week
  // (completed)" → ⌥J.
  await weekTrigger.click();
  const weekMenu = page.getByRole("menu", { name: /Choose a different Week/ });
  await expect(weekMenu).toBeVisible();
  await expect(weekMenu.getByText("Next Week (upcoming)")).toBeVisible();
  await expect(weekMenu.getByText("⌥K")).toBeVisible();
  // Jump to the next (upcoming) Week by clicking its menu item.
  await weekMenu.getByRole("menuitem").first().click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(teamPath)}/week/\\d+(?:\\?|$)`));
  // The switcher trigger now names a different Week — the board actually moved.
  // The trigger label re-renders reactively after the URL changes, so wait for
  // it to stop showing the previous Week before reading it; a bare textContent()
  // read here races the re-render and can still observe the old label.
  await expect(weekTrigger).not.toHaveText(new RegExp(`^${escapeRegExp(currentWeekLabel)}$`), {
    timeout: 20_000,
  });
  const nextWeekLabel = (await weekTrigger.textContent())?.trim() ?? "";
  expect(nextWeekLabel).not.toBe(currentWeekLabel);

  // ⌥J (Linear's "Previous cycle" shortcut) steps back to the Week we came
  // from without touching the menu — the keyboard binding (listening on the
  // document, while no text field has focus) drives navigation.
  await page.locator("body").press("Alt+KeyJ");
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(teamPath)}/week/\\d+(?:\\?|$)`));
  await expect(weekTrigger).toHaveText(new RegExp(escapeRegExp(currentWeekLabel)), {
    timeout: 20_000,
  });

  await weekSwitcher.getByRole("link", { name: "Weeks" }).click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(teamPath)}/weeks(?:\\?|$)`));
  await worshipTeamItem.getByRole("link", { name: "Current" }).click();
  await expect(page).toHaveURL(teamPathPattern);

  await worshipTeamItem.getByRole("link", { name: "Upcoming" }).click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(teamPath)}\\?week=upcoming$`));
  await expect(worshipTeamItem.getByRole("link", { name: "Upcoming" })).toHaveAttribute(
    "data-status",
    "active",
  );
  await expect(page.getByText("Nothing planned yet")).toBeVisible({ timeout: 20_000 });

  const projectedWeekTaskTitle = `Projected Week Task ${suffix}`;
  await page.getByRole("main").getByRole("button", { name: "Create Task" }).click();
  const projectedWeekDialog = page.getByRole("dialog", { name: /New Task/ });
  await expect(projectedWeekDialog).toBeVisible();
  await expect(projectedWeekDialog.getByText("Week of")).toBeVisible();
  await projectedWeekDialog.getByPlaceholder("Task title").fill(projectedWeekTaskTitle);
  await projectedWeekDialog.getByRole("button", { name: "Create Task" }).click();
  await expect(projectedWeekDialog).not.toBeVisible({ timeout: 20_000 });
  await expect(taskCard(page, projectedWeekTaskTitle)).toBeVisible({ timeout: 20_000 });

  // Edit the Week from the Team Week board's "⋯" actions menu (the Week
  // switcher's sibling) — "Edit week" opens the same quick action chrome as
  // Create Task, the way Linear edits a Cycle.
  await worshipTeamItem.getByRole("link", { name: "Current" }).click();
  await expect(page).toHaveURL(teamPathPattern);
  const weekActions = page.getByRole("button", { name: "Week actions" });
  await weekActions.click();
  await page.getByRole("menuitem", { name: "Edit week name and description…" }).click();
  const weekDialog = page.getByRole("dialog", { name: "Edit week" });
  await expect(weekDialog).toBeVisible();
  // Inline editing, Linear-style: the Name field hints the Week's locked
  // Monday–Sunday span as its placeholder rather than a separate control.
  await expect(weekDialog.getByLabel("Name")).toHaveAttribute("placeholder", /\w/);
  const weekName = `Launch Week ${suffix}`;
  const weekDescription = `Coordinate visible task-board work for ${suffix}.`;
  await weekDialog.getByLabel("Name").fill(weekName);
  await weekDialog.getByLabel("Description").fill(weekDescription);
  await weekDialog.getByRole("button", { name: "Save week" }).click();
  await expect(weekDialog).not.toBeVisible({ timeout: 20_000 });
  const weekSwitcherNamed = page.getByRole("navigation", { name: "Week" });
  await expect(weekSwitcherNamed).toContainText(weekName, { timeout: 20_000 });
  await weekActions.click();
  await page.getByRole("menuitem", { name: "Edit week name and description…" }).click();
  await expect(weekDialog.getByLabel("Description")).toHaveValue(weekDescription);
  await page.keyboard.press("Escape");
  await expect(weekDialog).not.toBeVisible();

  await createTask(page, sharedTaskTitle, { team: "Worship", priority: "High" });
  await expect(taskCard(page, sharedTaskTitle)).toBeVisible({ timeout: 20_000 });
  await expect(taskCard(page, sharedTaskTitle)).toContainText(/[A-Z0-9]+-\d+/);
  await expect(taskCard(page, sharedTaskTitle).getByLabel("Priority: High")).toBeVisible();

  const notificationResponse = await page.request.post(`${getE2eApiUrl()}/api/test/notifications`, {
    data: { taskTitle: sharedTaskTitle },
  });
  expect(notificationResponse.ok()).toBe(true);

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Inbox" }).click();
  await expect(page).toHaveURL(/\/inbox$/);
  await expect(page.getByRole("button", { name: /Open notification/ })).toContainText(
    sharedTaskTitle,
    { timeout: 20_000 },
  );
  await page.getByRole("button", { name: /Open notification/ }).click();
  const detailsPane = page.getByRole("dialog", { name: "Details Pane" });
  await expect(detailsPane).toBeVisible({ timeout: 20_000 });
  await expect(detailsPane.getByRole("heading", { name: sharedTaskTitle })).toBeVisible();
  await expect(page.getByText("1 unread", { exact: true })).not.toBeVisible({ timeout: 20_000 });
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Mark notification unread" }).click();
  await expect(page.getByText("1 unread", { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Snooze notification" }).click();
  await page.getByRole("menuitem", { name: "In 1 hour" }).click();
  await expect(page.getByRole("button", { name: /Open notification/ })).not.toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("1 notification is snoozed for later")).toBeVisible();
  await page.getByRole("button", { name: "Show snoozed" }).click();
  await expect(page.getByRole("button", { name: /Open notification/ })).toContainText(
    sharedTaskTitle,
    { timeout: 20_000 },
  );
  await expect(page.getByText(/Snoozed in about 1 hour/)).toBeVisible();
  await page.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.getByText("1 unread", { exact: true })).not.toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Delete read" }).click();
  const deleteReadDialog = page.getByRole("alertdialog", { name: "Delete 1 read notification?" });
  await expect(deleteReadDialog).toBeVisible();
  await deleteReadDialog.getByRole("button", { name: "Delete read" }).click();
  await expect(page.getByRole("button", { name: /Open notification/ })).not.toBeVisible({
    timeout: 20_000,
  });

  await worshipTeamItem.getByRole("link", { name: "Current" }).click();
  await expect(page).toHaveURL(teamPathPattern);

  await page.reload();
  await expect(taskCard(page, sharedTaskTitle).getByLabel("Priority: High")).toBeVisible({
    timeout: 20_000,
  });

  await createTask(page, lowPriorityTaskTitle, { team: "Worship", priority: "Low" });
  await expect(taskCard(page, lowPriorityTaskTitle).getByLabel("Priority: Low")).toBeVisible({
    timeout: 20_000,
  });

  await weekActions.click();
  await expect(page.getByRole("menuitem", { name: /Export tasks as CSV.*2/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Copy link" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Open in new tab" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Open in new window" })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: /Export tasks as CSV.*2/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^week-\d{4}-\d{2}-\d{2}-tasks\.csv$/);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const csv = await readFile(downloadPath!, "utf8");
  expect(csv).toContain("Identifier,Title,Status,Task state,Assignee,Team,Due date");
  expect(csv).toContain(sharedTaskTitle);
  expect(csv).toContain("Worship");

  await weekActions.click();
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("menuitem", { name: "Open in new tab" }).click(),
  ]);
  await expect(popup).toHaveURL(page.url());
  await popup.close();

  await chooseCardOption(taskCard(page, sharedTaskTitle), "Assign to", userName);
  // My Work and Our Work show every Task regardless of Week — no Week scope
  // control — like Linear's issue views.
  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "My Work" }).click();
  await expect(page).toHaveURL(/\/my-work$/);
  await expect(page.getByRole("navigation", { name: "Week" })).toHaveCount(0);
  await expect(taskCard(page, sharedTaskTitle)).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByText("Priority", { exact: true }).click();
  await page.getByRole("option", { name: /^High/ }).click();
  await expect(taskCard(page, sharedTaskTitle)).toBeVisible({ timeout: 20_000 });
  await expect(taskCard(page, lowPriorityTaskTitle)).toHaveCount(0);

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Our Work" }).click();
  await expect(page).toHaveURL(/\/our-work$/);
  await expect(page.getByRole("navigation", { name: "Week" })).toHaveCount(0);

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "My Work" }).click();
  await expect(page).toHaveURL(/\/my-work$/);
  await expect(page.getByRole("navigation", { name: "Week" })).toHaveCount(0);
  await expect(taskCard(page, sharedTaskTitle)).toBeVisible({ timeout: 20_000 });

  await chooseCardOption(taskCard(page, sharedTaskTitle), "Change status", "In Progress");
  await expect(page.getByLabel("In Progress Tasks").getByText(sharedTaskTitle)).toBeVisible({
    timeout: 20_000,
  });

  await page.reload();
  await expect(page.getByLabel("In Progress Tasks").getByText(sharedTaskTitle)).toBeVisible({
    timeout: 20_000,
  });

  await chooseCardOption(taskCard(page, sharedTaskTitle), "Change status", "Done");
  await expect(page.getByLabel("Done Tasks").getByText(sharedTaskTitle)).toBeVisible({
    timeout: 20_000,
  });
  await chooseCardOption(taskCard(page, sharedTaskTitle), "Change status", "To Do");
  await expect(page.getByLabel("To Do Tasks").getByText(sharedTaskTitle)).toBeVisible({
    timeout: 20_000,
  });

  // Back on the Worship Team's current-Week board, the named Week switcher is
  // present in the header and the Task created earlier is in scope.
  await worshipTeamItem.getByRole("link", { name: "Current" }).click();
  await expect(page).toHaveURL(teamPathPattern);
  await expectSearchParam(page, "week", "current");
  await expect(page.getByRole("navigation", { name: "Week" })).toBeVisible({ timeout: 20_000 });
  await expect(taskCard(page, sharedTaskTitle)).toBeVisible({ timeout: 20_000 });
});
