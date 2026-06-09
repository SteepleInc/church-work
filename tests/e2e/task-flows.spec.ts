import { expect, test } from "@playwright/test";

import { signInAndCompleteOnboarding } from "./helpers";

test.skip(
  process.env.CHURCH_TASK_E2E_READY !== "1",
  process.env.CHURCH_TASK_E2E_SKIP_REASON ?? "E2E environment is not configured.",
);

async function createTask(page: import("@playwright/test").Page, title: string) {
  await page.getByRole("main").getByRole("button", { name: "Create Task" }).click();
  const dialog = page.getByRole("dialog", { name: "Create Task" });
  await dialog.getByPlaceholder("Add a Task").fill(title);
  await dialog.getByRole("button", { name: "Create Task" }).click();
}

const taskCard = (page: import("@playwright/test").Page, title: string) =>
  page.getByLabel(`Task card ${title}`);

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
    .getByRole("option", { name: new RegExp(`^${escapeRegExp(optionName)}(?:\\s|$)`) })
    .click();
}

test("My Work filters direct assignments while Our Work supports Church-wide creation", async ({
  page,
}, testInfo) => {
  const email = `task-flow-my-work-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const assignedTaskTitle = `Assigned My Work Task ${Date.now()}`;
  const sharedTaskTitle = `Shared Our Work Task ${Date.now()}`;

  await signInAndCompleteOnboarding(page, {
    email,
    churchName: `E2E My Work Church ${Date.now()}`,
  });

  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("My Work");
  await createTask(page, assignedTaskTitle);
  await expect(page.getByText(assignedTaskTitle).first()).toBeVisible();

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Our Work" }).click();
  await expect(page).toHaveURL(/\/our-work$/);
  await createTask(page, sharedTaskTitle);
  await expect(page.getByText(assignedTaskTitle).first()).toBeVisible();
  await expect(page.getByText(sharedTaskTitle).first()).toBeVisible();

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "My Work" }).click();
  await expect(page).toHaveURL(/\/my-work$/);
  await expect(page.getByText(assignedTaskTitle).first()).toBeVisible();
  await expect(page.getByText(sharedTaskTitle)).not.toBeVisible();
});

test("Our Work assignment feeds My Work and board movement persists", async ({
  page,
}, testInfo) => {
  const email = `task-flow-assignment-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const userName = "E2E Our Work Assignee";
  const taskTitle = `Assignable Our Work Task ${Date.now()}`;

  await signInAndCompleteOnboarding(page, {
    email,
    churchName: `E2E Assignment Church ${Date.now()}`,
    userName,
  });

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Our Work" }).click();
  await createTask(page, taskTitle);

  const task = taskCard(page, taskTitle);
  await expect(task).toBeVisible();
  await chooseCardOption(page, task, "Assign to", userName);

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "My Work" }).click();
  await expect(page.getByText(taskTitle).first()).toBeVisible();

  await chooseCardOption(page, taskCard(page, taskTitle), "Change status", "In Progress");
  await expect(page.getByLabel("In Progress Tasks").getByText(taskTitle)).toBeVisible();

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Our Work" }).click();
  await expect(page.getByLabel("In Progress Tasks").getByText(taskTitle)).toBeVisible();
});

test("My Work lifecycle actions complete, cancel, and reopen Tasks", async ({ page }, testInfo) => {
  const email = `task-flow-lifecycle-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const completedTaskTitle = `Lifecycle Complete Task ${Date.now()}`;
  const canceledTaskTitle = `Lifecycle Cancel Task ${Date.now()}`;

  await signInAndCompleteOnboarding(page, {
    email,
    churchName: `E2E Lifecycle Church ${Date.now()}`,
  });

  await createTask(page, completedTaskTitle);
  const completedTask = taskCard(page, completedTaskTitle);
  await expect(completedTask).toBeVisible();
  await chooseCardOption(page, completedTask, "Change status", "Done");
  await expect(page.getByLabel("Done Tasks").getByText(completedTaskTitle)).toBeVisible();

  await createTask(page, canceledTaskTitle);
  const canceledTask = taskCard(page, canceledTaskTitle);
  await expect(canceledTask).toBeVisible();
  await chooseCardOption(page, canceledTask, "Change status", "Done");
  await expect(page.getByLabel("Done Tasks").getByText(canceledTaskTitle)).toBeVisible();
  await chooseCardOption(page, taskCard(page, canceledTaskTitle), "Change status", "To Do");
  await expect(page.getByLabel("To Do Tasks").getByText(canceledTaskTitle)).toBeVisible();
});

test("Team routes remain accessible under the copied app shell", async ({ page }, testInfo) => {
  const email = `task-flow-team-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const userName = "E2E Team Board Owner";
  const teamName = `Care Team ${Date.now()}`;

  await signInAndCompleteOnboarding(page, {
    email,
    churchName: `E2E Team Board Church ${Date.now()}`,
    userName,
  });

  await page.goto("/settings/team/members");
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  const teamsSettings = page.getByRole("region", { name: "Teams" });
  await teamsSettings.getByLabel("New Team Name").fill(teamName);
  await teamsSettings.getByRole("button", { name: "Create Team" }).click();
  await expect(page.getByText(`Created Team ${teamName}.`)).toBeVisible();

  const membershipsSettings = page.getByRole("region", { name: "Team Memberships" });
  await membershipsSettings.getByLabel("Team").selectOption({ label: teamName });
  await membershipsSettings.getByLabel("Church Member").selectOption({ label: email });
  await membershipsSettings.getByRole("button", { name: "Add Team Member" }).click();
  await expect(page.getByText(`Added ${email} to ${teamName}.`)).toBeVisible();

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: teamName }).click();
  await expect(page).toHaveURL(/\/team\//);
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Team Work");
  await expect(
    page.getByText("Configure this Team's Workflow before using the Task board."),
  ).toBeVisible();
});
