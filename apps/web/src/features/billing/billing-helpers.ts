const DAY_MS = 24 * 60 * 60 * 1000;

/** Owners and admins manage the Church Subscription; members only view it. */
export function canManageSubscription(role: string): boolean {
  return role === "owner" || role === "admin";
}

export function formatBillingDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
    year: "numeric",
  });
}

/** Whole days left before the Payment Grace Period ends, never negative. */
export function graceDaysLeft(graceEndsAt: number, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((graceEndsAt - now) / DAY_MS));
}
