import { createDb } from "@church-work/db";
import { organization, subscription } from "@church-work/db/schema";
import { hasPaidEntitlements, resolveChurchSubscription } from "@church-work/domain";
import { getOrgId } from "@church-work/shared/get-ids";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { betterAuth } from "better-auth/minimal";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import Stripe from "stripe";
import { describe, expect, test, vi } from "vitest";

import { createAuthOptions, createLocalOtpStore } from "./auth";
import { STRIPE_LOCAL_STUBS } from "./stripe-config";

const DAY_SECONDS = 24 * 60 * 60;
const PERIOD_START = Math.floor(Date.parse("2026-07-01T00:00:00.000Z") / 1000);

type WebhookState = {
  readonly cancelAtPeriodEnd?: boolean;
  readonly created: number;
  readonly endedAt?: number | null;
  readonly id?: string;
  readonly status: Stripe.Subscription.Status;
  readonly subscriptionId?: string;
  readonly type?: "created" | "deleted" | "updated";
};

const subscriptionEventType = (state: WebhookState) => {
  if (state.type === "deleted" || state.status === "canceled") {
    return "customer.subscription.deleted" as const;
  }

  if (
    state.type === "created" ||
    (state.status === "active" && state.subscriptionId === undefined)
  ) {
    return "customer.subscription.created" as const;
  }

  return "customer.subscription.updated" as const;
};

const subscriptionEvent = (state: WebhookState) => {
  const stripeSubscriptionId = state.subscriptionId ?? "sub_authoritative";
  return {
    api_version: "2025-04-30.basil",
    created: state.created,
    data: {
      object: {
        cancel_at: null,
        cancel_at_period_end: state.cancelAtPeriodEnd ?? false,
        canceled_at: state.status === "canceled" ? state.created : null,
        customer: "cus_authoritative",
        ended_at: state.endedAt ?? null,
        id: stripeSubscriptionId,
        items: {
          data: [
            {
              current_period_end: PERIOD_START + 7 * DAY_SECONDS,
              current_period_start: PERIOD_START,
              price: {
                id: STRIPE_LOCAL_STUBS.paidWeeklyPriceId,
                recurring: { interval: "week" },
              },
              quantity: 1,
            },
          ],
          object: "list",
        },
        metadata: {},
        object: "subscription",
        status: state.status,
      },
    },
    id: state.id ?? `evt_${stripeSubscriptionId}_${state.status}_${state.created}`,
    livemode: false,
    object: "event",
    pending_webhooks: 1,
    request: null,
    type: subscriptionEventType(state),
  } as const;
};

const signedWebhookRequest = (event: ReturnType<typeof subscriptionEvent>) => {
  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: STRIPE_LOCAL_STUBS.webhookSecret,
    timestamp: Math.floor(Date.now() / 1000),
  });

  return new Request("http://localhost:3000/api/auth/stripe/webhook", {
    body: payload,
    headers: { "stripe-signature": signature },
    method: "POST",
  });
};

describe("authoritative Stripe webhook lifecycle", () => {
  test("drives signed Stripe events through Better Auth and exposes the resulting Church Subscription", async () => {
    const container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const { db, pool } = createDb(container.getConnectionUri());
    const scheduleAtPeriodEnd = vi.fn(async () => {});

    try {
      await migrate(db, {
        migrationsFolder: new URL("../../db/drizzle", import.meta.url).pathname,
      });
      const auth = betterAuth(
        createAuthOptions(db, createLocalOtpStore(), { scheduleAtPeriodEnd }),
      );
      const churchId = getOrgId();
      await db.insert(organization).values({
        id: churchId,
        name: "Authoritative Webhook Church",
        stripeCustomerId: "cus_authoritative",
      });

      const deliver = async (state: WebhookState) => {
        const response = await auth.handler(signedWebhookRequest(subscriptionEvent(state)));
        expect(response.status).toBe(200);
        const rows = await db
          .select()
          .from(subscription)
          .where(eq(subscription.referenceId, churchId));
        return { current: resolveChurchSubscription(rows), rows };
      };

      // A Checkout return grants nothing. Only the first signed webhook creates Paid state.
      expect(resolveChurchSubscription([])).toBeNull();
      const activated = await deliver({ created: PERIOD_START + 60, status: "active" });
      expect(activated.current).toMatchObject({
        cancelAtPeriodEnd: false,
        plan: "paid",
        referenceId: churchId,
        status: "active",
      });
      expect(hasPaidEntitlements(activated.current)).toBe(true);

      // Duplicate delivery is harmless and cannot create another authoritative row.
      const duplicate = await deliver({ created: PERIOD_START + 60, status: "active" });
      expect(duplicate.rows).toHaveLength(1);

      const firstFailureAt = PERIOD_START + DAY_SECONDS;
      const pastDue = await deliver({
        created: firstFailureAt,
        status: "past_due",
        subscriptionId: "sub_authoritative",
      });
      expect(pastDue.current).toMatchObject({
        graceStartedAt: new Date(firstFailureAt * 1000),
        status: "past_due",
      });
      expect(hasPaidEntitlements(pastDue.current, (firstFailureAt + 13 * DAY_SECONDS) * 1000)).toBe(
        true,
      );
      expect(hasPaidEntitlements(pastDue.current, (firstFailureAt + 14 * DAY_SECONDS) * 1000)).toBe(
        false,
      );

      const retry = await deliver({
        created: firstFailureAt + 5 * DAY_SECONDS,
        status: "past_due",
        subscriptionId: "sub_authoritative",
      });
      expect(retry.current?.graceStartedAt).toEqual(new Date(firstFailureAt * 1000));

      // An older first-failure event arriving after a retry must move grace to
      // the authoritative Stripe timestamp instead of extending the period.
      const earlierFailureAt = firstFailureAt - DAY_SECONDS;
      const outOfOrderFirstFailure = await deliver({
        created: earlierFailureAt,
        id: "evt_delayed_first_failure",
        status: "past_due",
        subscriptionId: "sub_authoritative",
      });
      expect(outOfOrderFirstFailure.current?.graceStartedAt).toEqual(
        new Date(earlierFailureAt * 1000),
      );

      const recovered = await deliver({
        created: firstFailureAt + 6 * DAY_SECONDS,
        status: "active",
        subscriptionId: "sub_authoritative",
      });
      expect(recovered.current).toMatchObject({ graceStartedAt: null, status: "active" });
      expect(hasPaidEntitlements(recovered.current)).toBe(true);

      const canceling = await deliver({
        cancelAtPeriodEnd: true,
        created: firstFailureAt + 7 * DAY_SECONDS,
        status: "active",
        subscriptionId: "sub_authoritative",
      });
      expect(canceling.current).toMatchObject({ cancelAtPeriodEnd: true, status: "active" });
      expect(hasPaidEntitlements(canceling.current)).toBe(true);

      const canceled = await deliver({
        created: firstFailureAt + 8 * DAY_SECONDS,
        endedAt: PERIOD_START + 7 * DAY_SECONDS,
        status: "canceled",
        subscriptionId: "sub_authoritative",
      });
      expect(canceled.current).toMatchObject({ status: "canceled" });
      expect(hasPaidEntitlements(canceled.current)).toBe(false);

      // These are exactly the member-safe columns exposed by subscription.by_church in Zero.
      const zeroVisible = canceled.current && {
        cancelAt: canceled.current.cancelAt,
        cancelAtPeriodEnd: canceled.current.cancelAtPeriodEnd,
        canceledAt: canceled.current.canceledAt,
        endedAt: canceled.current.endedAt,
        graceStartedAt: canceled.current.graceStartedAt,
        id: canceled.current.id,
        periodEnd: canceled.current.periodEnd,
        periodStart: canceled.current.periodStart,
        plan: canceled.current.plan,
        referenceId: canceled.current.referenceId,
        status: canceled.current.status,
      };
      expect(zeroVisible).toMatchObject({
        cancelAtPeriodEnd: false,
        canceledAt: expect.any(Date),
        endedAt: expect.any(Date),
        id: expect.any(String),
        periodEnd: expect.any(Date),
        periodStart: expect.any(Date),
        plan: "paid",
        referenceId: churchId,
        status: "canceled",
      });
      expect(zeroVisible).not.toHaveProperty("stripeCustomerId");

      // A replacement subscription remains authoritative when an older
      // subscription's terminal webhook is duplicated out of order.
      const replacement = await deliver({
        created: firstFailureAt + 9 * DAY_SECONDS,
        status: "active",
        subscriptionId: "sub_replacement",
        type: "created",
      });
      expect(replacement.current).toMatchObject({
        status: "active",
        stripeSubscriptionId: "sub_replacement",
      });
      const staleTerminal = await deliver({
        created: firstFailureAt + 8 * DAY_SECONDS,
        endedAt: PERIOD_START + 7 * DAY_SECONDS,
        id: "evt_old_terminal_redelivery",
        status: "canceled",
        subscriptionId: "sub_authoritative",
        type: "deleted",
      });
      expect(staleTerminal.rows).toHaveLength(2);
      expect(staleTerminal.current).toMatchObject({
        status: "active",
        stripeSubscriptionId: "sub_replacement",
      });
    } finally {
      await pool.end();
      await container.stop();
    }
  }, 60_000);
});
