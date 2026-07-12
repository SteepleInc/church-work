export const PAYMENT_GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000;

export type ChurchSubscriptionState = {
  readonly status?: string | null;
  readonly periodEnd?: Date | number | null;
  readonly graceStartedAt?: Date | number | null;
};

const epoch = (value: Date | number): number => (value instanceof Date ? value.getTime() : value);

export function paymentGraceEndsAt(
  subscription: Pick<ChurchSubscriptionState, "graceStartedAt">,
): number | null {
  return subscription.graceStartedAt == null
    ? null
    : epoch(subscription.graceStartedAt) + PAYMENT_GRACE_PERIOD_MS;
}

/** The single policy seam used by Task creation and billing UI. */
export function hasPaidEntitlements(
  subscription: ChurchSubscriptionState | null,
  now: Date | number = Date.now(),
): boolean {
  if (!subscription) return false;
  if (subscription.status === "active" || subscription.status === "trialing") return true;
  if (subscription.status === "past_due") {
    const graceEndsAt = paymentGraceEndsAt(subscription);
    return graceEndsAt !== null && epoch(now) < graceEndsAt;
  }

  // Cancellation is webhook-owned. Active remains active until Stripe changes
  // the status at the purchased period end; terminal states are Free.
  return false;
}
