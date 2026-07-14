import { expect, test } from "@playwright/test";

import { seedTasks, setTestSubscription, startAuthenticatedSession } from "./helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

test.skip(
  process.env.CHURCH_WORK_E2E_ONBOARDING_STACK !== "1",
  "Run against the local Postgres/Zero onboarding stack.",
);

test.setTimeout(120_000);

test("shows a new Church owner the Church-scoped Free Plan", async ({ page }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;

  await startAuthenticatedSession(page, {
    churchName: `E2E Billing Church ${suffix}`,
    email: `billing-${suffix}@example.com`,
    userName: "E2E Billing Owner",
  });

  await page.goto("/settings/workspace/billing");

  await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Free Plan", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Upgrade to Paid" }).first()).toBeVisible();
  await expect(page.getByText("No active Church selected.")).not.toBeVisible();
});

test("starts stubbed Checkout and keeps the return pending until webhook state arrives", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  await startAuthenticatedSession(page, {
    churchName: `E2E Checkout Church ${suffix}`,
    email: `billing-checkout-${suffix}@example.com`,
    userName: "E2E Billing Owner",
  });
  let checkoutRequest: Record<string, unknown> | undefined;
  await page.route("**/api/auth/subscription/upgrade", async (route) => {
    checkoutRequest = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      contentType: "application/json",
      json: { redirect: true, url: `${page.url().split("/settings")[0]}/hosted-checkout-stub` },
    });
  });
  await page.route("**/hosted-checkout-stub", (route) =>
    route.fulfill({ body: "Stubbed Stripe Checkout", contentType: "text/html" }),
  );

  await page.goto("/settings/workspace/billing");
  await expect(
    page.getByText(
      "Checkout opens on Stripe's secure hosted page — no card details are stored in Church Work.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Upgrade to Paid" }).first().click();
  await expect(page).toHaveURL(/hosted-checkout-stub/);
  expect(checkoutRequest).toMatchObject({
    customerType: "organization",
    plan: "paid",
  });

  await page.goto("/settings/workspace/billing?checkout=complete");
  await expect(page.getByText("Checkout complete — Paid activation pending")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("Free Plan", { exact: true }).first()).toBeVisible();

  await setTestSubscription(page, { status: "active" });
  await page.reload();
  await expect(page.getByText("Paid Plan active")).toBeVisible({ timeout: 20_000 });
});

test("opens the stubbed Customer Portal for an authorized Church", async ({ page }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  await startAuthenticatedSession(page, {
    churchName: `E2E Portal Church ${suffix}`,
    email: `billing-portal-${suffix}@example.com`,
    userName: "E2E Billing Owner",
  });
  await setTestSubscription(page, { status: "active" });
  let portalRequest: Record<string, unknown> | undefined;
  await page.route("**/api/auth/subscription/billing-portal", async (route) => {
    portalRequest = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      contentType: "application/json",
      json: { redirect: true, url: `${page.url().split("/settings")[0]}/hosted-portal-stub` },
    });
  });
  await page.route("**/hosted-portal-stub", (route) =>
    route.fulfill({ body: "Stubbed Stripe Customer Portal", contentType: "text/html" }),
  );

  await page.goto("/settings/workspace/billing");
  await expect(
    page.getByText("Payment, invoices, and plan changes open in Stripe's secure hosted page."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Manage billing" }).click();
  await expect(page).toHaveURL(/hosted-portal-stub/);
  expect(portalRequest).toMatchObject({ customerType: "organization" });
});

test("shows a re-subscribed Church as Paid when canceled history remains", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  await startAuthenticatedSession(page, {
    churchName: `E2E Re-subscribed Church ${suffix}`,
    email: `billing-resubscribed-${suffix}@example.com`,
    userName: "E2E Billing Owner",
  });
  await setTestSubscription(page, { historyKey: "old", status: "canceled" });
  await setTestSubscription(page, { historyKey: "current", status: "active" });

  await page.goto("/settings/workspace/billing");
  await expect(page.getByText("Paid Plan", { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("button", { name: "Upgrade to Paid" })).not.toBeVisible();
});

test("restores paid and free Churches without hiding their existing work", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const churchName = `E2E Restored Church ${suffix}`;
  const taskTitle = `Preserved restoration Task ${suffix}`;
  await startAuthenticatedSession(page, {
    churchName,
    email: `billing-restoration-${suffix}@example.com`,
    userName: "E2E Billing Owner",
  });
  await seedTasks(page, {
    tasks: [{ status: "To Do", title: taskTitle }],
    team: "Worship",
  });
  // Stripe has already acknowledged period-end cancellation, so this exercises
  // the real lifecycle endpoint without making an external Stripe request.
  await setTestSubscription(page, { cancelAtPeriodEnd: true, status: "active" });

  const churchId = await page.evaluate(async () => {
    const response = await fetch("/api/auth/get-session");
    const session = (await response.json()) as { session: { activeOrganizationId: string } };
    return session.session.activeOrganizationId;
  });

  const deleteAndRestore = async () => {
    await page.goto("/settings/workspace/general");
    await expect(page.getByRole("button", { name: "Delete Church" })).toBeVisible({
      timeout: 20_000,
    });
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete Church" }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });

    await page.goto("/settings/workspace/billing");
    await expect(page.getByText("No active Church selected.")).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: /Upgrade to Paid|Manage billing|Fix payment/ }),
    ).toHaveCount(0);

    const deletedBillingStatuses = await page.evaluate(async (organizationId) => {
      const request = (path: string, body: Record<string, unknown>) =>
        fetch(`/api/auth/subscription/${path}`, {
          body: JSON.stringify({
            customerType: "organization",
            referenceId: organizationId,
            ...body,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
      return Promise.all([
        request("upgrade", { plan: "paid" }).then((response) => response.status),
        request("billing-portal", { returnUrl: "/" }).then((response) => response.status),
      ]);
    }, churchId);
    expect(deletedBillingStatuses).toEqual([401, 401]);

    const restored = await page.evaluate(async (organizationId) => {
      const restoreResponse = await fetch("/api/auth/church/restore", {
        body: JSON.stringify({ churchId: organizationId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const activateResponse = await fetch("/api/auth/organization/set-active", {
        body: JSON.stringify({ organizationId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      return restoreResponse.ok && activateResponse.ok;
    }, churchId);
    expect(restored).toBe(true);
    await page.goto("/our-work");
    await expect(page.getByText(taskTitle, { exact: true })).toBeVisible({
      timeout: 20_000,
    });
  };

  await deleteAndRestore();
  await page.goto("/settings/workspace/billing");
  await expect(page.getByText("Paid Plan", { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });
  await page.goto("/our-work");
  await expect(page.getByText(taskTitle, { exact: true })).toBeVisible({ timeout: 20_000 });

  await setTestSubscription(page, { status: "canceled" });
  await deleteAndRestore();
  await page.goto("/settings/workspace/billing");
  await expect(page.getByText("Free Plan", { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });
  await page.goto("/our-work");
  await expect(page.getByText(taskTitle, { exact: true })).toBeVisible({ timeout: 20_000 });
});

test("shows a Free Plan member their Task Usage without billing actions", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  await startAuthenticatedSession(page, {
    churchName: `E2E Free Member Church ${suffix}`,
    churchRole: "member",
    email: `billing-free-member-${suffix}@example.com`,
    userName: "E2E Billing Member",
  });
  await seedTasks(page, {
    tasks: Array.from({ length: 3 }, (_, index) => ({
      status: "To Do",
      title: `Member usage Task ${index + 1}`,
    })),
    team: "Worship",
  });

  await page.goto("/settings/workspace/billing");

  await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Free Plan", { exact: true }).first()).toBeVisible();

  // Members see live Task Usage against the Free Plan limit on the Billing
  // screen — this is where they come to understand their limits.
  const usageMeter = page.getByRole("meter", { name: "Free Plan Task Usage" });
  await expect(usageMeter).toBeVisible({ timeout: 20_000 });
  await expect(usageMeter).toHaveAttribute("aria-valuenow", "3");
  await expect(usageMeter).toHaveAttribute("aria-valuemax", "300");
  await expect(usageMeter).toHaveAttribute(
    "aria-valuetext",
    "3 of 300 Tasks in the Active Planning Horizon",
  );
  await expect(page.getByText(/of 300 Tasks/).first()).toBeVisible();
  await expect(page.getByText(/297 Tasks remaining before the Free Plan limit/)).toBeVisible();

  // ...but never any hosted billing actions.
  await expect(
    page.getByRole("button", { name: /Upgrade to Paid|Manage billing|Fix payment/ }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/Only Church owners and admins can manage the Church Subscription/),
  ).toBeVisible();
});

test("shows a grace deadline and recovery action to a past-due owner", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  await startAuthenticatedSession(page, {
    churchName: `E2E Past Due Church ${suffix}`,
    email: `billing-past-due-${suffix}@example.com`,
    userName: "E2E Billing Owner",
  });
  await setTestSubscription(page, {
    graceStartedAt: Date.now() - DAY_MS,
    status: "past_due",
  });

  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Payment past due." })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("link", { name: "Fix payment" })).toBeVisible();

  await page.goto("/settings/workspace/billing");
  await expect(page.getByText(/Payment past due — unlimited access ends/)).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("button", { name: "Fix payment" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Upgrade to Paid" })).not.toBeVisible();
});

test("shows an expired grace warning without payment actions to a member", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  await startAuthenticatedSession(page, {
    churchName: `E2E Expired Grace Church ${suffix}`,
    churchRole: "member",
    email: `billing-member-${suffix}@example.com`,
    userName: "E2E Billing Member",
  });
  await setTestSubscription(page, {
    graceStartedAt: Date.now() - 15 * DAY_MS,
    status: "past_due",
  });

  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Free Plan limits apply.", {
    timeout: 20_000,
  });
  await expect(page.getByText("A Church owner or admin can restore the Paid Plan.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Fix payment" })).not.toBeVisible();

  await page.goto("/settings/workspace/billing");
  await expect(page.getByText("Payment Grace Period ended — Free Plan limits apply")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/Nothing was deleted or hidden/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Fix payment|Manage billing|Upgrade to Paid/ }),
  ).toHaveCount(0);
});
