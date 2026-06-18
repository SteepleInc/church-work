import { expect, type Locator, type Page, test } from "@playwright/test";

import { startAuthenticatedSession } from "./helpers";

test.skip(
  process.env.CHURCH_TASK_E2E_ONBOARDING_STACK !== "1",
  "Run with bun run test:e2e:tasks-boards to boot the local Postgres/Zero onboarding stack.",
);

test.setTimeout(120_000);

const taskCard = (page: Page, title: string) => page.getByLabel(`Task card ${title}`);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Our Work" }).click();
  await expect(page).toHaveURL(/\/our-work$/);
  await createTask(page, sharedTaskTitle, { team: "Worship" });
  await expect(taskCard(page, sharedTaskTitle)).toBeVisible({ timeout: 20_000 });
  await expect(taskCard(page, sharedTaskTitle)).toContainText(/[A-Z0-9]+-\d+/);

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
});
