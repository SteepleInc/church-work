import { randomUUID } from "node:crypto";

import { expect, type Page } from "@playwright/test";

import { createAuthenticatedTest } from "./authenticated-test";

const test = createAuthenticatedTest({
  churchNamePrefix: "E2E Task Flows Church",
  emailPrefix: "task-flows",
  mode: "onboarding",
  userName: "E2E Task Flows Owner",
});

test.skip(
  process.env.CHURCH_WORK_E2E_READY !== "1",
  process.env.CHURCH_WORK_E2E_SKIP_REASON ?? "E2E environment is not configured.",
);

async function createTask(page: Page, title: string, options: { readonly team?: string } = {}) {
  await page.getByRole("main").getByRole("button", { name: "Create Task" }).click();
  const dialog = page.getByRole("dialog", { name: /New Task/ });
  await dialog.getByPlaceholder("Task title").fill(title);
  // Every Task belongs to exactly one Team (ADR 0013): the required picker is
  // prefilled by the default chain (preset → last-used → membership → first).
  const teamPicker = dialog.getByLabel("Team");
  await expect(teamPicker).toBeVisible();
  if (options.team) {
    await teamPicker.click();
    await page.getByRole("option", { exact: true, name: options.team }).click();
  }
  await dialog.getByRole("button", { name: "Create Task" }).click();
}

const taskCard = (page: Page, title: string) => page.getByLabel(`Task card ${title}`);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function chooseCardOption(
  page: import("@playwright/test").Page,
  task: import("@playwright/test").Locator,
  label: string,
  optionName: string,
) {
  await task.getByLabel(label).click();
  await page
    .getByRole("option", {
      name: new RegExp(`^${escapeRegExp(optionName)}(?:\\s|$)`),
    })
    .click();
}

test("My Work filters direct assignments while Our Work supports Church-wide creation", async ({
  page,
}) => {
  const suffix = randomUUID();
  const assignedTaskTitle = `Assigned My Work Task ${suffix}`;
  const sharedTaskTitle = `Shared Our Work Task ${suffix}`;

  await page.goto("/my-work");
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("My Work");
  // Headline path (ADR 0013): create a Task from My Work via the Team picker.
  await createTask(page, assignedTaskTitle, { team: "Production" });
  await expect(taskCard(page, assignedTaskTitle)).toBeVisible();

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Our Work" }).click();
  await expect(page).toHaveURL(/\/our-work$/);
  await createTask(page, sharedTaskTitle, { team: "Production" });
  await expect(taskCard(page, assignedTaskTitle)).toBeVisible();
  await expect(taskCard(page, sharedTaskTitle)).toBeVisible();

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "My Work" }).click();
  await expect(page).toHaveURL(/\/my-work$/);
  await expect(taskCard(page, assignedTaskTitle)).toBeVisible();
  await expect(taskCard(page, sharedTaskTitle)).not.toBeVisible();
});

test("Our Work assignment feeds My Work and board movement persists", async ({
  authenticatedUser,
  page,
}) => {
  const taskTitle = `Assignable Our Work Task ${randomUUID()}`;

  await page.goto("/my-work");
  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Our Work" }).click();
  await createTask(page, taskTitle, { team: "Production" });

  const task = taskCard(page, taskTitle);
  await expect(task).toBeVisible();
  await chooseCardOption(page, task, "Assign to", authenticatedUser.userName!);

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "My Work" }).click();
  await expect(taskCard(page, taskTitle)).toBeVisible();

  await chooseCardOption(page, taskCard(page, taskTitle), "Change status", "In Progress");
  await expect(page.getByLabel("In Progress Tasks").getByText(taskTitle)).toBeVisible();

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Our Work" }).click();
  await expect(page.getByLabel("In Progress Tasks").getByText(taskTitle)).toBeVisible();
});

test("My Work lifecycle actions complete, cancel, and reopen Tasks", async ({ page }) => {
  const suffix = randomUUID();
  const completedTaskTitle = `Lifecycle Complete Task ${suffix}`;
  const canceledTaskTitle = `Lifecycle Cancel Task ${suffix}`;

  await page.goto("/my-work");
  await createTask(page, completedTaskTitle, { team: "Production" });
  const completedTask = taskCard(page, completedTaskTitle);
  await expect(completedTask).toBeVisible();
  await chooseCardOption(page, completedTask, "Change status", "Done");
  await expect(page.getByLabel("Done Tasks").getByText(completedTaskTitle)).toBeVisible();

  await createTask(page, canceledTaskTitle, { team: "Production" });
  const canceledTask = taskCard(page, canceledTaskTitle);
  await expect(canceledTask).toBeVisible();
  await chooseCardOption(page, canceledTask, "Change status", "Done");
  await expect(page.getByLabel("Done Tasks").getByText(canceledTaskTitle)).toBeVisible();
  await chooseCardOption(page, taskCard(page, canceledTaskTitle), "Change status", "To Do");
  await expect(page.getByLabel("To Do Tasks").getByText(canceledTaskTitle)).toBeVisible();
});

test("Team routes remain accessible under the copied app shell", async ({
  authenticatedUser,
  page,
}) => {
  const teamName = `Care Team ${randomUUID()}`;

  await page.goto("/settings/team/members");
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  const teamsSettings = page.getByRole("region", { name: "Teams" });
  await teamsSettings.getByLabel("New Team Name").fill(teamName);
  await teamsSettings.getByRole("button", { name: "Create Team" }).click();
  await expect(page.getByText(`Created Team ${teamName}.`)).toBeVisible();

  const membershipsSettings = page.getByRole("region", {
    name: "Team Memberships",
  });
  await membershipsSettings.getByLabel("Team").selectOption({ label: teamName });
  await membershipsSettings
    .getByLabel("Church Member")
    .selectOption({ label: authenticatedUser.email });
  await membershipsSettings.getByRole("button", { name: "Add Team Member" }).click();
  await expect(page.getByText(`Added ${authenticatedUser.email} to ${teamName}.`)).toBeVisible();

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: teamName }).click();
  await expect(page).toHaveURL(/\/team\//);
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Team Work");
  await expect(page.getByLabel("To Do Tasks")).toBeVisible();
});
