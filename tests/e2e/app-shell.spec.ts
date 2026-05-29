import { expect, test } from "@playwright/test";

test("home route shows the app shell and connected API status", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/church-task/);
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "API Status" })).toBeVisible();
  await expect(page.getByText("Connected")).toBeVisible();
});

test("header navigation moves between Home and Dashboard", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible();

  await page.getByRole("link", { name: "Home" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "API Status" })).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();

  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible();
});

test("dashboard shows signup by default when unauthenticated", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible();
  await expect(page.getByLabel("Name")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign Up" })).toBeVisible();
});

test("dashboard auth entry switches between signup and signin", async ({ page }) => {
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Already have an account? Sign In" }).click();

  await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();

  await page.getByRole("button", { name: "Need an account? Sign Up" }).click();

  await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign Up" })).toBeVisible();
});

test("signup shows validation errors for invalid values", async ({ page }) => {
  await page.goto("/dashboard");

  await page.getByLabel("Name").fill("A");
  await page.getByLabel("Email").fill("invalid@example");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Sign Up" }).click();

  await expect(page.getByText("Name must be at least 2 characters")).toBeVisible();
  await expect(page.getByText("Invalid email address")).toBeVisible();
  await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
});

test("signup reaches the authenticated dashboard with private data", async ({ page }, testInfo) => {
  const uniqueEmail = `e2e-signup-${Date.now()}-${testInfo.workerIndex}@example.com`;

  await page.goto("/dashboard");

  await page.getByLabel("Name").fill("E2E Signup User");
  await page.getByLabel("Email").fill(uniqueEmail);
  await page.getByLabel("Password").fill("E2ePassword123!");
  await page.getByRole("button", { name: "Sign Up" }).click();

  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("privateData: This is private")).toBeVisible();
});
