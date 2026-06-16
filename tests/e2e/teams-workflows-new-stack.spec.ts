import { expect, type Page, test } from "@playwright/test";

import { signInAndCompleteOnboarding } from "./helpers";

test.skip(
  process.env.CHURCH_TASK_E2E_ONBOARDING_STACK !== "1",
  "Run with bun run test:e2e:teams-workflows to boot the local Postgres/Zero onboarding stack.",
);

test.setTimeout(120_000);

function collectBrowserErrors(page: Page) {
  const browserErrors: Array<string> = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  return browserErrors;
}

async function runWithBrowserErrors<T>(
  operation: () => Promise<T>,
  browserErrors: readonly string[],
) {
  try {
    return await operation();
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nBrowser errors:\n${browserErrors.join("\n")}`,
    );
  }
}

test("manages Teams and their owned Workflows on the local Postgres and Zero stack", async ({
  page,
}, testInfo) => {
  const browserErrors = collectBrowserErrors(page);
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const email = `teams-workflows-${suffix}@example.com`;
  const churchName = `E2E Teams Workflows Church ${suffix}`;
  const teamName = `Care Followup ${suffix}`;
  const renamedTeamName = `Care Coordination ${suffix}`;
  const teamIdentifier = `CW${testInfo.workerIndex}`;

  await runWithBrowserErrors(
    () => signInAndCompleteOnboarding(page, { churchName, email, userName: "E2E Owner" }),
    browserErrors,
  );

  await runWithBrowserErrors(async () => {
    await page.getByRole("button", { name: "Open quick actions" }).click();
    await page.getByRole("option", { name: "Create Team" }).click();
    const createTeamDialog = page.getByRole("dialog", { name: "Create Team" });
    await expect(createTeamDialog).toBeVisible();
    await createTeamDialog.getByLabel("Team Name").fill(teamName);
    await createTeamDialog.getByRole("button", { name: "Create Team" }).click();
    await expect(page.getByText("Team created.")).toBeVisible({ timeout: 20_000 });

    await page.goto("/settings/account/profile");
    await page.getByRole("link", { name: teamName }).click();
    await page.getByRole("link", { name: "General" }).click();

    await page.getByLabel("Name").fill(renamedTeamName);
    await page.getByRole("button", { name: "Save" }).first().click();
    await expect(page.getByText("Team renamed.")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("textbox", { name: "Identifier" }).fill(teamIdentifier);
    await page.getByRole("button", { name: "Save" }).nth(1).click();
    await expect(page.getByText("Team identifier updated.")).toBeVisible({ timeout: 20_000 });

    await page.goto(`/team/${teamIdentifier}`);
    await expect(page).toHaveURL(new RegExp(`/team/${teamIdentifier}$`), { timeout: 20_000 });
    await expect(page.getByLabel("Workflow Status To Do")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel("Workflow Status In Progress")).toBeVisible();
    await expect(page.getByLabel("Workflow Status Done")).toBeVisible();

    await page.goto("/settings/account/profile");
    await page.getByRole("link", { name: renamedTeamName }).click();
    await page.getByRole("link", { name: "General" }).click();
    await page.getByRole("button", { name: `Archive ${renamedTeamName}` }).click();
    await expect(page.getByText(`Archived Team ${renamedTeamName}.`)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("link", { name: renamedTeamName })).not.toBeVisible();

    await page.goto(`/team/${teamIdentifier}`);
    await expect(page.getByText("Team board is unavailable.")).toBeVisible({ timeout: 20_000 });
  }, browserErrors);
});
