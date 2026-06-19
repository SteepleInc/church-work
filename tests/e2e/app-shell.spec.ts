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
    page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Templates" }),
  ).toBeVisible();
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  await expect(sidebar.getByText("Settings", { exact: true })).toBeVisible();
  await expect(sidebar.getByRole("link", { exact: true, name: "Profile" })).toBeVisible();
  await expect(sidebar.getByRole("link", { exact: true, name: "Church" })).toBeVisible();
  await expect(sidebar.getByRole("link", { exact: true, name: "Team" })).toBeVisible();
});

test("shell navigation keeps work and settings routes inside the sidebar layout", async ({
  page,
}, testInfo) => {
  const email = `app-shell-nav-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E App Shell Nav Church ${Date.now()}`;

  await signInAndCompleteOnboarding(page, { email, churchName });

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Our Work" }).click();
  await expect(page).toHaveURL(/\/our-work$/);
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Our Work");
  await expect(page.getByText("To Do").first()).toBeVisible();

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Templates" }).click();
  await expect(page).toHaveURL(/\/templates$/);
  await expect(page.getByRole("heading", { name: "Templates" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Schedules" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Library" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Key Dates" })).toBeVisible();
  await expect(page.getByText("No Template Schedules yet")).toBeVisible();

  await page.getByRole("tab", { name: "Library" }).click();
  await expect(page).toHaveURL(/\/templates\/library$/);
  await expect(page.getByText("No Templates yet")).toBeVisible();

  await page.getByRole("tab", { name: "Key Dates" }).click();
  await expect(page).toHaveURL(/\/templates\/key-dates$/);
  await expect(page.getByRole("heading", { name: "Key Dates" })).toBeVisible();

  await page
    .locator('[data-sidebar="sidebar"]')
    .getByRole("link", { exact: true, name: "Profile" })
    .click();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await expect(page.getByText("Profile Settings", { exact: true })).toBeVisible();

  await page
    .locator('[data-sidebar="sidebar"]')
    .getByRole("link", { exact: true, name: "Team" })
    .click();
  await expect(page).toHaveURL(/\/settings\/team\/members$/);
  await expect(page.getByRole("tab", { name: /Members/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Invites/ })).toBeVisible();

  await page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "My Work" }).click();
  await expect(page).toHaveURL(/\/my-work$/);
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("My Work");
});

test("mobile sidebar drawer exposes the shared PreachX header controls", async ({
  page,
}, testInfo) => {
  const email = `app-shell-mobile-${Date.now()}-${testInfo.workerIndex}@example.com`;
  const churchName = `E2E Mobile Shell Church ${Date.now()}`;

  await page.setViewportSize({ height: 844, width: 390 });
  await signInAndCompleteOnboarding(page, { email, churchName });

  await page.getByRole("button", { name: "Toggle Sidebar" }).click();

  const sidebar = page.locator('[data-sidebar="sidebar"]');
  await expect(sidebar.getByText(churchName).first()).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Open quick actions" })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Open global search" })).toBeVisible();

  await sidebar.getByRole("link", { name: "Our Work" }).click();
  await expect(page).toHaveURL(/\/our-work$/);
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Our Work");
});
