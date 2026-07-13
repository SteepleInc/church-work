import { describe, expect, test } from "vitest";

import { hasPaidEntitlements, paymentGraceEndsAt, resolveChurchSubscription } from "./billing";

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

describe("authoritative Church Subscription resolution", () => {
  const subscription = (
    id: string,
    status: string,
    periodStart: number,
    overrides: Record<string, unknown> = {},
  ) => ({ id, status, periodStart, ...overrides });

  test("resolves no Subscription as Free", () => {
    expect(resolveChurchSubscription([])).toBeNull();
  });

  test("resolves one active Subscription", () => {
    const active = subscription("active", "active", 100);
    expect(resolveChurchSubscription([active])).toBe(active);
  });

  test("does not grant Paid from a Checkout-era incomplete row", () => {
    const resolved = resolveChurchSubscription([subscription("checkout", "incomplete", 100)]);
    expect(hasPaidEntitlements(resolved)).toBe(false);
  });

  test("resolves canceled-only history deterministically", () => {
    const older = subscription("older", "canceled", 100, { endedAt: 200 });
    const newer = subscription("newer", "canceled", 300, { endedAt: 400 });
    expect(resolveChurchSubscription([newer, older])).toBe(newer);
    expect(resolveChurchSubscription([older, newer])).toBe(newer);
  });

  test("uses the Subscription id as a stable final tie-breaker", () => {
    const first = { id: "a", status: "canceled" };
    const last = { id: "z", status: "canceled" };
    expect(resolveChurchSubscription([last, first])).toBe(last);
    expect(resolveChurchSubscription([first, last])).toBe(last);
  });

  test("never lets canceled history mask a re-subscription", () => {
    const canceled = subscription("canceled", "canceled", 300, { endedAt: 400 });
    const active = subscription("active", "active", 500);
    expect(resolveChurchSubscription([canceled, active])).toBe(active);
  });

  test("uses recency across active and past-due webhook states", () => {
    const pastDue = subscription("new-past-due", "past_due", 500, { periodEnd: 600 });
    expect(
      resolveChurchSubscription([
        subscription("old-active", "active", 100, { periodEnd: 1_000 }),
        pastDue,
      ]),
    ).toBe(pastDue);
  });

  test.each([
    ["grace active", started - 24 * 60 * 60 * 1000, true],
    ["grace expired", started - 15 * 24 * 60 * 60 * 1000, false],
  ])("resolves past due with %s", (_label, graceStartedAt, entitled) => {
    const pastDue = subscription("past-due", "past_due", 500, { graceStartedAt });
    const resolved = resolveChurchSubscription([
      subscription("canceled", "canceled", 100),
      pastDue,
    ]);

    expect(resolved).toBe(pastDue);
    expect(hasPaidEntitlements(resolved, started)).toBe(entitled);
  });

  test("prefers an active canceling Subscription over terminal rows", () => {
    const canceling = subscription("canceling", "active", 500, { cancelAtPeriodEnd: true });
    expect(
      resolveChurchSubscription([
        subscription("unpaid", "unpaid", 700),
        subscription("canceled", "canceled", 800),
        canceling,
      ]),
    ).toBe(canceling);
  });
});
