import { expect, test } from "@playwright/test";

import { completeOnboarding, signInWithOtp } from "./helpers";

test.skip(
  process.env.CHURCH_TASK_E2E_ONBOARDING_STACK !== "1",
  "Run with bun run test:e2e:onboarding to boot the local Postgres/Zero onboarding stack.",
);

test.setTimeout(90_000);

test("completes OTP sign-in through onboarding on the local Postgres and Zero stack", async ({
  page,
}, testInfo) => {
  const browserErrors: Array<string> = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const email = `onboarding-new-stack-${suffix}@example.com`;
  const churchName = `E2E New Stack Church ${suffix}`;

  await signInWithOtp(page, email).catch((error: unknown) => {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nBrowser errors:\n${browserErrors.join("\n")}`,
    );
  });
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 20_000 });

  await completeOnboarding(page, churchName).catch((error: unknown) => {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nBrowser errors:\n${browserErrors.join("\n")}`,
    );
  });

  const keyDateName = `Anniversary ${suffix}`;
  const renamedKeyDateName = `Church Anniversary ${suffix}`;
  await page.goto("/settings/workspace/key-dates");
  await expect(page.getByRole("heading", { name: "Key Dates" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("row", { name: /Easter/ })).toBeVisible({ timeout: 20_000 });

  // Creating a Key Date is a quick action: "New Key Date" opens the Create Key
  // Date dialog rather than an inline table row.
  await page.getByRole("button", { name: "New Key Date" }).click();
  const createKeyDateDialog = page.getByRole("dialog", { name: "Create Key Date" });
  await expect(createKeyDateDialog).toBeVisible({ timeout: 20_000 });
  await createKeyDateDialog.getByLabel("Key Date Name").fill(keyDateName);
  await createKeyDateDialog.getByRole("button", { name: "Create Key Date" }).click();
  await expect(page.getByRole("row", { name: new RegExp(keyDateName) })).toBeVisible({
    timeout: 20_000,
  });

  // Inline rename still lives on the Key Dates table row.
  await page
    .getByRole("row", { name: new RegExp(keyDateName) })
    .getByRole("button", { name: keyDateName })
    .click();
  await page.getByPlaceholder("Key Date name").fill(renamedKeyDateName);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("row", { name: new RegExp(renamedKeyDateName) })).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole("row", { name: new RegExp(renamedKeyDateName) }).hover();
  await page
    .getByRole("row", { name: new RegExp(renamedKeyDateName) })
    .getByRole("button", { name: "Open Key Date actions" })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("row", { name: new RegExp(renamedKeyDateName) })).not.toBeVisible({
    timeout: 20_000,
  });
});
