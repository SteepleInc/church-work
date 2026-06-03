import { expect, test } from "@playwright/test";

import { dragTaskCardToStatus, signInAndCompleteOnboarding } from "./helpers";

test.skip(
  process.env.CHURCH_TASK_E2E_READY !== "1",
  process.env.CHURCH_TASK_E2E_SKIP_REASON ?? "E2E environment is not configured.",
);

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

  await expect(page.getByRole("heading", { name: "My Work", level: 1 })).toBeVisible();
  await expect(page.getByText("No Tasks assigned to you")).toBeVisible();
  await page.getByPlaceholder("Add a Task assigned to me").fill(assignedTaskTitle);
  await page.getByRole("button", { name: "Create Task" }).click();
  await expect(page.getByText(assignedTaskTitle).first()).toBeVisible();

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Our Work" }).click();
  await expect(page).toHaveURL(/\/our-work$/);
  await page.getByPlaceholder("Add Church-wide Task").fill(sharedTaskTitle);
  await page.getByRole("button", { name: "Create Task" }).click();
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
  await page.getByPlaceholder("Add Church-wide Task").fill(taskTitle);
  await page.getByRole("button", { name: "Create Task" }).click();

  const taskActions = page.getByRole("group", { name: `Actions for ${taskTitle}` });
  await expect(taskActions).toBeVisible();
  await taskActions.getByLabel(`Assign ${taskTitle}`).selectOption({ label: userName });
  await expect(taskActions.getByLabel(`Assign ${taskTitle}`)).toHaveValue(/.+/);

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "My Work" }).click();
  await expect(page.getByText(taskTitle).first()).toBeVisible();

  await dragTaskCardToStatus(page, taskTitle, "In Progress");
  await expect(page.getByLabel("In Progress Tasks").getByText(taskTitle)).toBeVisible();
  await expect(taskActions.getByText("State: in_progress")).toBeVisible();

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

  await page.getByPlaceholder("Add a Task assigned to me").fill(completedTaskTitle);
  await page.getByRole("button", { name: "Create Task" }).click();
  const completedTaskActions = page.getByRole("group", {
    name: `Actions for ${completedTaskTitle}`,
  });
  await expect(completedTaskActions).toBeVisible();
  await completedTaskActions.getByRole("button", { name: "Complete" }).click();
  await expect(completedTaskActions.getByText("State: done")).toBeVisible();
  await expect(completedTaskActions.getByText(/completed by User/)).toBeVisible();

  await page.getByPlaceholder("Add a Task assigned to me").fill(canceledTaskTitle);
  await page.getByRole("button", { name: "Create Task" }).click();
  const canceledTaskActions = page.getByRole("group", {
    name: `Actions for ${canceledTaskTitle}`,
  });
  await expect(canceledTaskActions).toBeVisible();
  await canceledTaskActions.getByRole("button", { name: "Cancel" }).click();
  await expect(canceledTaskActions.getByText("State: canceled")).toBeVisible();
  await expect(canceledTaskActions.getByText(/canceled by User/)).toBeVisible();
  await canceledTaskActions.getByRole("button", { name: "Reopen" }).click();
  await expect(canceledTaskActions.getByText("State: todo")).toBeVisible();
  await expect(canceledTaskActions.getByText(/reopened by User/)).toBeVisible();
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
  await expect(page.getByRole("heading", { name: teamName, level: 1 })).toBeVisible();
  await expect(page.getByText("Team Tasks in the current execution window.")).toBeVisible();
  await expect(
    page.getByText("Configure this Team's Workflow before using the Task board."),
  ).toBeVisible();
});
