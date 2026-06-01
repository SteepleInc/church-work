import { expect, type Page, test } from "@playwright/test";

async function signUpThroughDashboard(page: Page, email: string, name = "E2E Signup User") {
  await page.goto("/dashboard");

  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("E2ePassword123!");
  await page.getByRole("button", { name: "Sign Up" }).click();

  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("heading", { name: "Create Your First Church" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Accept Church Invitation" })).toBeVisible();
}

async function createFirstChurch(page: Page, churchName: string) {
  await page.getByLabel("Church Name").fill(churchName);
  await page.getByRole("button", { name: "Create Church" }).click();

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
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

test("creating the first Church reaches the authenticated dashboard with private data", async ({
  page,
}, testInfo) => {
  const uniqueEmail = `e2e-church-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Church ${Date.now()}`;

  await signUpThroughDashboard(page, uniqueEmail);
  await createFirstChurch(page, churchName);

  await expect(page.getByText("privateData: This is private")).toBeVisible();
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
  await expect(page.getByText(/Organization|Org/)).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: /Create Team|Archive Team|Update Time Zone/ }),
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

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
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
