import Stripe from "stripe";

import { resolveStripeBillingConfig } from "./stripe-config";

type PaidPrice = Pick<
  Stripe.Price,
  | "active"
  | "billing_scheme"
  | "currency"
  | "id"
  | "livemode"
  | "metadata"
  | "recurring"
  | "tax_behavior"
  | "unit_amount"
>;

export const paidPriceConfigurationErrors = (price: PaidPrice): string[] => {
  const checks: ReadonlyArray<readonly [boolean, string]> = [
    [price.active, "Price must be active"],
    [price.livemode, "Price must belong to the live Stripe account"],
    [price.billing_scheme === "per_unit", "Price must use per-unit billing"],
    [price.currency === "usd", "Price currency must be USD"],
    [price.unit_amount === 1_999, "Price amount must be $19.99"],
    [price.recurring?.interval === "week", "Price interval must be weekly"],
    [price.recurring?.interval_count === 1, "Price interval count must be one"],
    [price.recurring?.usage_type === "licensed", "Price must be licensed, not metered"],
    [price.tax_behavior === "inclusive", "Price tax behavior must be inclusive"],
    [
      price.metadata.church_work_scope === "church",
      "Price metadata church_work_scope must be church",
    ],
  ];

  return checks.filter(([passes]) => !passes).map(([, message]) => message);
};

export const verifyStripePaidPrice = async (stripe: Pick<Stripe, "prices">, priceId: string) => {
  const price = await stripe.prices.retrieve(priceId);
  const errors = paidPriceConfigurationErrors(price);

  if (errors.length > 0) {
    throw new Error(`Stripe Paid Price ${priceId} is not deploy-safe:\n- ${errors.join("\n- ")}`);
  }

  return price;
};

if (import.meta.main) {
  const config = resolveStripeBillingConfig({ ...process.env, NODE_ENV: "production" });
  const price = await verifyStripePaidPrice(new Stripe(config.secretKey), config.paidWeeklyPriceId);
  console.info(
    `Verified Stripe Paid Price ${price.id}: $19.99 USD per Church per week, tax inclusive.`,
  );
}
