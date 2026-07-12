import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import { canManageSubscription, graceDaysLeft } from "./billing-helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("billing helpers", () => {
  it("lets only owners and admins manage the Church Subscription", () => {
    expect(canManageSubscription("owner")).toBe(true);
    expect(canManageSubscription("admin")).toBe(true);
    expect(canManageSubscription("member")).toBe(false);
  });

  it("counts whole days left in the Payment Grace Period, never negative", () => {
    const now = Date.UTC(2026, 6, 12);

    expect(graceDaysLeft(now + 5 * DAY_MS, now)).toBe(5);
    expect(graceDaysLeft(now + DAY_MS / 2, now)).toBe(1);
    expect(graceDaysLeft(now, now)).toBe(0);
    expect(graceDaysLeft(now - DAY_MS, now)).toBe(0);
  });
});

describe("Past-due warning fidelity", () => {
  const bannerSource = readFileSync(new URL("./past-due-banner.tsx", import.meta.url), "utf8");
  const billingSource = readFileSync(
    new URL("../settings/church-billing.tsx", import.meta.url),
    "utf8",
  );
  const appShellSource = readFileSync(
    new URL("../../components/app-shell.tsx", import.meta.url),
    "utf8",
  );
  const settingsShellSource = readFileSync(
    new URL("../settings/settings-shell.tsx", import.meta.url),
    "utf8",
  );

  it("mounts the banner in both the app shell and the settings shell", () => {
    expect(appShellSource).toContain("<PastDueBanner />");
    expect(settingsShellSource).toContain("<PastDueBanner />");
  });

  it("shows every Church Member the grace deadline, but gates Fix payment on role", () => {
    expect(bannerSource).toContain("formatBillingDate(graceEndsAt)");
    expect(bannerSource).toContain("canManage ? (");
    expect(bannerSource).toContain("Fix payment");
    // Members get guidance, never billing details or payment actions.
    expect(bannerSource).toContain("A Church owner or admin can fix payment.");
  });

  it("keeps grace-active and grace-expired recovery states on the Billing screen", () => {
    expect(billingSource).toContain("Payment past due — unlimited access ends");
    expect(billingSource).toContain("Payment Grace Period ended — Free Plan limits apply");
    expect(billingSource).toContain("Cancellation scheduled — Paid access ends");
    // Recovery goes through the Customer Portal; no fresh Checkout while past due.
    expect(billingSource).toContain("const canUpgrade = canManage && !isPaid && !isPastDue;");
  });
});
