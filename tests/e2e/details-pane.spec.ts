import { expect, type Page, test } from "@playwright/test";

test.skip(
  process.env.CHURCH_TASK_E2E_READY !== "1",
  process.env.CHURCH_TASK_E2E_SKIP_REASON ?? "E2E environment is not configured.",
);

const getConvexSiteUrl = () => {
  const siteUrl = process.env.VITE_CONVEX_SITE_URL ?? process.env.CONVEX_SITE_URL;
  if (!siteUrl) {
    throw new Error("VITE_CONVEX_SITE_URL or CONVEX_SITE_URL must be set for details pane e2e.");
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
  await page.getByRole("button", { name: "Enter Church Task" }).click();
  await expect(page).toHaveURL(/\/my-work$/, { timeout: 20_000 });
}

function getDetailsPaneSearchValue(page: Page) {
  return new URL(page.url()).searchParams.get("details-pane");
}

test("opens a Task details pane from URL state and supports reload/deep-link", async ({
  page,
  context,
}, testInfo) => {
  const email = `details-pane-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Details Pane Church ${Date.now()}`;
  const taskTitle = `Details Pane Task ${Date.now()}`;

  await signInWithOtp(page, email);
  await completeOnboarding(page, churchName);

  await page.getByRole("main").getByRole("button", { name: "Create Task" }).click();
  const createTaskDialog = page.getByRole("dialog", { name: "Create Task" });
  await createTaskDialog.getByPlaceholder("Add a Task").fill(taskTitle);
  await createTaskDialog.getByRole("button", { name: "Create Task" }).click();
  const taskCard = page.getByLabel(`Task card ${taskTitle}`);
  await expect(taskCard).toBeVisible();

  await taskCard.click();

  const detailsPane = page.getByRole("dialog", { name: "Details Pane" });
  await expect(detailsPane).toBeVisible();
  await expect(detailsPane.getByText("Task details", { exact: true })).toBeVisible();
  await expect(detailsPane.getByRole("heading", { name: taskTitle })).toBeVisible();

  const detailsPaneSearchValue = getDetailsPaneSearchValue(page);
  expect(detailsPaneSearchValue).toContain('"_tag":"task"');
  expect(detailsPaneSearchValue).toContain('"tab":"details"');

  const deepLinkUrl = page.url();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Details Pane" })).toBeVisible();
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();

  const deepLinkPage = await context.newPage();
  await deepLinkPage.goto(deepLinkUrl);
  await expect(deepLinkPage.getByRole("dialog", { name: "Details Pane" })).toBeVisible();
  await expect(deepLinkPage.getByRole("heading", { name: taskTitle })).toBeVisible();
});
