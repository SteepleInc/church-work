import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { hasPaidEntitlements, paymentGraceEndsAt } from "@church-work/domain";
import { Link, useLocation } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { useChurchSubscription } from "@/data/subscriptions/subscriptionData.app";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { canManageSubscription, formatBillingDate } from "@/features/billing/billing-helpers";
import { cn } from "@/lib/utils";

const BILLING_PATH = "/settings/workspace/billing";

/**
 * App-wide past-due warning for the Payment Grace Period. Every Church Member
 * sees the warning with the date unlimited access ends; only owners and
 * admins get the Fix payment action into Billing — members never see payment
 * details. Renders nothing while the shell is optimistic (ADR 0010) or when
 * the Church Subscription is not past due.
 */
export function PastDueBanner() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { currentOrgOpt } = useCurrentOrgOpt();
  const { subscriptionOpt } = useChurchSubscription({ churchId: currentOrgOpt?.id ?? null });

  if (!currentOrgOpt || subscriptionOpt?.status !== "past_due") {
    return null;
  }

  // The Billing screen renders its own, richer recovery panel.
  if (pathname === BILLING_PATH) {
    return null;
  }

  const canManage = canManageSubscription(currentOrgOpt.role);
  const graceEndsAt = paymentGraceEndsAt(subscriptionOpt);
  const graceActive = hasPaidEntitlements(subscriptionOpt);

  // Better Auth persists the status before invoking the lifecycle callback.
  // Avoid briefly claiming that access has expired while the stable grace
  // timestamp is still being written and streamed back through Zero.
  if (graceEndsAt === null) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex min-h-9 shrink-0 items-center gap-2.5 border-b px-4 py-1.5 text-sm",
        graceActive
          ? "border-amber-500/20 bg-amber-500/10"
          : "border-destructive/20 bg-destructive/5",
      )}
      role={graceActive ? "status" : "alert"}
    >
      <HugeiconsIcon
        className={cn(
          "size-4 shrink-0",
          graceActive ? "text-amber-600 dark:text-amber-500" : "text-destructive",
        )}
        icon={Alert02Icon}
        strokeWidth={2}
      />
      <p className="min-w-0 flex-1 leading-snug">
        {graceActive ? (
          <>
            <span className="font-medium">Payment past due.</span>{" "}
            <span className="text-muted-foreground">
              Unlimited access for this Church ends {formatBillingDate(graceEndsAt)}.
              {canManage ? "" : " A Church owner or admin can fix payment."}
            </span>
          </>
        ) : (
          <>
            <span className="font-medium">Free Plan limits apply.</span>{" "}
            <span className="text-muted-foreground">
              Payment wasn't recovered during the Payment Grace Period. Existing work is untouched.
              {canManage ? "" : " A Church owner or admin can restore the Paid Plan."}
            </span>
          </>
        )}
      </p>
      {canManage ? (
        <Button asChild className="shrink-0" size="xs" variant="outline">
          <Link to={BILLING_PATH}>Fix payment</Link>
        </Button>
      ) : null}
    </div>
  );
}
