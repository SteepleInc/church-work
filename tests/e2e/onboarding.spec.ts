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

test("creates a Church profile and reviews initial Teams", async ({ page }, testInfo) => {
  const email = `onboarding-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Onboarding Church ${Date.now()}`;

  await signInWithOtp(page, email);

  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Church Name").fill(churchName);
  await page.getByLabel("Street").fill("123 Main Street");
  await page.getByLabel("City").fill("Nashville");
  await page.getByLabel("State / Region").fill("TN");
  await page.getByLabel("Postal Code").fill("37203");
  await page.getByLabel("Country Code").fill("US");
  await page.getByLabel("Church Time Zone").fill("America/Chicago");
  await page.getByLabel("Website").fill("https://example.org");
  await page.getByRole("button", { name: "Continue to Teams" }).click();

  await expect(page.getByText("Step 2 of 2")).toBeVisible();
  await expect(page.getByText("Review your initial Teams", { exact: true })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "My Work", level: 1 })).toBeVisible();
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
  await expect(page.getByText("Creating new Church...")).toBeVisible();

  await completeOnboarding(page, secondChurchName);
  await page.getByRole("button", { name: new RegExp(secondChurchName) }).click();
  await page.getByRole("menuitem", { name: new RegExp(firstChurchName) }).click();

  await expect(page).toHaveURL(/\/my-work$/);
  await expect(page.getByRole("button", { name: new RegExp(firstChurchName) })).toBeVisible();
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
  await page.getByLabel("Find Your Church").fill(selectedPlace);

  await expect(page.getByLabel("Church Name")).not.toHaveValue("");
  await page.getByLabel("Church Name").fill("Editable Church Name Override");
  await expect(page.getByLabel("Church Name")).toHaveValue("Editable Church Name Override");
});
