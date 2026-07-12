import { describe, expect, test } from "bun:test";

import { hasPaidEntitlements, paymentGraceEndsAt } from "./billing";

const started = Date.UTC(2026, 6, 1);

describe("Church Subscription entitlements", () => {
  test("keeps Paid for exactly two weeks from the stable past-due start", () => {
    const subscription = { graceStartedAt: started, periodEnd: null, status: "past_due" };

    expect(paymentGraceEndsAt(subscription)).toBe(Date.UTC(2026, 6, 15));
    expect(hasPaidEntitlements(subscription, Date.UTC(2026, 6, 14, 23, 59, 59))).toBe(true);
    expect(hasPaidEntitlements(subscription, Date.UTC(2026, 6, 15))).toBe(false);
  });

  test("restores Paid immediately on recovery and treats terminal states as Free", () => {
    expect(
      hasPaidEntitlements({ graceStartedAt: started, periodEnd: null, status: "active" }),
    ).toBe(true);
    expect(
      hasPaidEntitlements({ graceStartedAt: started, periodEnd: null, status: "canceled" }),
    ).toBe(false);
  });
});
