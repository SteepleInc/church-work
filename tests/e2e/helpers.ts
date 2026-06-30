import { expect, type Page, test } from "@playwright/test";
import { STARTER_KEY_DATES, STARTER_TEAM_NAMES } from "@church-work/domain";

export const getE2eApiUrl = () => {
  if (process.env.DATABASE_URL) {
    return (
      process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_WEB_PORT ?? 32101}`
    );
  }

  throw new Error("DATABASE_URL must be set for e2e API tests.");
};

async function postTestHelperWithRetry(
  page: Page,
  path: string,
  options: Parameters<Page["request"]["post"]>[1] = {},
) {
  const url = `${getE2eApiUrl()}${path}`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await page.request.post(url, options);
    } catch (error) {
      lastError = error;
      if (attempt === 3 || !String(error).match(/ECONNRESET|EPIPE|socket hang up/i)) {
        throw error;
      }
      await page.waitForTimeout(attempt * 500);
    }
  }

  throw lastError;
}

async function getLatestOtp(page: Page, email: string) {
  const encodedEmail = encodeURIComponent(email);

  const response = await page.request.get(`${getE2eApiUrl()}/api/test/otp?email=${encodedEmail}`);
  if (!response.ok()) return null;

  const body = (await response.json()) as { otp?: string | null };
  return body.otp ?? null;
}

export async function waitForOtp(page: Page, email: string, previousOtp?: string | null) {
  const encodedEmail = encodeURIComponent(email);

  await expect
    .poll(
      async () => {
        const response = await page.request.get(
          `${getE2eApiUrl()}/api/test/otp?email=${encodedEmail}`,
        );
        if (!response.ok()) return null;

        const body = (await response.json()) as { otp?: string | null };
        const otp = body.otp ?? null;
        return otp && otp !== previousOtp ? otp : null;
      },
      { timeout: 10_000 },
    )
    .toMatch(/^\d{6}$/);

  const otp = await getLatestOtp(page, email);
  if (!otp || otp === previousOtp) {
    throw new Error(`Could not read fresh OTP for ${email}.`);
  }

  return otp;
}

export async function signInWithOtp(page: Page, email: string) {
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/sign-in$/, { timeout: 20_000 });
  const emailField = page.getByLabel("Email address");
  if (
    !(await expect(emailField)
      .toBeVisible({ timeout: 20_000 })
      .then(
        () => true,
        () => false,
      ))
  ) {
    throw new Error(
      `Sign-in email field did not render at ${page.url()}. Body: ${await page.locator("body").innerText()}`,
    );
  }
  await emailField.fill(email);
  const previousOtp = await getLatestOtp(page, email);
  await page.locator('button[data-loading="false"]', { hasText: "Continue" }).click();
  await page.getByLabel("Verification Code").fill(await waitForOtp(page, email, previousOtp));
  await expect(page).toHaveURL(/\/(my-work|onboarding)$/, { timeout: 20_000 });
}

export async function signOut(page: Page) {
  await page.evaluate(async () => {
    const { authClient } = await import("/src/lib/auth-client.ts");
    await authClient.signOut();
  });
}

export async function startAuthenticatedSession(
  page: Page,
  args: {
    readonly churchName: string;
    readonly email: string;
    readonly role?: "admin";
    readonly userName?: string;
  },
) {
  const response = await postTestHelperWithRetry(page, "/api/test/session", { data: args });

  test.skip(response.status() === 404, "Test session helper is not deployed.");
  if (!response.ok()) {
    throw new Error(`Could not create test session: ${response.status()} ${await response.text()}`);
  }

  await page.goto("/my-work");
  await expect(page).toHaveURL(/\/my-work$/, { timeout: 20_000 });
}

export async function promoteCurrentUserToAppAdmin(page: Page) {
  const response = await postTestHelperWithRetry(page, "/api/test/app-admin");

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
  await expect(page.getByLabel("Initial Teams").getByRole("button", { name: /^Edit / }))
    .toHaveCount(STARTER_TEAM_NAMES.length)
    .catch(async (error: unknown) => {
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
        `${error instanceof Error ? error.message : String(error)}\nActive org state: ${JSON.stringify(activeOrgState)}\nBody: ${await page.locator("body").innerText()}`,
      );
    });
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Your Key Dates")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Starter Key Dates").getByRole("listitem")).toHaveCount(
    STARTER_KEY_DATES.length,
    { timeout: 20_000 },
  );
  await expect(
    page.getByLabel("Starter Key Dates").getByText("Easter", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Starter Key Dates").getByText("Christmas", { exact: true }),
  ).toBeVisible();

  await expect(page.getByRole("button", { name: "Enter Church Work" })).toBeEnabled();
  await page.getByRole("button", { name: "Enter Church Work" }).click();
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

/**
 * Opens the create-Template stepper big action from the /templates Collection.
 * Works from both the empty state ("Create a Template") and the populated
 * toolbar ("New Template"). The flow opens on step 0, the combined Setup step
 * (name, description, shape picker, and schedule).
 */
export async function openTemplateCreate(page: Page) {
  await expect(page).toHaveURL(/\/templates$/);
  const createButton = page
    .getByRole("button", { name: "Create a Template" })
    .or(page.getByRole("button", { name: "New Template" }))
    .first();
  await expect(createButton).toBeVisible({ timeout: 20_000 });
  await createButton.click();
  // Step 0: Setup. The shape picker lives inside it.
  await expect(page.getByRole("heading", { name: "Template shape" })).toBeVisible({
    timeout: 20_000,
  });
}

/**
 * Selects a Template shape inside the combined Setup step (step 0). The shape
 * picker, name, description, and schedule all live on the same screen, so this
 * only toggles the shape and does not advance the stepper. `shapeLabel` matches
 * the visible shape label (e.g. "Weekly service", "Key Date", "Monthly").
 */
export async function selectTemplateShape(page: Page, shapeLabel: string) {
  await page.getByRole("button", { name: `${shapeLabel} Template shape` }).click();
}

/** Advances to the next stepper screen in the create-Template flow. */
export async function stepperNext(page: Page) {
  await page.getByRole("button", { exact: true, name: "Next" }).click();
}

/**
 * Adds a Template Task on the Tasks step of the create-Template flow. A Template
 * Task only counts as "placed" once it carries both a title and a Team (the
 * first Task no longer auto-selects a Team), so this fills the title and picks
 * the seeded Team before closing the inline editor.
 */
export async function addTemplateTask(page: Page, title: string, team = "Worship") {
  await page.getByRole("button", { name: "Add Template Task" }).first().click();
  await page.getByPlaceholder("Add task title").fill(title);
  await page.getByRole("combobox", { name: "Change team" }).click();
  await page.getByRole("option", { name: team }).click();
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
