import { expect, type Page, test } from "@playwright/test";

test.skip(
  process.env.CHURCH_TASK_E2E_READY !== "1",
  process.env.CHURCH_TASK_E2E_SKIP_REASON ?? "E2E environment is not configured.",
);

const getConvexSiteUrl = () => {
  const siteUrl = process.env.VITE_CONVEX_SITE_URL ?? process.env.CONVEX_SITE_URL;
  if (!siteUrl) {
    throw new Error("VITE_CONVEX_SITE_URL or CONVEX_SITE_URL must be set for OTP e2e tests.");
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
        if (!response.ok()) {
          return null;
        }

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

test("signs in with email OTP using the test capture channel", async ({ page }) => {
  const email = `otp-${Date.now()}@example.com`;

  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.locator('button[data-loading="false"]', { hasText: "Continue" }).click();

  await expect(page.getByText("Use the verification code sent to your email")).toBeVisible();

  const otp = await waitForOtp(page, email);
  await page.getByLabel("Verification Code").fill(otp);

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("Tell us about your Church")).toBeVisible();
});

test("auto-submits sign-in when a passed email is present", async ({ page }) => {
  const email = `passed-email-${Date.now()}@example.com`;

  await page.goto(`/sign-in?email=${encodeURIComponent(email)}`);

  await expect(page.getByText("Use the verification code sent to your email")).toBeVisible();

  const otp = await waitForOtp(page, email);
  await page.getByLabel("Verification Code").fill(otp);

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("Tell us about your Church")).toBeVisible();
});
