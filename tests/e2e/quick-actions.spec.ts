import { expect, type Page, test } from "@playwright/test";

test.skip(
  process.env.CHURCH_TASK_E2E_READY !== "1",
  process.env.CHURCH_TASK_E2E_SKIP_REASON ?? "E2E environment is not configured.",
);

const getConvexSiteUrl = () => {
  const siteUrl = process.env.VITE_CONVEX_SITE_URL ?? process.env.CONVEX_SITE_URL;
  if (!siteUrl) {
    throw new Error("VITE_CONVEX_SITE_URL or CONVEX_SITE_URL must be set for quick action e2e.");
  }
  return siteUrl;
};

async function waitForOtp(page: Page, email: string) {
  const encodedEmail = encodeURIComponent(email);

  await expect
    .poll(
      async () => {
        const response = await page.request.get(
          `${getConvexSiteUrl()}/api/test/otp?email=${encodedEmail}`,
        );
        if (!response.ok()) return null;

        const body = (await response.json()) as { otp?: string | null };
        return body.otp ?? null;
      },
      { timeout: 10_000 },
    )
    .toMatch(/^\d{6}$/);

  const response = await page.request.get(
    `${getConvexSiteUrl()}/api/test/otp?email=${encodedEmail}`,
  );
  const body = (await response.json()) as { otp: string };
  return body.otp;
}

async function signInWithOtp(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Verification Code").fill(await waitForOtp(page, email));
}

async function completeOnboarding(page: Page, churchName: string) {
  await page.getByLabel("Church Name").fill(churchName);
  await page.getByLabel("Street").fill("123 Main Street");
  await page.getByLabel("City").fill("Nashville");
  await page.getByLabel("State / Region").fill("TN");
  await page.getByLabel("Postal Code").fill("37203");
  await page.getByLabel("Country Code").fill("US");
  await page.getByLabel("Church Time Zone").fill("America/Chicago");
  await page.getByLabel("Website").fill("https://example.org");
  await page.getByRole("button", { name: "Continue to Teams" }).click();
  await page.getByRole("button", { name: "Enter Church Task" }).click();
  await expect(page).toHaveURL(/\/my-work$/, { timeout: 20_000 });
}

test("opens Quick Actions and completes a copied create-task action", async ({
  page,
}, testInfo) => {
  const email = `quick-actions-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Quick Actions Church ${Date.now()}`;
  const taskTitle = `Quick Action Task ${Date.now()}`;

  await signInWithOtp(page, email);
  await completeOnboarding(page, churchName);

  await page.getByRole("button", { name: "Open quick actions" }).click();
  await expect(page.getByRole("dialog", { name: "Quick Actions Menu" })).toBeVisible();
  await expect(page.getByText("Big Actions", { exact: true })).toBeVisible();
  await page.getByText("Create Church Task", { exact: true }).click();

  await expect(page).toHaveURL(/\/our-work$/);
  await page.getByPlaceholder("Add Church-wide Task").fill(taskTitle);
  await page.getByRole("button", { name: "Create Task" }).click();
  await expect(page.getByText(taskTitle).first()).toBeVisible();

  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  await expect(page.getByRole("dialog", { name: "Quick Actions Menu" })).toBeVisible();
  await expect(page.getByText("Invite Member", { exact: true })).toBeVisible();
});
