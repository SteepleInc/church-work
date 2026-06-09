import { expect, type Page, test } from "@playwright/test";

test.skip(
  process.env.CHURCH_TASK_E2E_READY !== "1",
  process.env.CHURCH_TASK_E2E_SKIP_REASON ?? "E2E environment is not configured.",
);

const getConvexSiteUrl = () => {
  const siteUrl = process.env.VITE_CONVEX_SITE_URL ?? process.env.CONVEX_SITE_URL;
  if (!siteUrl) {
    throw new Error("VITE_CONVEX_SITE_URL or CONVEX_SITE_URL must be set for invitation e2e.");
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

async function completeOnboarding(page: Page, churchName: string) {
  await page.getByLabel("Church Name").fill(churchName);
  await page.getByRole("button", { name: "Edit Details" }).click();
  await page.getByLabel("Street").fill("123 Main Street");
  await page.getByLabel("City").fill("Nashville");
  await page.getByLabel("State / Region").fill("TN");
  await page.getByLabel("Postal Code").fill("37203");
  await page.getByLabel("Country Code").fill("US");
  await page.getByLabel("Church Time Zone").fill("America/Chicago");
  await page.getByLabel("Website").fill("https://example.org");
  await page.getByRole("button", { name: "Continue to Teams" }).click();
  await expect(page.getByText("Review your initial Teams", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Enter Church Task" }).click();
  await expect(page).toHaveURL(/\/my-work$/, { timeout: 20_000 });
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

  const body = (await response.json()) as { invitation: { _id: string } };
  return body.invitation._id;
}

async function signOut(page: Page) {
  await page.evaluate(async () => {
    const { authClient } = await import("/src/lib/auth-client.ts");
    await authClient.signOut();
  });
}

test("accepts an invitation through OTP sign-in and lands in the invited Church", async ({
  page,
}, testInfo) => {
  const ownerEmail = `invite-owner-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const inviteeEmail = `invitee-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Invited Church ${Date.now()}`;

  await signInWithOtp(page, ownerEmail);
  await completeOnboarding(page, churchName);
  const invitationId = await createTestInvitation(page, { email: inviteeEmail, role: "member" });
  await signOut(page);

  await page.goto(`/accept-invitation/${invitationId}`);
  await expect(page).toHaveURL(new RegExp(`/sign-in\\?invitation-id=${invitationId}$`));
  await page.getByLabel("Email address").fill(inviteeEmail);
  await page.locator('button[data-loading="false"]', { hasText: "Continue" }).click();
  await page.getByLabel("Verification Code").fill(await waitForOtp(page, inviteeEmail));

  await expect(page).toHaveURL(new RegExp(`/accept-invitation/${invitationId}$`));
  await expect(page.getByText("Church Invitation", { exact: true })).toBeVisible();
  await expect(page.getByText(churchName)).toBeVisible();
  await page.getByRole("button", { name: /Accept Invitation/ }).click();

  await expect(page).toHaveURL(/\/my-work$/, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: new RegExp(churchName) })).toBeVisible();
});
