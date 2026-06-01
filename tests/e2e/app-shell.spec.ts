import { expect, type Page, test } from "@playwright/test";

test.skip(
  process.env.CHURCH_TASK_E2E_READY !== "1",
  process.env.CHURCH_TASK_E2E_SKIP_REASON ?? "E2E environment is not configured.",
);

async function signUpThroughDashboard(page: Page, email: string, name = "E2E Signup User") {
  await page.goto("/dashboard");

  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("E2ePassword123!");
  await page.getByRole("button", { name: "Sign Up" }).click();

  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByText("Create Your First Church")).toBeVisible();
}

async function signUpThroughDashboardToInvitation(
  page: Page,
  email: string,
  name = "E2E Invited User",
) {
  await page.goto("/dashboard");

  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("E2ePassword123!");
  await page.getByRole("button", { name: "Sign Up" }).click();

  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByText("Accept Church Invitation")).toBeVisible();
}

async function createFirstChurch(page: Page, churchName: string) {
  await page.getByLabel("Church Name").fill(churchName);
  await page.getByRole("button", { name: "Create Church" }).click();

  await expect(page.getByRole("heading", { name: "My Work", level: 1 })).toBeVisible();
  await expect(page.getByText(`Active Church: ${churchName}`)).toBeVisible();
}

async function signInThroughDashboard(page: Page, email: string) {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Already have an account? Sign In" }).click();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("E2ePassword123!");
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL("/dashboard");
}

async function dragTaskCardToStatus(page: Page, taskTitle: string, statusName: string) {
  const taskCard = page.getByLabel(`Task card ${taskTitle}`);
  const destination = page.getByLabel(`${statusName} Tasks`);
  await expect(taskCard).toBeVisible();
  await expect(destination).toBeVisible();

  const sourceBox = await taskCard.boundingBox();
  const destinationBox = await destination.boundingBox();
  if (!sourceBox || !destinationBox) {
    throw new Error(`Could not drag ${taskTitle} to ${statusName}: missing bounding box.`);
  }

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    destinationBox.x + destinationBox.width / 2,
    destinationBox.y + destinationBox.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  if (await page.getByLabel(`${statusName} Tasks`).getByText(taskTitle).isVisible().catch(() => false)) {
    return;
  }

  await taskCard.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
}

test("home route shows the app shell and connected API status", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/church-task/);
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "API Status" })).toBeVisible();
  await expect(page.getByText("Connected")).toBeVisible();
});

test("header navigation moves between Home and Dashboard", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible();

  await page.getByRole("link", { name: "Home" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "API Status" })).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();

  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible();
});

test("dashboard shows signup by default when unauthenticated", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible();
  await expect(page.getByLabel("Name")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign Up" })).toBeVisible();
});

test("dashboard auth entry switches between signup and signin", async ({ page }) => {
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Already have an account? Sign In" }).click();

  await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();

  await page.getByRole("button", { name: "Need an account? Sign Up" }).click();

  await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign Up" })).toBeVisible();
});

test("signup shows validation errors for invalid values", async ({ page }) => {
  await page.goto("/dashboard");

  await page.getByLabel("Name").fill("A");
  await page.getByLabel("Email").fill("invalid@example");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Sign Up" }).click();

  await expect(page.getByText("Name must be at least 2 characters")).toBeVisible();
  await expect(page.getByText("Invalid email address")).toBeVisible();
  await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
});

test("signup gates the user on creating their first Church", async ({ page }, testInfo) => {
  const uniqueEmail = `e2e-signup-${Date.now()}-${testInfo.workerIndex}@example.com`;

  await signUpThroughDashboard(page, uniqueEmail);

  await expect(
    page.getByText("Church Task needs an active Church before you can enter the app."),
  ).toBeVisible();
  await expect(page.getByLabel("Church Name")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Church" })).toBeVisible();
});

test("creating the first Church reaches the authenticated My Work dashboard", async ({
  page,
}, testInfo) => {
  const uniqueEmail = `e2e-church-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Church ${Date.now()}`;

  await signUpThroughDashboard(page, uniqueEmail);
  await createFirstChurch(page, churchName);

  await expect(page.getByRole("heading", { name: "My Work", level: 1 })).toBeVisible();
  await expect(
    page.getByText("Tasks assigned directly to you in the current execution window."),
  ).toBeVisible();
});

test("authenticated dashboard lands on My Work and filters to directly assigned Tasks", async ({
  page,
}, testInfo) => {
  const uniqueEmail = `e2e-my-work-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const assignedTaskTitle = `Assigned My Work Task ${Date.now()}`;
  const sharedTaskTitle = `Shared Our Work Task ${Date.now()}`;

  await signUpThroughDashboard(page, uniqueEmail, "E2E My Work User");
  await createFirstChurch(page, `E2E My Work Church ${Date.now()}`);

  await expect(page.getByRole("heading", { name: "My Work", level: 1 })).toBeVisible();
  await expect(page.getByText("No Tasks assigned to you")).toBeVisible();

  await page.getByPlaceholder("Add a Task assigned to me").fill(assignedTaskTitle);
  await page.getByRole("button", { name: "Create Task" }).click();
  await expect(page.getByText(assignedTaskTitle).first()).toBeVisible();

  await page.getByRole("button", { name: "Our Work", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Our Work", level: 1 })).toBeVisible();
  await page.getByPlaceholder("Add Church-wide Task").fill(sharedTaskTitle);
  await page.getByRole("button", { name: "Create Task" }).click();
  await expect(page.getByText(assignedTaskTitle).first()).toBeVisible();
  await expect(page.getByText(sharedTaskTitle).first()).toBeVisible();

  await page.getByRole("button", { name: "My Work", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My Work", level: 1 })).toBeVisible();
  await expect(page.getByText(assignedTaskTitle).first()).toBeVisible();
  await expect(page.getByText(sharedTaskTitle)).not.toBeVisible();
});

test("Our Work assignment feeds My Work and board movement persists", async ({
  page,
}, testInfo) => {
  const uniqueEmail = `e2e-our-work-assignment-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const userName = "E2E Our Work Assignee";
  const taskTitle = `Assignable Our Work Task ${Date.now()}`;

  await signUpThroughDashboard(page, uniqueEmail, userName);
  await createFirstChurch(page, `E2E Our Work Assignment Church ${Date.now()}`);

  await page.getByRole("button", { name: "Our Work", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Our Work", level: 1 })).toBeVisible();
  await page.getByPlaceholder("Add Church-wide Task").fill(taskTitle);
  await page.getByRole("button", { name: "Create Task" }).click();

  const taskActions = page.getByRole("group", { name: `Actions for ${taskTitle}` });
  await expect(taskActions).toBeVisible();
  await taskActions.getByLabel(`Assign ${taskTitle}`).selectOption({ label: userName });
  await expect(taskActions.getByLabel(`Assign ${taskTitle}`)).toHaveValue(/.+/);

  await page.getByRole("button", { name: "My Work", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My Work", level: 1 })).toBeVisible();
  await expect(page.getByText(taskTitle).first()).toBeVisible();

  await dragTaskCardToStatus(page, taskTitle, "In Progress");
  await expect(page.getByLabel("In Progress Tasks").getByText(taskTitle)).toBeVisible();

  await page.getByRole("button", { name: "Our Work", exact: true }).click();
  await expect(page.getByLabel("In Progress Tasks").getByText(taskTitle)).toBeVisible();
});

test("My Work lifecycle actions complete, cancel, and reopen Tasks", async ({ page }, testInfo) => {
  const uniqueEmail = `e2e-my-work-lifecycle-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const completedTaskTitle = `Lifecycle Complete Task ${Date.now()}`;
  const canceledTaskTitle = `Lifecycle Cancel Task ${Date.now()}`;

  await signUpThroughDashboard(page, uniqueEmail, "E2E My Work Lifecycle User");
  await createFirstChurch(page, `E2E My Work Lifecycle Church ${Date.now()}`);

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

test("My Work updates Task fields and creates Subtasks", async ({ page }, testInfo) => {
  const uniqueEmail = `e2e-my-work-updates-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const taskTitle = `Editable My Work Task ${Date.now()}`;
  const renamedTaskTitle = `Renamed My Work Task ${Date.now()}`;
  const subtaskTitle = `Follow-up Subtask ${Date.now()}`;

  await signUpThroughDashboard(page, uniqueEmail, "E2E My Work Update User");
  await createFirstChurch(page, `E2E My Work Update Church ${Date.now()}`);

  await page.getByPlaceholder("Add a Task assigned to me").fill(taskTitle);
  await page.getByRole("button", { name: "Create Task" }).click();

  const taskActions = page.getByRole("group", { name: `Actions for ${taskTitle}` });
  await expect(taskActions).toBeVisible();

  await taskActions
    .getByRole("textbox", { name: `Title for ${taskTitle}`, exact: true })
    .fill(renamedTaskTitle);
  await taskActions.getByRole("button", { name: "Save Title" }).click();
  await expect(page.getByRole("group", { name: `Actions for ${renamedTaskTitle}` })).toBeVisible();

  const cycleLabel = await page
    .getByText(/Cycle: .+ to .+/)
    .first()
    .innerText();
  const [, cycleStartDate] = /Cycle: (\d{4}-\d{2}-\d{2}) to /.exec(cycleLabel) ?? [];
  if (!cycleStartDate) {
    throw new Error(`Could not read current Cycle from label: ${cycleLabel}`);
  }

  const renamedTaskActions = page.getByRole("group", { name: `Actions for ${renamedTaskTitle}` });
  await renamedTaskActions.getByLabel(`Due Date for ${renamedTaskTitle}`).fill(cycleStartDate);
  await renamedTaskActions.getByRole("button", { name: "Save" }).click();
  await expect(renamedTaskActions.getByLabel(`Due Date for ${renamedTaskTitle}`)).toHaveValue(
    cycleStartDate,
  );

  await renamedTaskActions.getByLabel(`Subtask title for ${renamedTaskTitle}`).fill(subtaskTitle);
  await renamedTaskActions.getByRole("button", { name: "Add Subtask" }).click();
  await expect(page.getByText(subtaskTitle).first()).toBeVisible();
  await expect(page.getByText(`Parent: ${renamedTaskTitle}`).first()).toBeVisible();
});

test("Team sidebar navigation opens a Team board filtered to that Team", async ({
  page,
}, testInfo) => {
  const ownerEmail = `e2e-team-board-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const nonTeamMemberEmail = `e2e-team-board-helper-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const ownerName = "E2E Team Board Owner";
  const nonTeamMemberName = "E2E Cross Team Helper";
  const teamName = `Care Team ${Date.now()}`;
  const teamTaskTitle = `Team Board Task ${Date.now()}`;
  const churchTaskTitle = `Church Wide Task ${Date.now()}`;

  await signUpThroughDashboard(page, ownerEmail, ownerName);
  await createFirstChurch(page, `E2E Team Board Church ${Date.now()}`);
  await page.goto("/dashboard?work=settings");
  await expect(page.getByRole("heading", { name: "Active Church Settings", level: 1 })).toBeVisible();
  await page.getByLabel("Invite Member Email").fill(nonTeamMemberEmail);
  await page.getByRole("button", { name: "Invite Member" }).click();
  await expect(page.getByText(`Invitation sent to ${nonTeamMemberEmail}.`)).toBeVisible();
  await page.getByRole("button", { name: ownerName }).click();
  await page.getByRole("menuitem", { name: "Sign Out" }).click();

  await signUpThroughDashboardToInvitation(page, nonTeamMemberEmail, nonTeamMemberName);
  await page.getByRole("button", { name: "Accept Invitation" }).click();
  await expect(page.getByText(/Active Church: E2E Team Board Church/)).toBeVisible();
  await page.getByRole("button", { name: nonTeamMemberName }).click();
  await page.getByRole("menuitem", { name: "Sign Out" }).click();

  await signInThroughDashboard(page, ownerEmail);
  await page.getByRole("button", { name: "Active Church Settings" }).click();

  const teamsSettings = page.getByRole("region", { name: "Teams" });
  await teamsSettings.getByLabel("New Team Name").fill(teamName);
  await teamsSettings.getByRole("button", { name: "Create Team" }).click();
  await expect(page.getByText(`Created Team ${teamName}.`)).toBeVisible();

  const workflowsSettings = page.getByRole("region", { name: "Workflows" });
  await workflowsSettings.getByLabel(`Default Workflow for ${teamName}`).selectOption({
    label: "Default Workflow",
  });
  await expect(page.getByText(`Set ${teamName} to use Default Workflow by default.`)).toBeVisible();

  const membershipsSettings = page.getByRole("region", { name: "Team Memberships" });
  await membershipsSettings.getByLabel("Team").selectOption({ label: teamName });
  await membershipsSettings.getByLabel("Church Member").selectOption({ label: ownerEmail });
  await membershipsSettings.getByRole("button", { name: "Add Team Member" }).click();
  await expect(page.getByText(`Added ${ownerEmail} to ${teamName}.`)).toBeVisible();

  await page.getByRole("button", { name: teamName }).first().click();
  await expect(page.getByRole("heading", { name: teamName, level: 1 })).toBeVisible();
  await expect(page.getByText("Team Tasks in the current execution window.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "To Do", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "In Progress", level: 2 })).toBeVisible();

  await page.getByPlaceholder("Add Team Task").fill(teamTaskTitle);
  await page.getByRole("button", { name: "Create Task" }).click();
  await expect(page.getByText(teamTaskTitle).first()).toBeVisible();

  const teamTaskActions = page.getByRole("group", { name: `Actions for ${teamTaskTitle}` });
  await expect(teamTaskActions).toBeVisible();
  await teamTaskActions
    .getByLabel(`Assign ${teamTaskTitle}`)
    .selectOption({ label: nonTeamMemberName });
  await expect(teamTaskActions.getByLabel(`Assign ${teamTaskTitle}`)).toHaveValue(/.+/);

  await dragTaskCardToStatus(page, teamTaskTitle, "In Progress");
  await expect(page.getByLabel("In Progress Tasks").getByText(teamTaskTitle)).toBeVisible();

  await page.getByRole("button", { name: "Our Work", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Our Work", level: 1 })).toBeVisible();
  await page.getByPlaceholder("Add Church-wide Task").fill(churchTaskTitle);
  await page.getByRole("button", { name: "Create Task" }).click();
  await expect(page.getByText(teamTaskTitle).first()).toBeVisible();
  await expect(page.getByText(churchTaskTitle).first()).toBeVisible();

  await page.getByRole("button", { name: teamName }).first().click();
  await expect(page.getByRole("heading", { name: teamName, level: 1 })).toBeVisible();
  await expect(page.getByLabel("In Progress Tasks").getByText(teamTaskTitle)).toBeVisible();
  await expect(page.getByText(churchTaskTitle)).not.toBeVisible();
});

test("church switcher creates another Church and switches Active Church", async ({
  page,
}, testInfo) => {
  const uniqueEmail = `e2e-switcher-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const firstChurch = `E2E First Church ${Date.now()}`;
  const secondChurch = `E2E Second Church ${Date.now()}`;

  await signUpThroughDashboard(page, uniqueEmail);
  await createFirstChurch(page, firstChurch);

  await expect(page.getByText("Switch Church")).toBeVisible();
  await expect(page.getByRole("button", { name: firstChurch })).toBeDisabled();

  await page.getByLabel("Create Another Church").fill(secondChurch);
  await page.getByRole("button", { name: "Create Church" }).click();

  await expect(page.getByText(`Active Church: ${secondChurch}`)).toBeVisible();
  await expect(page.getByRole("button", { name: secondChurch })).toBeDisabled();

  await page.getByRole("button", { name: firstChurch }).click();

  await expect(page.getByText(`Active Church: ${firstChurch}`)).toBeVisible();
});

test("active Church shell invites members and shows pending invitations", async ({
  page,
}, testInfo) => {
  const uniqueEmail = `e2e-inviter-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const inviteeEmail = `e2e-invitee-${Date.now()}-${testInfo.workerIndex}@example.com`;

  await signUpThroughDashboard(page, uniqueEmail);
  await createFirstChurch(page, `E2E Inviting Church ${Date.now()}`);

  await expect(page.getByRole("heading", { name: "Church Invitations" })).toBeVisible();
  await expect(page.getByText("No pending invitations.")).toBeVisible();

  await page.getByLabel("Invite Member Email").fill(inviteeEmail);
  await page.getByLabel("Role").selectOption("admin");
  await page.getByRole("button", { name: "Invite Member" }).click();

  await expect(page.getByText(`Invitation sent to ${inviteeEmail}.`)).toBeVisible();
  await expect(page.getByText(inviteeEmail)).toBeVisible();
  await expect(page.getByText("admin")).toBeVisible();
});

test("active Church shell shows the User's Church Membership context", async ({
  page,
}, testInfo) => {
  const uniqueEmail = `e2e-member-context-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const userName = "E2E Member Context User";

  await signUpThroughDashboard(page, uniqueEmail, userName);
  await createFirstChurch(page, `E2E Member Context Church ${Date.now()}`);

  await expect(page.getByRole("heading", { name: "Church Members" })).toBeVisible();
  await expect(page.getByText(userName)).toBeVisible();
  await expect(page.getByText(uniqueEmail)).toBeVisible();
  await expect(page.getByText("owner")).toBeVisible();
});

test("active Church member can navigate to readable setup settings", async ({ page }, testInfo) => {
  const ownerEmail = `e2e-settings-owner-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const memberEmail = `e2e-settings-member-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Settings Church ${Date.now()}`;

  await signUpThroughDashboard(page, ownerEmail, "E2E Settings Owner");
  await createFirstChurch(page, churchName);
  await page.getByLabel("Invite Member Email").fill(memberEmail);
  await page.getByRole("button", { name: "Invite Member" }).click();
  await expect(page.getByText(`Invitation sent to ${memberEmail}.`)).toBeVisible();
  await page.getByRole("button", { name: "E2E Settings Owner" }).click();
  await page.getByRole("menuitem", { name: "Sign Out" }).click();

  await signUpThroughDashboardToInvitation(page, memberEmail, "E2E Settings Member");
  await page.getByRole("button", { name: "Accept Invitation" }).click();
  await expect(page.getByText(`Active Church: ${churchName}`)).toBeVisible();

  await page.getByRole("button", { name: "Active Church Settings" }).click();

  await expect(page.getByRole("heading", { name: "Active Church Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Team Memberships" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Workflows" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Workflow Statuses" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Church Time Zone" })).toBeVisible();
  await expect(page.getByText("Only Church owners and admins can change Teams.")).toBeVisible();
  await expect(
    page.getByText("Only Church owners and admins can change Team Memberships."),
  ).toBeVisible();
  await expect(page.getByText("Only Church owners and admins can change Workflows.")).toBeVisible();
  await expect(
    page.getByText("Only Church owners and admins can change Workflow Statuses."),
  ).toBeVisible();
  await expect(page.getByText(/Organization|Org/)).not.toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Create Team|Archive Team|Add Team Member|Remove .+ from .+|Create Workflow|Archive Workflow|Add Workflow Status|Archive Workflow Status|Update Time Zone/,
    }),
  ).not.toBeVisible();
});

test("owner updates Church Time Zone from settings", async ({ page }, testInfo) => {
  const ownerEmail = `e2e-time-zone-owner-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Time Zone Church ${Date.now()}`;

  await signUpThroughDashboard(page, ownerEmail, "E2E Time Zone Owner");
  await createFirstChurch(page, churchName);

  await page.getByRole("button", { name: "Active Church Settings" }).click();
  const timeZoneSettings = page.getByRole("region", { name: "Church Time Zone" });
  await timeZoneSettings.getByLabel("Church Time Zone").selectOption("America/Los_Angeles");
  await timeZoneSettings.getByRole("button", { name: "Update Time Zone" }).click();

  await expect(page.getByText("Updated Church Time Zone to America/Los_Angeles.")).toBeVisible();
  await expect(
    timeZoneSettings.getByText("Current Church Time Zone: America/Los_Angeles"),
  ).toBeVisible();
});

test("owner manages Teams and Team Memberships from settings", async ({ page }, testInfo) => {
  const ownerEmail = `e2e-team-owner-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const memberEmail = `e2e-team-member-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Team Settings Church ${Date.now()}`;

  await signUpThroughDashboard(page, ownerEmail, "E2E Team Owner");
  await createFirstChurch(page, churchName);
  await page.getByLabel("Invite Member Email").fill(memberEmail);
  await page.getByRole("button", { name: "Invite Member" }).click();
  await expect(page.getByText(`Invitation sent to ${memberEmail}.`)).toBeVisible();
  await page.getByRole("button", { name: "E2E Team Owner" }).click();
  await page.getByRole("menuitem", { name: "Sign Out" }).click();

  await signUpThroughDashboardToInvitation(page, memberEmail, "E2E Team Member");
  await page.getByRole("button", { name: "Accept Invitation" }).click();
  await expect(page.getByText(`Active Church: ${churchName}`)).toBeVisible();
  await page.getByRole("button", { name: "E2E Team Member" }).click();
  await page.getByRole("menuitem", { name: "Sign Out" }).click();

  await signInThroughDashboard(page, ownerEmail);
  await page.getByRole("button", { name: "Active Church Settings" }).click();

  const teamsSettings = page.getByRole("region", { name: "Teams" });
  await teamsSettings.getByLabel("New Team Name").fill("Prayer");
  await teamsSettings.getByRole("button", { name: "Create Team" }).click();
  await expect(page.getByText("Created Team Prayer.")).toBeVisible();
  await expect(teamsSettings.getByText("Prayer")).toBeVisible();

  await teamsSettings.getByLabel("Rename Prayer").fill("Care");
  await teamsSettings.getByRole("button", { name: "Rename Team Prayer" }).click();
  await expect(page.getByText("Renamed Team to Care.")).toBeVisible();
  await expect(teamsSettings.getByText("Care")).toBeVisible();

  await teamsSettings.getByRole("button", { name: "Move Care Up" }).click();
  await expect(page.getByText("Reordered Teams.")).toBeVisible();

  const membershipsSettings = page.getByRole("region", { name: "Team Memberships" });
  await membershipsSettings.getByLabel("Team").selectOption({ label: "Care" });
  await membershipsSettings.getByLabel("Church Member").selectOption({ label: memberEmail });
  await membershipsSettings.getByRole("button", { name: "Add Team Member" }).click();
  await expect(page.getByText(`Added ${memberEmail} to Care.`)).toBeVisible();
  await expect(membershipsSettings.getByText("Care")).toBeVisible();
  await expect(membershipsSettings.getByText(memberEmail)).toBeVisible();

  await membershipsSettings
    .getByRole("button", { name: `Remove ${memberEmail} from Care` })
    .click();
  await expect(page.getByText(`Removed ${memberEmail} from Care.`)).toBeVisible();
  await expect(
    membershipsSettings.getByRole("button", { name: `Remove ${memberEmail} from Care` }),
  ).not.toBeVisible();

  await teamsSettings.getByRole("button", { name: "Archive Team Care" }).click();
  await expect(page.getByText("Archived Team Care.")).toBeVisible();
  await expect(teamsSettings.getByText("Care")).not.toBeVisible();
});

test("owner manages Workflows and Workflow Statuses from settings", async ({ page }, testInfo) => {
  const ownerEmail = `e2e-workflow-owner-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Workflow Settings Church ${Date.now()}`;

  await signUpThroughDashboard(page, ownerEmail, "E2E Workflow Owner");
  await createFirstChurch(page, churchName);
  await page.getByRole("button", { name: "Active Church Settings" }).click();

  const workflowsSettings = page.getByRole("region", { name: "Workflows" });
  await workflowsSettings.getByLabel("New Workflow Name").fill("Creative Pipeline");
  await workflowsSettings.getByRole("button", { name: "Create Workflow" }).click();
  await expect(page.getByText("Created Workflow Creative Pipeline.")).toBeVisible();
  await expect(workflowsSettings.getByText("Creative Pipeline")).toBeVisible();

  await workflowsSettings.getByLabel("Rename Creative Pipeline").fill("Creative Review");
  await workflowsSettings
    .getByRole("button", { name: "Rename Workflow Creative Pipeline" })
    .click();
  await expect(page.getByText("Renamed Workflow to Creative Review.")).toBeVisible();

  await workflowsSettings.getByRole("button", { name: "Move Creative Review Up" }).click();
  await expect(page.getByText("Reordered Workflows.")).toBeVisible();

  await workflowsSettings.getByLabel("Church Default Workflow").selectOption({
    label: "Creative Review",
  });
  await expect(page.getByText("Set Creative Review as the Church default Workflow.")).toBeVisible();

  const teamsSettings = page.getByRole("region", { name: "Teams" });
  await teamsSettings.getByLabel("New Team Name").fill("Prayer");
  await teamsSettings.getByRole("button", { name: "Create Team" }).click();
  await expect(page.getByText("Created Team Prayer.")).toBeVisible();

  await workflowsSettings.getByLabel("Default Workflow for Prayer").selectOption({
    label: "Creative Review",
  });
  await expect(page.getByText("Set Prayer to use Creative Review by default.")).toBeVisible();

  await workflowsSettings.getByRole("button", { name: "Archive Workflow Creative Review" }).click();
  await expect(page.getByRole("dialog", { name: "Workflow Cannot Be Archived" })).toBeVisible();
  await expect(
    page.getByText("reassign the Church default Workflow, Teams, or Tasks"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await workflowsSettings.getByLabel("Church Default Workflow").selectOption({
    label: "Default Workflow",
  });
  await workflowsSettings.getByLabel("Default Workflow for Prayer").selectOption({
    label: "Use Church default Workflow",
  });
  await workflowsSettings.getByRole("button", { name: "Archive Workflow Creative Review" }).click();
  await expect(page.getByText("Archived Workflow Creative Review.")).toBeVisible();
  await expect(workflowsSettings.getByText("Creative Review")).not.toBeVisible();

  await workflowsSettings.getByLabel("New Workflow Name").fill("Production Flow");
  await workflowsSettings.getByRole("button", { name: "Create Workflow" }).click();
  await expect(page.getByText("Created Workflow Production Flow.")).toBeVisible();

  const statusesSettings = page.getByRole("region", { name: "Workflow Statuses" });
  await statusesSettings.getByLabel("Workflow for Status Editing").selectOption({
    label: "Production Flow",
  });
  await statusesSettings.getByLabel("New Workflow Status Name").fill("Needs Review");
  await statusesSettings.getByLabel("New Workflow Status Task State").selectOption("in_progress");
  await expect(
    statusesSettings.getByLabel("New Workflow Status Task State").getByText("Canceled"),
  ).not.toBeVisible();
  await statusesSettings.getByRole("button", { name: "Add Workflow Status" }).click();
  await expect(page.getByText("Added Workflow Status Needs Review.")).toBeVisible();

  await statusesSettings.getByRole("button", { name: "Archive Workflow Status To Do" }).click();
  await expect(
    page.getByRole("dialog", { name: "Workflow Status Cannot Be Archived" }),
  ).toBeVisible();
  await expect(page.getByText("keep one To Do, In Progress, and Done status")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await statusesSettings.getByLabel("Rename Needs Review").fill("Reviewing Assets");
  await statusesSettings
    .getByRole("button", { name: "Rename Workflow Status Needs Review" })
    .click();
  await expect(page.getByText("Renamed Workflow Status to Reviewing Assets.")).toBeVisible();

  await statusesSettings.getByRole("button", { name: "Move Reviewing Assets Up" }).click();
  await expect(page.getByText("Reordered Workflow Statuses.")).toBeVisible();

  await statusesSettings
    .getByRole("button", { name: "Archive Workflow Status Reviewing Assets" })
    .click();
  await expect(page.getByText("Archived Workflow Status Reviewing Assets.")).toBeVisible();
  await expect(statusesSettings.getByText("Reviewing Assets")).not.toBeVisible();
});

test("admin manages Workflows and Workflow Statuses from settings", async ({ page }, testInfo) => {
  const ownerEmail = `e2e-workflow-admin-owner-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const adminEmail = `e2e-workflow-admin-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Workflow Admin Church ${Date.now()}`;

  await signUpThroughDashboard(page, ownerEmail, "E2E Workflow Admin Owner");
  await createFirstChurch(page, churchName);
  await page.getByLabel("Invite Member Email").fill(adminEmail);
  await page.getByRole("button", { name: "Invite Member" }).click();
  await expect(page.getByText(`Invitation sent to ${adminEmail}.`)).toBeVisible();
  await page.getByRole("button", { name: "E2E Workflow Admin Owner" }).click();
  await page.getByRole("menuitem", { name: "Sign Out" }).click();

  await signUpThroughDashboardToInvitation(page, adminEmail, "E2E Workflow Admin");
  await page.getByRole("button", { name: "Accept Invitation" }).click();
  await expect(page.getByText(`Active Church: ${churchName}`)).toBeVisible();
  await page.getByRole("button", { name: "E2E Workflow Admin" }).click();
  await page.getByRole("menuitem", { name: "Sign Out" }).click();

  await signInThroughDashboard(page, ownerEmail);
  await page.getByLabel(`Role for ${adminEmail}`).selectOption("admin");
  await expect(page.getByText(`Updated ${adminEmail} to admin.`)).toBeVisible();
  await page.getByRole("button", { name: "E2E Workflow Admin Owner" }).click();
  await page.getByRole("menuitem", { name: "Sign Out" }).click();

  await signInThroughDashboard(page, adminEmail);
  await page.getByRole("button", { name: "Active Church Settings" }).click();

  const workflowsSettings = page.getByRole("region", { name: "Workflows" });
  await workflowsSettings.getByLabel("New Workflow Name").fill("Admin Review");
  await workflowsSettings.getByRole("button", { name: "Create Workflow" }).click();
  await expect(page.getByText("Created Workflow Admin Review.")).toBeVisible();

  const statusesSettings = page.getByRole("region", { name: "Workflow Statuses" });
  await statusesSettings.getByLabel("Workflow for Status Editing").selectOption({
    label: "Admin Review",
  });
  await statusesSettings.getByLabel("New Workflow Status Name").fill("Admin QA");
  await statusesSettings.getByLabel("New Workflow Status Task State").selectOption("in_progress");
  await statusesSettings.getByRole("button", { name: "Add Workflow Status" }).click();

  await expect(page.getByText("Added Workflow Status Admin QA.")).toBeVisible();
});

test("owner manages Church Member role and removal", async ({ page }, testInfo) => {
  const ownerEmail = `e2e-member-owner-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const memberEmail = `e2e-managed-member-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Managed Member Church ${Date.now()}`;

  await signUpThroughDashboard(page, ownerEmail, "E2E Member Owner");
  await createFirstChurch(page, churchName);
  await page.getByLabel("Invite Member Email").fill(memberEmail);
  await page.getByRole("button", { name: "Invite Member" }).click();
  await expect(page.getByText(`Invitation sent to ${memberEmail}.`)).toBeVisible();
  await page.getByRole("button", { name: "E2E Member Owner" }).click();
  await page.getByRole("menuitem", { name: "Sign Out" }).click();

  await signUpThroughDashboardToInvitation(page, memberEmail, "E2E Managed Member");
  await page.getByRole("button", { name: "Accept Invitation" }).click();
  await expect(page.getByText(`Active Church: ${churchName}`)).toBeVisible();
  await page.getByRole("button", { name: "E2E Managed Member" }).click();
  await page.getByRole("menuitem", { name: "Sign Out" }).click();

  await signInThroughDashboard(page, ownerEmail);
  await expect(page.getByText(memberEmail)).toBeVisible();

  await page.getByLabel(`Role for ${memberEmail}`).selectOption("admin");

  await expect(page.getByText(`Updated ${memberEmail} to admin.`)).toBeVisible();

  await page.getByRole("button", { name: `Remove ${memberEmail}` }).click();

  await expect(page.getByText(`Removed ${memberEmail}.`)).toBeVisible();
  await expect(page.getByRole("button", { name: `Remove ${memberEmail}` })).not.toBeVisible();
});

test("invited user accepts pending Church Invitation before creating a Church", async ({
  page,
}, testInfo) => {
  const inviterEmail = `e2e-invite-owner-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const inviteeEmail = `e2e-invite-accept-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Accepted Church ${Date.now()}`;

  await signUpThroughDashboard(page, inviterEmail);
  await createFirstChurch(page, churchName);

  await page.getByLabel("Invite Member Email").fill(inviteeEmail);
  await page.getByRole("button", { name: "Invite Member" }).click();
  await expect(page.getByText(`Invitation sent to ${inviteeEmail}.`)).toBeVisible();

  await page.getByRole("button", { name: "E2E Signup User" }).click();
  await page.getByRole("menuitem", { name: "Sign Out" }).click();
  await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible();

  await signUpThroughDashboardToInvitation(page, inviteeEmail);

  await expect(page.getByText(churchName)).toBeVisible();
  await expect(page.getByText("Role: member")).toBeVisible();

  await page.getByRole("button", { name: "Accept Invitation" }).click();

  await expect(page.getByRole("heading", { name: "My Work", level: 1 })).toBeVisible();
  await expect(page.getByText(`Active Church: ${churchName}`)).toBeVisible();
});

test("active Church user sees and accepts a pending invitation", async ({ page }, testInfo) => {
  const inviteeEmail = `e2e-active-invitee-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const inviterEmail = `e2e-active-inviter-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const inviteeChurch = `E2E Existing Church ${Date.now()}`;
  const invitingChurch = `E2E Inviting Active Church ${Date.now()}`;

  await signUpThroughDashboard(page, inviteeEmail, "E2E Active Invitee");
  await createFirstChurch(page, inviteeChurch);
  await page.getByRole("button", { name: "E2E Active Invitee" }).click();
  await page.getByRole("menuitem", { name: "Sign Out" }).click();

  await signUpThroughDashboard(page, inviterEmail, "E2E Active Inviter");
  await createFirstChurch(page, invitingChurch);
  await page.getByLabel("Invite Member Email").fill(inviteeEmail);
  await page.getByRole("button", { name: "Invite Member" }).click();
  await expect(page.getByText(`Invitation sent to ${inviteeEmail}.`)).toBeVisible();
  await page.getByRole("button", { name: "E2E Active Inviter" }).click();
  await page.getByRole("menuitem", { name: "Sign Out" }).click();

  await signInThroughDashboard(page, inviteeEmail);

  await expect(page.getByText(`Active Church: ${inviteeChurch}`)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pending Church Invitations" })).toBeVisible();
  await expect(page.getByText(invitingChurch)).toBeVisible();

  await page.getByRole("button", { name: "Accept Invitation" }).click();

  await expect(page.getByText(`Active Church: ${invitingChurch}`)).toBeVisible();
});

test("authenticated user menu shows account details and signs out", async ({ page }, testInfo) => {
  const uniqueEmail = `e2e-signout-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const userName = "E2E Sign Out User";

  await signUpThroughDashboard(page, uniqueEmail, userName);
  await createFirstChurch(page, `E2E Sign Out Church ${Date.now()}`);

  await page.getByRole("button", { name: userName }).click();

  await expect(page.getByText("My Account")).toBeVisible();
  await expect(page.getByText(uniqueEmail)).toBeVisible();

  await page.getByRole("menuitem", { name: "Sign Out" }).click();

  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign Up" })).toBeVisible();
});
