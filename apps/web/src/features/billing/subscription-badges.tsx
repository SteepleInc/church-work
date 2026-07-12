import { Badge } from "@/components/ui/badge";

/** "past_due" → "Past due", matching Stripe status spellings in support UI. */
export function formatSubscriptionStatus(status: string | null) {
  if (!status) return "No subscription";
  return status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

/**
 * Read-only plan pill for App Administration support surfaces. Paid gets a
 * primary tint so it stands out while scanning; Free stays a quiet outline —
 * Free is the default plan, not an alarm state.
 */
export function ChurchPlanBadge({ plan }: { readonly plan: "Free" | "Paid" }) {
  if (plan === "Paid") {
    return (
      <Badge className="bg-primary/10 text-primary" variant="secondary">
        Paid
      </Badge>
    );
  }

  return <Badge variant="outline">Free</Badge>;
}

/**
 * Stripe subscription lifecycle pill mirroring the Church Billing settings
 * badge tones: emerald for healthy Active, destructive for payment trouble,
 * quiet outline for scheduled cancellation and terminal states. Churches
 * without a subscription read as muted text — absence is normal, not an
 * empty-state error.
 */
export function SubscriptionStatusBadge({
  status,
  cancelAtPeriodEnd = false,
}: {
  readonly status: string | null;
  readonly cancelAtPeriodEnd?: boolean;
}) {
  if (!status) {
    return <span className="text-muted-foreground">No subscription</span>;
  }

  if (status === "past_due" || status === "unpaid") {
    return <Badge variant="destructive">{formatSubscriptionStatus(status)}</Badge>;
  }

  if (status === "active" && cancelAtPeriodEnd) {
    return <Badge variant="outline">Cancels at period end</Badge>;
  }

  if (status === "active") {
    return (
      <Badge
        className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
        variant="secondary"
      >
        Active
      </Badge>
    );
  }

  return <Badge variant="outline">{formatSubscriptionStatus(status)}</Badge>;
}
