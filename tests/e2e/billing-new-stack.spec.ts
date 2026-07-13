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
  await seedTasks(page, {
    tasks: Array.from({ length: 300 }, (_, index) => ({
      status: "To Do",
      title: `Paid capacity Task ${index + 1}`,
    })),
    team: "Worship",
  });

  await page.goto("/settings/workspace/billing");
  await expect(page.getByText("Paid Plan", { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("button", { name: "Upgrade to Paid" })).not.toBeVisible();

  await page.goto("/my-work");
  const createTaskButton = page.getByRole("main").getByRole("button", { name: "Create Task" });
  await expect(createTaskButton).toBeEnabled({
    timeout: 20_000,
  });
  await createTaskButton.click();
  const dialog = page.getByRole("dialog", { name: /New Task/ });
  const title = `Paid over-limit Task ${suffix}`;
  await dialog.getByPlaceholder("Task title").fill(title);
  await dialog.getByRole("button", { name: "Create Task" }).click();
  await expect(dialog).not.toBeVisible();

  // The seeded usage set can put the new card outside the virtualized viewport.
  // Global Search observes the full Church Task collection, so finding it there
  // confirms that the over-limit server mutation was accepted rather than rolled back.
  await page.getByRole("button", { name: "Open global search" }).click();
  await page.getByRole("textbox", { name: "Global Search" }).fill(title);
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
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
  await expect(page.getByText(/of 300 Tasks/).first()).toBeVisible();

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
