import { expect, type Page, test } from "@playwright/test";

test.skip(
  process.env.CHURCH_TASK_E2E_READY !== "1",
  process.env.CHURCH_TASK_E2E_SKIP_REASON ?? "E2E environment is not configured.",
);

const getConvexSiteUrl = () => {
  const siteUrl = process.env.VITE_CONVEX_SITE_URL ?? process.env.CONVEX_SITE_URL;
  if (!siteUrl) {
    throw new Error("VITE_CONVEX_SITE_URL or CONVEX_SITE_URL must be set for onboarding e2e.");
  }
  return siteUrl;
};

async function waitForOtp(page: Page, email: string) {
  const siteUrl = getConvexSiteUrl();
  const encodedEmail = encodeURIComponent(email);

  await expect
    .poll(
      async () => {
        const response = await page.request.get(`${siteUrl}/api/test/otp?email=${encodedEmail}`);
        if (!response.ok()) return null;

        const body = (await response.json()) as { otp?: string | null };
        return body.otp ?? null;
      },
      { timeout: 10_000 },
    )
    .toMatch(/^\d{6}$/);

  const response = await page.request.get(`${siteUrl}/api/test/otp?email=${encodedEmail}`);
  const body = (await response.json()) as { otp: string };
  return body.otp;
}

async function signInWithOtp(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.locator('button[data-loading="false"]', { hasText: "Continue" }).click();
  await page.getByLabel("Verification Code").fill(await waitForOtp(page, email));
}

async function createTestInvitation(
  page: Page,
  invitation: { readonly email: string; readonly role: "member" | "admin" },
) {
  const sessionToken = await page.evaluate(async () => {
    const { authClient } = await import("/src/lib/auth-client.ts");
    const session = await authClient.getSession();

    return session.data?.session.token ?? null;
  });

  expect(sessionToken).toEqual(expect.any(String));

  const response = await page.request.post(`${getConvexSiteUrl()}/api/test/invitations`, {
    data: invitation,
    headers: { Authorization: `Bearer ${sessionToken}` },
  });

  test.skip(response.status() === 404, "Test invitation helper is not deployed.");
  expect(response.ok()).toBe(true);
}

async function completeOnboarding(page: Page, churchName: string) {
  await expect(page.getByText("Next up")).not.toBeVisible();
  await expect(page.getByText("Step 1 of 2")).not.toBeVisible();
  await expect(page.getByLabel("Find Your Church")).toBeVisible();

  // The Church profile fields stay hidden until the user enters them manually
  // or selects a church from the Google Maps search.
  await expect(page.getByLabel("Church Name")).not.toBeVisible();
  await page.getByTestId("onboarding-enter-manually").click();

  await expect(page.getByLabel("Find Your Church")).not.toBeVisible();
  await page.getByLabel("Church Name").fill(churchName);
  await page.getByLabel("Church Time Zone").fill("America/Chicago");
  await page.getByRole("button", { name: "Continue to Teams" }).click();
  await expect(page.getByText("Review the starting Teams", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter Church Task" })).toBeEnabled();
  await page.getByRole("button", { name: "Enter Church Task" }).click();
  await expect(page).toHaveURL(/\/my-work$/, { timeout: 20_000 });
}

async function getActiveOrganizationId(page: Page) {
  const activeOrganizationId = await page.evaluate(async () => {
    const { authClient } = await import("/src/lib/auth-client.ts");
    const session = await authClient.getSession();

    return session.data?.session.activeOrganizationId ?? null;
  });

  expect(activeOrganizationId).toEqual(expect.any(String));

  return activeOrganizationId!;
}

async function createIncompleteChurch(page: Page, churchName: string) {
  const churchId = await page.evaluate(
    async ({ churchName }) => {
      const { authClient } = await import("/src/lib/auth-client.ts");
      const result = await authClient.organization.create({
        churchTimeZone: "America/Chicago",
        name: churchName,
        slug: churchName
          .toLocaleLowerCase()
          .replaceAll(/[^a-z0-9]+/g, "-")
          .replaceAll(/^-|-$/g, ""),
      });

      if (result.error) {
        throw new Error(result.error.message ?? "Could not create incomplete Church.");
      }

      return result.data?.id ?? null;
    },
    { churchName },
  );
  expect(churchId).toEqual(expect.any(String));

  return churchId!;
}

async function setActiveOrganization(page: Page, organizationId: string) {
  await page.evaluate(
    async ({ organizationId }) => {
      const { authClient } = await import("/src/lib/auth-client.ts");
      const result = await authClient.organization.setActive({ organizationId });

      if (result.error) {
        throw new Error(result.error.message ?? "Could not select active Church.");
      }
    },
    { organizationId },
  );
}

test("creates a Church profile and reviews initial Teams", async ({ page }, testInfo) => {
  const email = `onboarding-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Onboarding Church ${Date.now()}`;

  await signInWithOtp(page, email);

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("Next up")).not.toBeVisible();
  await expect(page.getByText("Step 1 of 2")).not.toBeVisible();
  await expect(page.getByLabel("Find Your Church")).toBeVisible();
  await expect(page.getByLabel("Church Name")).not.toBeVisible();
  await page.getByTestId("onboarding-enter-manually").click();
  await expect(page.getByLabel("Find Your Church")).not.toBeVisible();
  await page.getByLabel("Church Name").fill(churchName);
  await page.getByLabel("Church Time Zone").fill("America/Chicago");
  await page.getByRole("button", { name: "Continue to Teams" }).click();

  await expect(page.getByText("Step 2 of 2")).not.toBeVisible();
  await expect(page.getByText("Review the starting Teams", { exact: false })).toBeVisible();
  await expect(page.getByText("Initial Church Task Team").first()).toBeVisible();
  await expect(page.getByText("Workflow setup")).not.toBeVisible();
  await page.getByLabel("Team 1 Name").fill("Creative");
  await page.getByRole("button", { name: "Remove Care" }).click();
  await page.getByLabel("New Team Name").fill("Students");
  await page.getByRole("button", { name: "Add Team" }).click();
  await expect(page.getByLabel("Team 1 Name")).toHaveValue("Creative");
  await expect(page.getByLabel("Team 3 Name")).toHaveValue("Students");
  await expect(page.getByText("3 Teams will be created.")).toBeVisible();
  await page.getByRole("button", { name: "Enter Church Task" }).click();

  await expect(page).toHaveURL(/\/my-work$/, { timeout: 20_000 });
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("My Work");
});

test("toggles cleanly between Find Your Church search and manual entry", async ({
  page,
}, testInfo) => {
  const email = `onboarding-toggle-${Date.now()}-${testInfo.workerIndex}@example.com`;

  await signInWithOtp(page, email);
  await expect(page).toHaveURL(/\/onboarding$/);

  // Search mode: only the Find Your Church input is shown; the profile fields
  // are hidden until the user enters them manually or selects a church.
  await expect(page.getByLabel("Find Your Church")).toBeVisible();
  await expect(page.getByTestId("onboarding-enter-manually")).toBeVisible();
  await expect(page.getByLabel("Church Name")).not.toBeVisible();
  await expect(page.getByLabel("Church Time Zone")).not.toBeVisible();

  // Manual mode: the search input is replaced by the manual profile fields.
  await page.getByTestId("onboarding-enter-manually").click();
  await expect(page.getByLabel("Find Your Church")).not.toBeVisible();
  await expect(page.getByTestId("onboarding-enter-manually")).not.toBeVisible();
  await expect(page.getByLabel("Church Name")).toBeVisible();
  await expect(page.getByLabel("Church Time Zone")).toBeVisible();
  await expect(page.getByTestId("onboarding-search-instead")).toBeVisible();

  // A stray value typed in manual mode must not leak back into search mode.
  await page.getByLabel("Church Name").fill("Temporary Name");

  // Back to search mode: the profile fields disappear again and the search
  // input returns, with no leftover "confirm" state from manual entry.
  await page.getByTestId("onboarding-search-instead").click();
  await expect(page.getByLabel("Find Your Church")).toBeVisible();
  await expect(page.getByTestId("onboarding-enter-manually")).toBeVisible();
  await expect(page.getByLabel("Church Name")).not.toBeVisible();
  await expect(page.getByLabel("Church Time Zone")).not.toBeVisible();
  await expect(page.getByTestId("onboarding-search-instead")).not.toBeVisible();

  // The manual form can be re-opened and the previously typed value is retained
  // in form state (we never cleared it, only hid the field).
  await page.getByTestId("onboarding-enter-manually").click();
  await expect(page.getByLabel("Church Name")).toHaveValue("Temporary Name");
});

test("Create Church clears active Church for onboarding and completed Church switching returns to My Work", async ({
  page,
}, testInfo) => {
  const clearOrgEndpoint = `${getConvexSiteUrl()}/api/auth/clear-org-for-onboarding`;
  const endpointProbe = await page.request.post(clearOrgEndpoint, { failOnStatusCode: false });
  test.skip(
    endpointProbe.status() === 404,
    "clear-org-for-onboarding is not deployed in this e2e backend environment.",
  );

  const email = `create-church-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const firstChurchName = `E2E Primary Church ${Date.now()}`;
  const secondChurchName = `E2E Second Church ${Date.now()}`;

  await signInWithOtp(page, email);
  await completeOnboarding(page, firstChurchName);

  await page.getByRole("button", { name: new RegExp(firstChurchName) }).click();
  await page.getByRole("menuitem", { name: "Create Church" }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(
    page.getByRole("complementary").getByText("Creating new Church...").nth(1),
  ).toBeVisible();

  await completeOnboarding(page, secondChurchName);
  await page.getByRole("button", { name: new RegExp(secondChurchName) }).click();
  await page.getByRole("menuitem", { name: new RegExp(firstChurchName) }).click();

  await expect(page).toHaveURL(/\/my-work$/);
  await expect(page.getByRole("button", { name: new RegExp(firstChurchName) })).toBeVisible();
});

test("switching to an incomplete Church routes back to onboarding", async ({ page }, testInfo) => {
  const email = `incomplete-switch-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const completedChurchName = `E2E Completed Church ${Date.now()}`;
  const incompleteChurchName = `E2E Incomplete Church ${Date.now()}`;

  await signInWithOtp(page, email);
  await completeOnboarding(page, completedChurchName);
  const completedChurchId = await getActiveOrganizationId(page);
  await createIncompleteChurch(page, incompleteChurchName);
  await setActiveOrganization(page, completedChurchId);
  await page.goto("/my-work");

  await page.getByRole("button", { name: new RegExp(completedChurchName) }).click();
  const incompleteChurchItem = page.getByRole("menuitem", {
    name: new RegExp(incompleteChurchName),
  });
  await expect(incompleteChurchItem).toBeVisible();
  await expect(incompleteChurchItem.getByText("Onboarding incomplete")).toBeVisible();
  await incompleteChurchItem.click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("button", { name: new RegExp(incompleteChurchName) })).toBeVisible();
});

test("Church owners do not see app-admin navigation", async ({ page }, testInfo) => {
  const email = `internal-nav-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Internal Nav Church ${Date.now()}`;

  await signInWithOtp(page, email);
  await completeOnboarding(page, churchName);

  const sidebar = page.locator('[data-sidebar="sidebar"]');
  await expect(sidebar.getByText("Dev", { exact: true })).not.toBeVisible();
  await expect(sidebar.getByText("Admin", { exact: true })).not.toBeVisible();

  await page.goto("/dev/session");
  await expect(page.getByRole("heading", { name: "Access Restricted" })).toBeVisible();
  await expect(page.getByText("App Administrator access required")).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Access Restricted" })).toBeVisible();
  await expect(page.getByText("App Administrator access required")).toBeVisible();
});

test("settings navigation exposes profile, Church, members, and invitation actions", async ({
  page,
}, testInfo) => {
  const email = `settings-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const inviteEmail = `settings-invite-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Settings Church ${Date.now()}`;
  const profileName = `Settings Member ${Date.now()}`;

  await signInWithOtp(page, email);
  await completeOnboarding(page, churchName);

  const sidebar = page.locator('[data-sidebar="sidebar"]');

  await expect(sidebar.getByText("Settings", { exact: true })).toBeVisible();
  await expect(sidebar.getByRole("link", { exact: true, name: "Profile" })).toBeVisible();
  await expect(sidebar.getByRole("link", { exact: true, name: "Church" })).toBeVisible();
  await expect(sidebar.getByRole("link", { exact: true, name: "Team" })).toBeVisible();

  await sidebar.getByRole("link", { exact: true, name: "Profile" }).click();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await expect(page.getByText("Manage your Church Task account details.")).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();
  await page.getByLabel("Name").fill(profileName);
  await page.getByRole("button", { name: "Update Profile" }).click();
  await expect(page.getByText("Profile updated.")).toBeVisible();

  await sidebar.getByRole("link", { exact: true, name: "Church" }).click();
  await expect(page).toHaveURL(/\/settings\/org$/);
  await expect(page.getByText("Church Profile", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Church Name")).toHaveValue(churchName);
  await page.getByLabel("Website").fill("https://settings.example.org");
  await page.getByRole("button", { name: "Update Church Profile" }).click();
  await expect(page.getByText("Church profile updated.")).toBeVisible();

  await sidebar.getByRole("link", { exact: true, name: "Team" }).click();
  await expect(page).toHaveURL(/\/settings\/team\/members$/);
  await expect(page.getByRole("tab", { name: /Members/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Invites/ })).toBeVisible();
  await expect(page.getByText("Church Members", { exact: true })).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();
  await expect(page.getByText("Teams", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: /Invites/ }).click();
  await expect(page).toHaveURL(/\/settings\/team\/invites$/);
  await expect(page.getByText("Church Invitations", { exact: true })).toBeVisible();
  await expect(page.getByText("No pending invitations.")).toBeVisible();

  await page.getByRole("button", { name: "Invite Member" }).click();
  await page
    .getByRole("textbox", {
      name: "Enter or paste one or more email addresses, separated by spaces or commas",
    })
    .fill(inviteEmail);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Invite Member" })).not.toBeVisible();
});

test("settings pending invitations list renders seeded pending invitations", async ({
  page,
}, testInfo) => {
  const email = `settings-pending-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const inviteEmail = `settings-pending-invite-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Pending Invite Church ${Date.now()}`;

  await signInWithOtp(page, email);
  await completeOnboarding(page, churchName);
  await page.goto("/settings/team/invites");
  await expect(page.getByText("No pending invitations.")).toBeVisible();

  await createTestInvitation(page, { email: inviteEmail, role: "member" });
  await page.reload();

  await expect(page.getByText(inviteEmail)).toBeVisible();
  await expect(page.getByText("member", { exact: true })).toBeVisible();
});

test("Google Places lookup autofills editable Church profile fields", async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.VITE_GOOGLE_PLACES_API_KEY,
    "VITE_GOOGLE_PLACES_API_KEY is not configured; skipping real Google Places lookup.",
  );

  const email = `places-${Date.now()}-${testInfo.workerIndex}@example.com`;

  await signInWithOtp(page, email);
  await page.getByLabel("Find Your Church").fill("Times Square Church New York");

  const firstResult = await page.waitForFunction(() => {
    const input = document.querySelector<HTMLInputElement>("input[list]");
    const listId = input?.getAttribute("list");
    if (!listId) return null;

    return document.querySelector<HTMLOptionElement>(`#${listId} option`)?.value ?? null;
  });
  const selectedPlace = await firstResult.jsonValue();
  if (!selectedPlace) throw new Error("Google Places result did not expose a value.");

  // Selecting a church reveals the Church profile fields and autofills them.
  await expect(page.getByLabel("Church Name")).not.toBeVisible();
  await page.getByLabel("Find Your Church").fill(selectedPlace);

  await expect(page.getByLabel("Church Name")).toBeVisible();
  await expect(page.getByLabel("Church Name")).not.toHaveValue("");
  // The time zone is derived from the selected church's coordinates.
  await expect(page.getByLabel("Church Time Zone")).not.toHaveValue("");
  await page.getByLabel("Church Name").fill("Editable Church Name Override");
  await expect(page.getByLabel("Church Name")).toHaveValue("Editable Church Name Override");
});
