export const STRIPE_LOCAL_STUBS = {
  paidWeeklyPriceId: "price_church_work_paid_weekly_stub",
  secretKey: "sk_test_church_work_stub",
  webhookSecret: "whsec_church_work_stub",
} as const;

export type StripeBillingConfig = {
  readonly paidWeeklyPriceId: string;
  readonly secretKey: string;
  readonly webhookSecret: string;
};

type StripeConfigEnv = Partial<
  Record<
    "NODE_ENV" | "STRIPE_PAID_WEEKLY_PRICE_ID" | "STRIPE_SECRET_KEY" | "STRIPE_WEBHOOK_SECRET",
    string | undefined
  >
>;

const productionValue = (
  env: StripeConfigEnv,
  name: keyof StripeConfigEnv,
  expectedPrefix: string,
) => {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for production Stripe billing.`);
  }

  if (!value.startsWith(expectedPrefix) || value.includes("stub")) {
    throw new Error(
      `${name} is invalid for production Stripe billing; expected a live ${expectedPrefix} value.`,
    );
  }

  return value;
};

/**
 * Resolves all Stripe billing configuration at auth startup. Local/test runs
 * remain self-contained; production fails before serving traffic rather than
 * silently constructing Stripe with test-only placeholders.
 */
export const resolveStripeBillingConfig = (env: StripeConfigEnv): StripeBillingConfig => {
  if (env.NODE_ENV !== "production") {
    return {
      paidWeeklyPriceId:
        env.STRIPE_PAID_WEEKLY_PRICE_ID?.trim() || STRIPE_LOCAL_STUBS.paidWeeklyPriceId,
      secretKey: env.STRIPE_SECRET_KEY?.trim() || STRIPE_LOCAL_STUBS.secretKey,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET?.trim() || STRIPE_LOCAL_STUBS.webhookSecret,
    };
  }

  return {
    paidWeeklyPriceId: productionValue(env, "STRIPE_PAID_WEEKLY_PRICE_ID", "price_"),
    secretKey: productionValue(env, "STRIPE_SECRET_KEY", "sk_live_"),
    webhookSecret: productionValue(env, "STRIPE_WEBHOOK_SECRET", "whsec_"),
  };
};
