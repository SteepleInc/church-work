import { expect, type Locator, type Page, test } from "@playwright/test";

import { startAuthenticatedSession } from "./helpers";

test.skip(
  process.env.CHURCH_TASK_E2E_ONBOARDING_STACK !== "1",
  "Run with bun run test:e2e:tasks-boards to boot the local Postgres/Zero onboarding stack.",
);

test.setTimeout(120_000);

const taskCard = (page: Page, title: string) => page.getByLabel(`Task card ${title}`);
const worshipTeamPath = String.raw`\/team\/(?:worship|WOR)`;

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

  await startAuthenticatedSession(page, {
    churchName: `E2E Tasks Boards Church ${suffix}`,
    email,
    userName,
  });

  const sidebar = page.locator('[data-sidebar="sidebar"]');
  const worshipTeamItem = sidebar.locator('[data-sidebar="menu-item"]', {
    has: page.getByRole("link", { name: "Worship" }),
  });
  await expandTeamSubnav(worshipTeamItem, "Worship");
  await worshipTeamItem.getByRole("link", { name: "Weeks" }).click();
  await expect(page).toHaveURL(new RegExp(`${worshipTeamPath}\\/weeks(?:\\?.*)?$`));
  await expect(page.getByRole("heading", { name: "Weeks" })).toBeVisible({ timeout: 20_000 });
  await worshipTeamItem.getByRole("link", { name: "Current" }).click();
  await expect(page).toHaveURL(new RegExp(`${worshipTeamPath}\\?`));
  await expectSearchParam(page, "week", "current");
  await expect(worshipTeamItem.getByRole("link", { name: "Current" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByLabel("Week selector")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /Next Week,/ }).click();
  await expect(page).toHaveURL(new RegExp(`${worshipTeamPath}\\/week\\/[^/?]+(?:\\?.*)?$`));
  const weekBreadcrumb = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
  await expect(weekBreadcrumb).toContainText("Worship");
  await weekBreadcrumb.getByRole("link", { name: "Weeks" }).click();
  await expect(page).toHaveURL(new RegExp(`${worshipTeamPath}\\/weeks(?:\\?.*)?$`));
  await weekBreadcrumb.getByRole("link", { name: "Worship" }).click();
  await expect(page).toHaveURL(new RegExp(`${worshipTeamPath}(?:\\?.*)?$`));

  await worshipTeamItem.getByRole("link", { name: "Upcoming" }).click();
  await expect(page).toHaveURL(new RegExp(`${worshipTeamPath}\\?week=upcoming$`));
  await expect(worshipTeamItem.getByRole("link", { name: "Upcoming" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await sidebar.getByRole("link", { name: "Our Work" }).click();
  await expect(page).toHaveURL(/\/our-work$/);
  await page.getByRole("button", { name: "All" }).click();
  await expect(page).toHaveURL(/\/our-work\?scope=all$/);

  await createTask(page, sharedTaskTitle, { team: "Worship" });
  await expect(taskCard(page, sharedTaskTitle)).toBeVisible({ timeout: 20_000 });
  await expect(taskCard(page, sharedTaskTitle)).toContainText(/[A-Z0-9]+-\d+/);

  await chooseCardOption(taskCard(page, sharedTaskTitle), "Assign to", userName);
  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "My Work" }).click();
  await expect(page).toHaveURL(/\/my-work$/);
  await page.getByRole("button", { name: "All" }).click();
  await expect(page).toHaveURL(/\/my-work\?scope=all$/);
  await expect(page.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
  await expect(taskCard(page, sharedTaskTitle)).toBeVisible({ timeout: 20_000 });

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Our Work" }).click();
  await expect(page).toHaveURL(/\/our-work$/);

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "My Work" }).click();
  await expect(page).toHaveURL(/\/my-work$/);
  await page.getByRole("button", { name: "All" }).click();
  await expect(page).toHaveURL(/\/my-work\?scope=all$/);
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
  await expect(page).toHaveURL(new RegExp(`${worshipTeamPath}(?:\\?.*)?$`));
  await page.getByRole("button", { name: "Week Progress" }).click();
  const weekProgress = page.getByRole("complementary", { name: "Week Progress" });
  await expect(weekProgress).toBeVisible({ timeout: 20_000 });
  await expect(weekProgress).toContainText("Scope");
  await expect(weekProgress).toContainText("Started");
  await expect(weekProgress).toContainText("Completed");
});
