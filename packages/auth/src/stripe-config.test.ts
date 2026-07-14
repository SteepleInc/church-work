import { describe, expect, test } from "vitest";

import { resolveStripeBillingConfig, STRIPE_LOCAL_STUBS } from "./stripe-config";

describe("Stripe billing configuration", () => {
  test("uses isolated stubs outside production", () => {
    expect(resolveStripeBillingConfig({ NODE_ENV: "test" })).toEqual(STRIPE_LOCAL_STUBS);
  });

  test.each([
    [
      "STRIPE_SECRET_KEY",
      { STRIPE_WEBHOOK_SECRET: "whsec_live", STRIPE_PAID_WEEKLY_PRICE_ID: "price_live" },
    ],
    [
      "STRIPE_WEBHOOK_SECRET",
      { STRIPE_SECRET_KEY: "sk_live_secret", STRIPE_PAID_WEEKLY_PRICE_ID: "price_live" },
    ],
    [
      "STRIPE_PAID_WEEKLY_PRICE_ID",
      { STRIPE_SECRET_KEY: "sk_live_secret", STRIPE_WEBHOOK_SECRET: "whsec_live" },
    ],
  ] as const)("fails production startup when %s is absent", (name, values) => {
    expect(() => resolveStripeBillingConfig({ NODE_ENV: "production", ...values })).toThrow(name);
  });

  test.each([
    ["test key", { STRIPE_SECRET_KEY: "sk_test_not_live" }],
    ["stub webhook", { STRIPE_WEBHOOK_SECRET: "whsec_church_work_stub" }],
    ["malformed Price", { STRIPE_PAID_WEEKLY_PRICE_ID: "prod_weekly" }],
  ])("rejects a production %s", (_label, override) => {
    expect(() =>
      resolveStripeBillingConfig({
        NODE_ENV: "production",
        STRIPE_PAID_WEEKLY_PRICE_ID: "price_live_weekly",
        STRIPE_SECRET_KEY: "sk_live_secret",
        STRIPE_WEBHOOK_SECRET: "whsec_live",
        ...override,
      }),
    ).toThrow(/invalid for production Stripe billing/);
  });

  test("accepts complete live production configuration", () => {
    expect(
      resolveStripeBillingConfig({
        NODE_ENV: "production",
        STRIPE_PAID_WEEKLY_PRICE_ID: "price_live_weekly",
        STRIPE_SECRET_KEY: "sk_live_secret",
        STRIPE_WEBHOOK_SECRET: "whsec_live",
      }),
    ).toEqual({
      paidWeeklyPriceId: "price_live_weekly",
      secretKey: "sk_live_secret",
      webhookSecret: "whsec_live",
    });
  });

  test("does not reject valid values only because their generated suffix contains test", () => {
    expect(
      resolveStripeBillingConfig({
        NODE_ENV: "production",
        STRIPE_PAID_WEEKLY_PRICE_ID: "price_contest_weekly",
        STRIPE_SECRET_KEY: "sk_live_latest_secret",
        STRIPE_WEBHOOK_SECRET: "whsec_contest_secret",
      }),
    ).toEqual({
      paidWeeklyPriceId: "price_contest_weekly",
      secretKey: "sk_live_latest_secret",
      webhookSecret: "whsec_contest_secret",
    });
  });
});
