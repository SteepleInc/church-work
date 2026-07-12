ALTER TABLE "organization" ADD COLUMN "stripe_customer_id" text;
CREATE UNIQUE INDEX "organization_stripe_customer_id_unique" ON "organization" ("stripe_customer_id");

CREATE TABLE "subscription" (
  "id" text PRIMARY KEY NOT NULL,
  "plan" text NOT NULL,
  "reference_id" text NOT NULL,
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "status" text DEFAULT 'incomplete' NOT NULL,
  "period_start" timestamp with time zone,
  "period_end" timestamp with time zone,
  "trial_start" timestamp with time zone,
  "trial_end" timestamp with time zone,
  "cancel_at_period_end" boolean DEFAULT false NOT NULL,
  "cancel_at" timestamp with time zone,
  "canceled_at" timestamp with time zone,
  "ended_at" timestamp with time zone,
  "seats" integer,
  "billing_interval" text,
  "stripe_schedule_id" text
);
CREATE INDEX "subscription_reference_id_idx" ON "subscription" ("reference_id");
CREATE UNIQUE INDEX "subscription_stripe_subscription_id_idx" ON "subscription" ("stripe_subscription_id");
