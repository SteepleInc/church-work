import { expect, test } from "@playwright/test";

test.skip(
  process.env.CHURCH_WORK_E2E_READY !== "1",
  process.env.CHURCH_WORK_E2E_SKIP_REASON ?? "E2E environment is not configured.",
);

test("marketing home keeps the copied PreachX desktop treatment", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/");

  await expect(page.locator("html")).toHaveClass(/marketing-dark/);
  await expect(page.getByRole("link", { name: "Church Work" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Workflows For Churches", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Shared task clarity, built for church teams.", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("How It Works", { exact: true })).toBeVisible();
});

test("marketing home keeps the copied PreachX mobile treatment", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");

  await expect(page.locator("html")).toHaveClass(/marketing-dark/);
  await expect(
    page.getByRole("heading", { name: "Workflows For Churches", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Get Started" }).first()).toBeVisible();
  await expect(
    page.getByText("Shared task clarity, built for church teams.").first(),
  ).toBeVisible();
});

test("marketing library keeps Church Work copy in the copied collection card layout", async ({
  page,
}) => {
  await page.goto("/library");

  await expect(
    page.getByRole("heading", { name: "A working library for church operations." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /My Work/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Our Work/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Settings/ })).toBeVisible();
  await expect(page.getByText(/Sermon|PreachX|preacher|royalty/)).toHaveCount(0);
});

test("pricing presents Free and Paid plans and their upgrade path", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/pricing");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Plan the work now. Upgrade when you need more room.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Free Plan" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Paid Plan" })).toBeVisible();
  await expect(page.getByText("$0", { exact: true })).toBeVisible();
  await expect(page.getByText("$19.99", { exact: true })).toBeVisible();

  const comparison = page.getByRole("table", { name: "Free Plan and Paid Plan comparison" });
  await expect(
    comparison.getByRole("row", { name: /Planned Tasks Up to 300 Unlimited/ }),
  ).toBeVisible();

  const pricingCtas = page.getByRole("link", { name: /Start free/ });
  await expect(pricingCtas).toHaveCount(2);
  await expect(pricingCtas.first()).toHaveAttribute("href", "/sign-in");
  await expect(pricingCtas.last()).toHaveAttribute("href", "/sign-in");
});
