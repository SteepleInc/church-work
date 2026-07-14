import type Stripe from "stripe";
import { describe, expect, test, vi } from "vitest";

import { paidPriceConfigurationErrors, verifyStripePaidPrice } from "./verify-stripe-paid-price";

const validPrice = {
  active: true,
  billing_scheme: "per_unit",
  currency: "usd",
  id: "price_live_weekly",
  livemode: true,
  metadata: { church_work_scope: "church" },
  recurring: { interval: "week", interval_count: 1, usage_type: "licensed" },
  tax_behavior: "inclusive",
  unit_amount: 1_999,
} as const;

describe("Stripe Paid Price deployment check", () => {
  test("accepts exactly $19.99 USD per Church per week with inclusive tax", async () => {
    const retrieve = vi.fn().mockResolvedValue(validPrice);

    await expect(
      verifyStripePaidPrice(
        { prices: { retrieve } } as unknown as Pick<Stripe, "prices">,
        validPrice.id,
      ),
    ).resolves.toMatchObject(validPrice);
    expect(retrieve).toHaveBeenCalledWith(validPrice.id);
  });

  test("reports every unsafe purchasable Price property", () => {
    expect(
      paidPriceConfigurationErrors({
        ...validPrice,
        active: false,
        billing_scheme: "tiered",
        currency: "eur",
        livemode: false,
        metadata: {},
        recurring: {
          ...validPrice.recurring,
          interval: "month",
          interval_count: 2,
          meter: null,
          trial_period_days: null,
          usage_type: "metered",
        },
        tax_behavior: "exclusive",
        unit_amount: 2_000,
      }),
    ).toEqual([
      "Price must be active",
      "Price must belong to the live Stripe account",
      "Price must use per-unit billing",
      "Price currency must be USD",
      "Price amount must be $19.99",
      "Price interval must be weekly",
      "Price interval count must be one",
      "Price must be licensed, not metered",
      "Price tax behavior must be inclusive",
      "Price metadata church_work_scope must be church",
    ]);
  });
});
