import { expect, type Page, test } from "@playwright/test";

export const getConvexSiteUrl = () => {
  const siteUrl = process.env.VITE_CONVEX_SITE_URL ?? process.env.CONVEX_SITE_URL;
  if (!siteUrl) {
    throw new Error("VITE_CONVEX_SITE_URL or CONVEX_SITE_URL must be set for e2e tests.");
  }
  return siteUrl;
};

export const getE2eApiUrl = () => {
  const explicitApiUrl = process.env.CHURCH_TASK_E2E_API_URL;
  if (explicitApiUrl) return explicitApiUrl;

  const siteUrl = process.env.VITE_CONVEX_SITE_URL ?? process.env.CONVEX_SITE_URL;
  if (siteUrl) return siteUrl;

  if (process.env.DATABASE_URL) {
    return (
      process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_WEB_PORT ?? 2101}`
    );
  }

  throw new Error(
    "CHURCH_TASK_E2E_API_URL, VITE_CONVEX_SITE_URL, CONVEX_SITE_URL, or DATABASE_URL must be set for e2e OTP tests.",
  );
};

export async function waitForOtp(page: Page, email: string) {
  const encodedEmail = encodeURIComponent(email);

  await expect
    .poll(
      async () => {
        const response = await page.request.get(
          `${getE2eApiUrl()}/api/test/otp?email=${encodedEmail}`,
        );
        if (!response.ok()) return null;

        const body = (await response.json()) as { otp?: string | null };
        return body.otp ?? null;
      },
      { timeout: 10_000 },
    )
    .toMatch(/^\d{6}$/);

  const response = await page.request.get(`${getE2eApiUrl()}/api/test/otp?email=${encodedEmail}`);
  const body = (await response.json()) as { otp: string };
  return body.otp;
}

export async function signInWithOtp(page: Page, email: string) {
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/sign-in$/, { timeout: 20_000 });
  const emailField = page.getByLabel("Email address");
  if (!(await emailField.isVisible({ timeout: 20_000 }).catch(() => false))) {
    throw new Error(
      `Sign-in email field did not render at ${page.url()}. Body: ${await page.locator("body").innerText()}`,
    );
  }
  await emailField.fill(email);
  await page.locator('button[data-loading="false"]', { hasText: "Continue" }).click();
  await page.getByLabel("Verification Code").fill(await waitForOtp(page, email));
  await expect(page).toHaveURL(/\/(my-work|onboarding)$/, { timeout: 20_000 });
}

export async function signOut(page: Page) {
  await page.evaluate(async () => {
    const { authClient } = await import("/src/lib/auth-client.ts");
    await authClient.signOut();
  });
}

export async function promoteCurrentUserToAppAdmin(page: Page) {
  const response = await page.request.post(`${getE2eApiUrl()}/api/test/app-admin`);

  test.skip(response.status() === 404, "App Admin promotion helper is not deployed.");
  expect(response.ok()).toBe(true);
}

export async function completeOnboarding(page: Page, churchName: string) {
  await expect(page.getByText("Next up")).not.toBeVisible();
  await expect(page.getByLabel("Find Your Church")).toBeVisible();
  await page.getByTestId("onboarding-enter-manually").click();
  await page.getByLabel("Church Name").fill(churchName);
  await page.getByLabel("Church Time Zone").fill("America/Chicago");
  await page.locator("form").getByRole("button", { name: "Next" }).click();

  const teamsStepHeading = page.getByText("Review the starting Teams", { exact: false });
  if (
    !(await expect(teamsStepHeading)
      .toBeVisible({ timeout: 20_000 })
      .then(
        () => true,
        () => false,
      ))
  ) {
    const activeOrgState = await page.evaluate(async () => {
      const { authClient } = await import("/src/lib/auth-client.ts");
      const session = await authClient.getSession();
      const activeOrganization = await authClient.organization.getFullOrganization();

      return {
        activeOrganization: activeOrganization.data,
        activeOrganizationError: activeOrganization.error?.message,
        session: session.data?.session,
        sessionError: session.error?.message,
      };
    });
    throw new Error(
      `Onboarding did not advance to Initial Teams at ${page.url()}. Active org state: ${JSON.stringify(activeOrgState)}. Body: ${await page.locator("body").innerText()}`,
    );
  }
  // Wait for the seeded Starter Teams to finish streaming in so the layout
  // is stable before clicking Next.
  await expect(
    page.getByLabel("Initial Teams").getByRole("button", { name: /^Edit / }),
  ).toHaveCount(3, {
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
