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
