import { expect, type Locator, type Page, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

import { startAuthenticatedSession } from "./helpers";

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

test("creates, assigns, moves, and preserves Task board state on the local Postgres and Zero stack", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const email = `tasks-boards-${suffix}@example.com`;
  const userName = "E2E Task Owner";
  const sharedTaskTitle = `Shared Board Task ${suffix}`;

  await startAuthenticatedSession(page, {
    churchName: `E2E Tasks Boards Church ${suffix}`,
    email,
    userName,
  });

  const sidebar = page.locator('[data-sidebar="sidebar"]');
  const worshipTeamItem = sidebar.locator('[data-sidebar="menu-item"]', {
    has: page.getByRole("link", { name: "Worship" }),
  });
  const expandWorship = worshipTeamItem.getByRole("button", { name: "Expand Worship" });
  if (await expandWorship.isVisible()) await expandWorship.click();
  await worshipTeamItem.getByRole("button", { name: "Weeks" }).click();
  await worshipTeamItem.getByRole("link", { name: "All Weeks" }).click();
  await expect(page).toHaveURL(/\/team\/worship\/weeks$/);
  await expect(page.getByRole("heading", { name: "Weeks" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Church-wide Weeks for Worship")).toBeVisible();
  await expect(page.getByLabel("Week Progress")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Close Week Progress" }).click();
  await expect(page).toHaveURL(/\/team\/worship\/weeks\?/);
  await expectSearchParam(page, "progress", "closed");
  await expect(page.getByLabel("Week Progress")).not.toBeVisible();
  await page.getByRole("button", { name: "Progress" }).first().click();
  await expect(page.getByLabel("Week Progress")).toBeVisible({ timeout: 20_000 });
  await expectSearchParam(page, "progress", /.+/);
  await worshipTeamItem.getByRole("link", { name: "Current" }).click();
  await expect(page).toHaveURL(/\/team\/worship\?/);
  await expectSearchParam(page, "week", "current");
  await expectSearchParam(page, "progress", /.+/);
  await expect(worshipTeamItem.getByRole("link", { name: "Current" })).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(page.getByLabel("Week selector")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /Next Week,/ }).click();
  await expect(page).toHaveURL(/\/team\/worship\/weeks\/[^/?]+$/);
  const weekBreadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(weekBreadcrumb).toContainText("Worship");
  await weekBreadcrumb.getByRole("link", { name: "Weeks" }).click();
  await expect(page).toHaveURL(/\/team\/worship\/weeks$/);
  await weekBreadcrumb.getByRole("link", { name: "Worship" }).click();
  await expect(page).toHaveURL(/\/team\/worship$/);

  await worshipTeamItem.getByRole("link", { name: "Upcoming" }).click();
  await expect(page).toHaveURL(/\/team\/worship\?week=upcoming$/);
  await expect(worshipTeamItem.getByRole("link", { name: "Upcoming" })).toHaveAttribute(
    "data-active",
    "true",
  );

  await sidebar.getByRole("link", { name: "Our Work" }).click();
  await expect(page).toHaveURL(/\/our-work$/);

  await page.getByRole("button", { name: "Name this Week" }).click();
  await page.getByRole("menuitem", { name: "Name this Week…" }).click();
  const weekDialog = page.getByRole("dialog", { name: "Edit Week details" });
  await expect(weekDialog).toBeVisible();
  await expect(weekDialog.getByText("dates can't be changed")).toBeVisible();
  const weekName = `Launch Week ${suffix}`;
  const weekDescription = `Coordinate visible task-board work for ${suffix}.`;
  await weekDialog.getByLabel("Name").fill(weekName);
  await weekDialog.getByLabel("Description").fill(weekDescription);
  await weekDialog.getByRole("button", { name: "Save Week" }).click();
  await expect(weekDialog).not.toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByRole("button", { name: new RegExp(`Week: ${escapeRegExp(weekName)}`) }),
  ).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: new RegExp(`Week: ${escapeRegExp(weekName)}`) }).click();
  await page.getByRole("menuitem", { name: "Rename Week…" }).click();
  await expect(weekDialog.getByLabel("Description")).toHaveValue(weekDescription);
  await weekDialog.getByRole("button", { name: "Cancel" }).click();

  await createTask(page, sharedTaskTitle, { team: "Worship" });
  await expect(taskCard(page, sharedTaskTitle)).toBeVisible({ timeout: 20_000 });
  await expect(taskCard(page, sharedTaskTitle)).toContainText(/[A-Z0-9]+-\d+/);

  await page.getByRole("button", { name: new RegExp(`Week: ${escapeRegExp(weekName)}`) }).click();
  await expect(page.getByRole("menuitem", { name: /Export tasks as CSV\s+1/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Open in new tab" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Open in new window" })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: /Export tasks as CSV\s+1/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^week-\d{4}-\d{2}-\d{2}-tasks\.csv$/);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const csv = await readFile(downloadPath!, "utf8");
  expect(csv).toContain("Identifier,Title,Status,Task state,Assignee,Team,Due date");
  expect(csv).toContain(sharedTaskTitle);
  expect(csv).toContain("Worship");

  await page.getByRole("button", { name: new RegExp(`Week: ${escapeRegExp(weekName)}`) }).click();
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("menuitem", { name: "Open in new tab" }).click(),
  ]);
  await expect(popup).toHaveURL(page.url());
  await popup.close();

  await chooseCardOption(taskCard(page, sharedTaskTitle), "Assign to", userName);
  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "My Work" }).click();
  await expect(page).toHaveURL(/\/my-work$/);
  await expect(page.getByRole("button", { name: "Current Week" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(taskCard(page, sharedTaskTitle)).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "All" }).click();
  await expect(page).toHaveURL(/\/my-work\?scope=all$/);
  await expect(page.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Our Work" }).click();
  await expect(page).toHaveURL(/\/our-work$/);
  await expect(page.getByRole("button", { name: "Current Week" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "My Work" }).click();
  await expect(page).toHaveURL(/\/my-work$/);
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

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Worship" }).click();
  await expect(page).toHaveURL(/\/team\/worship\?/);
  await expectSearchParam(page, "progress", /.+/);
  await page.getByRole("button", { name: "Week Progress" }).click();
  await expect(page.getByLabel("Week Progress")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Week Progress")).toContainText("Scope");
  await expect(page.getByLabel("Week Progress")).toContainText("Started");
  await expect(page.getByLabel("Week Progress")).toContainText("Completed");
});
