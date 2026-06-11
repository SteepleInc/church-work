import { expect, type Page } from "@playwright/test";

export const getConvexSiteUrl = () => {
  const siteUrl = process.env.VITE_CONVEX_SITE_URL ?? process.env.CONVEX_SITE_URL;
  if (!siteUrl) {
    throw new Error("VITE_CONVEX_SITE_URL or CONVEX_SITE_URL must be set for e2e tests.");
  }
  return siteUrl;
};

export async function waitForOtp(page: Page, email: string) {
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

export async function signInWithOtp(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.locator('button[data-loading="false"]', { hasText: "Continue" }).click();
  await page.getByLabel("Verification Code").fill(await waitForOtp(page, email));
  await expect(page).toHaveURL(/\/(my-work|onboarding)$/, { timeout: 20_000 });
}

export async function completeOnboarding(page: Page, churchName: string) {
  await expect(page.getByText("Next up")).not.toBeVisible();
  await expect(page.getByLabel("Find Your Church")).toBeVisible();
  await page.getByTestId("onboarding-enter-manually").click();
  await page.getByLabel("Church Name").fill(churchName);
  await page.getByLabel("Church Time Zone").fill("America/Chicago");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Review the starting Teams", { exact: false })).toBeVisible({
    timeout: 20_000,
  });
  // Wait for the seeded Starter Teams to finish streaming in so the layout
  // is stable before clicking Next.
  await expect(page.getByText("Initial Church Task Team")).toHaveCount(6, {
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("button", { name: "Enter Church Task" })).toBeEnabled();
  await page.getByRole("button", { name: "Enter Church Task" }).click();
  await expect(page).toHaveURL(/\/my-work$/, { timeout: 20_000 });
}

export async function signInAndCompleteOnboarding(
  page: Page,
  args: { readonly email: string; readonly churchName: string; readonly userName?: string },
) {
  await signInWithOtp(page, args.email);

  if (args.userName) {
    await page.evaluate(async ({ userName }) => {
      const { authClient } = await import("/src/lib/auth-client.ts");
      const result = await authClient.updateUser({ name: userName });

      if (result.error) {
        throw new Error(result.error.message ?? "Could not update e2e user name.");
      }
    }, args);
  }

  await completeOnboarding(page, args.churchName);
}

export async function dragTaskCardToStatus(page: Page, taskTitle: string, statusName: string) {
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

  if (
    await destination
      .getByText(taskTitle)
      .isVisible()
      .catch(() => false)
  ) {
    return;
  }

  await taskCard.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
}
