import { describe, expect, test } from "bun:test";

import { toAdminChurchBilling } from "./orgsData.app";

describe("App Administration Church billing", () => {
  test("represents a Church without a subscription as Free with absent lifecycle dates", () => {
    expect(toAdminChurchBilling(null, 42)).toEqual({
      plan: "Free",
      status: null,
      periodEnd: null,
      cancelAtPeriodEnd: false,
      cancelAt: null,
      canceledAt: null,
      endedAt: null,
      graceEndsAt: null,
      taskUsage: 42,
    });
  });

  test("presents Paid lifecycle and grace state without payment data", () => {
    const graceStartedAt = Date.now();
    const billing = toAdminChurchBilling(
      {
        status: "past_due",
        graceStartedAt,
        periodEnd: graceStartedAt + 1_000,
        cancelAtPeriodEnd: true,
        cancelAt: graceStartedAt + 2_000,
        canceledAt: null,
        endedAt: null,
      } as never,
      301,
    );

    expect(billing.plan).toBe("Paid");
    expect(billing.status).toBe("past_due");
    expect(billing.graceEndsAt).toBeGreaterThan(graceStartedAt);
    expect(billing.taskUsage).toBe(301);
    expect(billing).not.toHaveProperty("stripeCustomerId");
    expect(billing).not.toHaveProperty("stripeSubscriptionId");
  });
});
