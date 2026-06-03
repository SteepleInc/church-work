import { expect, test } from "@playwright/test";

import { signInAndCompleteOnboarding } from "./helpers";

test.skip(
  process.env.CHURCH_TASK_E2E_READY !== "1",
  process.env.CHURCH_TASK_E2E_SKIP_REASON ?? "E2E environment is not configured.",
);

test("unauthenticated app routes render the OTP sign-in entry", async ({ page }) => {
  await page.goto("/my-work");

  await expect(page).toHaveURL(/\/my-work$/);
  await expect(page.getByText("Sign in to Church Task", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
});

test("completed users land in the PreachX-style app shell", async ({ page }, testInfo) => {
  const email = `app-shell-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E App Shell Church ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { email, churchName });

  await expect(page.getByText(churchName).first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Church Task");
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("My Work");
  await expect(page.getByRole("button", { name: "Open quick actions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open global search" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Toggle theme" })).toBeVisible();
  await expect(
    page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "My Work" }),
  ).toBeVisible();
  await expect(
    page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Our Work" }),
  ).toBeVisible();
  await expect(
    page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Settings" }),
  ).toBeVisible();
});

test("shell navigation keeps work and settings routes inside the sidebar layout", async ({
  page,
}, testInfo) => {
  const email = `app-shell-nav-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E App Shell Nav Church ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { email, churchName });

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Our Work" }).click();
  await expect(page).toHaveURL(/\/our-work$/);
  await expect(page.getByRole("heading", { name: "Our Work", level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Our Work");

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /Members/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Invitations/ })).toBeVisible();

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "My Work" }).click();
  await expect(page).toHaveURL(/\/my-work$/);
  await expect(page.getByRole("heading", { name: "My Work", level: 1 })).toBeVisible();
});
