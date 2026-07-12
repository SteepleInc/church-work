import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { canManageSubscription } from "@/features/billing/billing-helpers";
import { useTaskUsagePolicy } from "@/features/billing/use-task-usage-policy";
import { cn } from "@/lib/utils";

const BILLING_PATH = "/settings/workspace/billing";

/**
 * The Free Plan Task Usage card, shown to every Church Member of a Free
 * Church once usage passes 200 counted Tasks in the Active Planning Horizon —
 * including actual overage above 300 from scheduled Template materialization.
 * Amber while approaching the limit, destructive at or over it. Owners and
 * admins get a View Billing action; members see the card without one
 * (mirrors PastDueBanner's role split). Paid Churches never see it.
 */
export function TaskUsageCard() {
  const policy = useTaskUsagePolicy();
  if (!policy.church || !policy.showUsage) return null;

  const canManage = canManageSubscription(policy.church.role);
  const atLimit = policy.blocked;
  const percent = Math.min(100, Math.round((policy.usage / policy.limit) * 100));

  return (
    <aside
      aria-label="Task Usage"
      className={cn(
        "mx-4 mb-2 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3.5 py-2.5 text-sm",
        atLimit ? "border-destructive/20 bg-destructive/5" : "border-amber-500/20 bg-amber-500/10",
      )}
      role="status"
    >
      <HugeiconsIcon
        className={cn(
          "size-4 shrink-0",
          atLimit ? "text-destructive" : "text-amber-600 dark:text-amber-500",
        )}
        icon={Alert02Icon}
        strokeWidth={2}
      />
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1.5">
        <p className="min-w-0 leading-snug">
          <span className="font-medium">
            Task Usage:{" "}
            <span className={cn("tabular-nums", atLimit && "text-destructive")}>
              {policy.usage} of {policy.limit}
            </span>
            .
          </span>{" "}
          <span className="text-muted-foreground">
            {atLimit
              ? canManage
                ? "Task creation is paused — upgrade to Paid in Church Billing to create more. Existing and scheduled work stays available."
                : "Task creation is paused — a Church owner or admin can upgrade to Paid. Existing and scheduled work stays available."
              : "Free Plan Tasks in the Active Planning Horizon."}
          </span>
        </p>
        <div
          aria-label="Free Plan Task Usage"
          aria-valuemax={policy.limit}
          aria-valuemin={0}
          aria-valuenow={policy.usage}
          className="h-1 w-full max-w-72 overflow-hidden rounded-full bg-foreground/10"
          role="meter"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              atLimit ? "bg-destructive" : "bg-amber-500",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      {canManage ? (
        <Button asChild className="shrink-0" size="xs" variant="outline">
          <Link to={BILLING_PATH}>View Billing</Link>
        </Button>
      ) : null}
    </aside>
  );
}
