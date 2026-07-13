export const PAYMENT_GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000;

export type ChurchSubscriptionState = {
  readonly status?: string | null;
  readonly periodEnd?: Date | number | null;
  readonly graceStartedAt?: Date | number | null;
};

export type ResolvableChurchSubscription = ChurchSubscriptionState & {
  readonly id: string;
  readonly periodStart?: Date | number | null;
  readonly trialStart?: Date | number | null;
  readonly trialEnd?: Date | number | null;
  readonly cancelAt?: Date | number | null;
  readonly canceledAt?: Date | number | null;
  readonly endedAt?: Date | number | null;
};

const epoch = (value: Date | number): number => (value instanceof Date ? value.getTime() : value);

const statusPriority = (status: string | null | undefined): number => {
  if (status === "active" || status === "trialing" || status === "past_due") return 2;
  return 0;
};

const subscriptionRecency = (subscription: ResolvableChurchSubscription): number =>
  subscription.periodStart == null
    ? Math.max(
        ...[
          subscription.periodEnd,
          subscription.trialStart,
          subscription.trialEnd,
          subscription.cancelAt,
          subscription.canceledAt,
          subscription.endedAt,
        ].map((value) => (value == null ? Number.NEGATIVE_INFINITY : epoch(value))),
      )
    : epoch(subscription.periodStart);

/**
 * Selects the one webhook-owned Church Subscription used throughout the app.
 * Paying and recoverable rows outrank history; dates and id make ties stable.
 */
export function resolveChurchSubscription<T extends ResolvableChurchSubscription>(
  subscriptions: readonly T[],
): T | null {
  let current: T | null = null;

  for (const candidate of subscriptions) {
    // Better Auth can create this row before Stripe confirms Checkout. It is
    // not webhook-owned subscription state and must not become authoritative.
    if (candidate.status === "incomplete") continue;

    if (!current) {
      current = candidate;
      continue;
    }

    const priorityDifference = statusPriority(candidate.status) - statusPriority(current.status);
    const candidateRecency = subscriptionRecency(candidate);
    const currentRecency = subscriptionRecency(current);
    if (
      priorityDifference > 0 ||
      (priorityDifference === 0 && candidateRecency > currentRecency) ||
      (priorityDifference === 0 && candidateRecency === currentRecency && candidate.id > current.id)
    ) {
      current = candidate;
    }
  }

  return current;
}

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
