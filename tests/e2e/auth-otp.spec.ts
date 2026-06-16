import { expect, test } from "@playwright/test";

import { waitForOtp } from "./helpers";

test.skip(
  process.env.CHURCH_TASK_E2E_READY !== "1",
  process.env.CHURCH_TASK_E2E_SKIP_REASON ?? "E2E environment is not configured.",
);

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
