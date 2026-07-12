import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Tick02Icon,
  Time04Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Subscription } from "@church-work/zero";
import { hasPaidEntitlements, paymentGraceEndsAt } from "@church-work/domain";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useChurchSubscription } from "@/data/subscriptions/subscriptionData.app";
import { useCurrentOrgOpt, type CurrentOrg } from "@/data/orgs/orgData.app";
import {
  canManageSubscription,
  formatBillingDate,
  graceDaysLeft,
} from "@/features/billing/billing-helpers";
import { SettingsSection } from "@/features/settings/settings-page";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const PAID_PRICE = "$19.99";
const PAID_PRICE_NOTE = "USD per Church per week, tax inclusive";

function getRenewalLine({
  cancelAtPeriodEnd,
  isPaid,
  periodEnd,
}: {
  readonly cancelAtPeriodEnd: boolean;
  readonly isPaid: boolean;
  readonly periodEnd: number | null;
}): string | null {
  if (!isPaid || !periodEnd) {
    return null;
  }

  if (cancelAtPeriodEnd) {
    return `Paid access ends ${formatBillingDate(periodEnd)}, then this Church returns to the Free Plan.`;
  }

  return `Renews ${formatBillingDate(periodEnd)}.`;
}

export function ChurchBilling({
  checkoutComplete = false,
}: {
  readonly checkoutComplete?: boolean;
}) {
  const { currentOrgOpt: activeChurch, loading } = useCurrentOrgOpt();

  if (loading) {
    return <BillingSkeleton />;
  }

  if (!activeChurch) {
    return <p className="text-muted-foreground text-sm">No active Church selected.</p>;
  }

  return <BillingPanel activeChurch={activeChurch} checkoutComplete={checkoutComplete} />;
}

function BillingPanel({
  activeChurch,
  checkoutComplete,
}: {
  readonly activeChurch: CurrentOrg;
  readonly checkoutComplete: boolean;
}) {
  const { loading, subscriptionOpt } = useChurchSubscription({ churchId: activeChurch.id });
  const [redirecting, setRedirecting] = useState<"checkout" | "portal" | null>(null);

  if (loading) {
    return <BillingSkeleton />;
  }

  const canManage = canManageSubscription(activeChurch.role);
  const isPaid = hasPaidEntitlements(subscriptionOpt ?? null);
  const isPastDue = subscriptionOpt?.status === "past_due";
  const graceEndsAt = subscriptionOpt ? paymentGraceEndsAt(subscriptionOpt) : null;
  const hasStripeCustomer = Boolean(subscriptionOpt?.stripeCustomerId);
  const cancelScheduledFor =
    isPaid && !isPastDue && subscriptionOpt?.cancelAtPeriodEnd && subscriptionOpt.periodEnd
      ? subscriptionOpt.periodEnd
      : null;
  // A past-due Church Subscription recovers through the Customer Portal, not a
  // fresh Checkout — never offer Upgrade while payment recovery is pending.
  const canUpgrade = canManage && !isPaid && !isPastDue;
  const billingUrl = `${window.location.origin}/settings/workspace/billing`;

  const startCheckout = async () => {
    setRedirecting("checkout");
    const result = await authClient.subscription.upgrade({
      cancelUrl: billingUrl,
      customerType: "organization",
      plan: "paid",
      referenceId: activeChurch.id,
      successUrl: `${billingUrl}?checkout=complete`,
    });

    if (result.error) {
      setRedirecting(null);
      toast.error(result.error.message ?? "Could not start Checkout. Please try again.");
    }
  };

  const openPortal = async () => {
    setRedirecting("portal");
    const result = await authClient.subscription.billingPortal({
      customerType: "organization",
      referenceId: activeChurch.id,
      returnUrl: billingUrl,
    });

    if (result.error) {
      setRedirecting(null);
      toast.error(result.error.message ?? "Could not open the Customer Portal. Please try again.");
    }
  };

  const upgradeButton = (
    <Button
      disabled={redirecting === "portal"}
      loading={redirecting === "checkout"}
      onClick={() => void startCheckout()}
      type="button"
    >
      Upgrade to Paid
    </Button>
  );

  const portalButton = (
    <Button
      disabled={redirecting === "checkout"}
      loading={redirecting === "portal"}
      onClick={() => void openPortal()}
      type="button"
      variant={isPaid ? "default" : "outline"}
    >
      Manage billing
    </Button>
  );

  return (
    <>
      {checkoutComplete && !isPaid ? (
        <Alert>
          <HugeiconsIcon
            className="text-amber-600 dark:text-amber-500"
            icon={Time04Icon}
            strokeWidth={2}
          />
          <AlertTitle>Checkout complete — Paid activation pending</AlertTitle>
          <AlertDescription>
            Stripe is still confirming the payment, so this Church Subscription stays on the Free
            Plan until webhook state synchronizes. This page updates automatically once the Paid
            Plan is active.
          </AlertDescription>
        </Alert>
      ) : null}

      {checkoutComplete && isPaid ? (
        <Alert>
          <HugeiconsIcon
            className="text-emerald-600 dark:text-emerald-400"
            icon={CheckmarkCircle02Icon}
            strokeWidth={2}
          />
          <AlertTitle>Paid Plan active</AlertTitle>
          <AlertDescription>
            Checkout is complete and this Church Subscription is now on the Paid Plan.
          </AlertDescription>
        </Alert>
      ) : null}

      {isPastDue ? (
        <PastDueAlert
          canManage={canManage}
          fixPayment={
            canManage && hasStripeCustomer ? (
              <div className="col-start-2 mt-2 flex">
                <Button
                  disabled={redirecting === "checkout"}
                  loading={redirecting === "portal"}
                  onClick={() => void openPortal()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Fix payment
                </Button>
              </div>
            ) : null
          }
          graceActive={isPaid}
          graceEndsAt={graceEndsAt}
        />
      ) : null}

      {cancelScheduledFor !== null ? (
        <Alert>
          <HugeiconsIcon
            className="text-amber-600 dark:text-amber-500"
            icon={Time04Icon}
            strokeWidth={2}
          />
          <AlertTitle>
            Cancellation scheduled — Paid access ends {formatBillingDate(cancelScheduledFor)}
          </AlertTitle>
          <AlertDescription>
            This Church keeps Paid access through the purchased period, then returns to the Free
            Plan. Nothing is deleted or hidden — Free Plan limits apply based on Task Usage at that
            point.
            {canManage
              ? " Changed your mind? Resume the subscription in the Customer Portal through Manage billing."
              : ""}
          </AlertDescription>
        </Alert>
      ) : null}

      <SettingsSection
        card
        description="Each Church is subscribed independently, even when someone belongs to multiple Churches."
        title="Current plan"
      >
        <CurrentPlanRow
          actions={
            canManage ? (
              <>
                {hasStripeCustomer ? portalButton : null}
                {canUpgrade ? upgradeButton : null}
              </>
            ) : null
          }
          isPaid={isPaid}
          subscriptionOpt={subscriptionOpt}
        />
      </SettingsSection>

      <SettingsSection
        description="Every Church starts on the Free Plan — no card required, no trial to expire."
        title="Plans"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <PlanCard
            current={!isPaid}
            features={[
              "Unlimited Users and Teams",
              "Up to 300 Tasks in the Active Planning Horizon",
              "No payment details required",
            ]}
            name="Free Plan"
            price="$0"
            priceNote="forever"
          />
          <PlanCard
            action={canUpgrade ? upgradeButton : null}
            current={isPaid}
            features={[
              "Unlimited Users and Teams",
              "Unlimited Tasks — no Task limit",
              "Managed through Stripe Checkout and the Customer Portal",
            ]}
            name="Paid Plan"
            price={PAID_PRICE}
            priceNote={PAID_PRICE_NOTE}
          />
        </div>
      </SettingsSection>

      {canManage ? (
        hasStripeCustomer ? (
          <Alert>
            <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
            <AlertDescription>
              Payment method, invoices, and cancellation are handled in the Stripe Customer Portal
              through Manage billing. Plan changes take effect here once Stripe confirms them.
            </AlertDescription>
          </Alert>
        ) : null
      ) : (
        <Alert>
          <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
          <AlertDescription>
            Only Church owners and admins can manage the Church Subscription. Members can see the
            plan and its limits, but not payment details.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}

/**
 * Role-aware Payment Grace Period panel. During grace the tone is a warning —
 * Paid access continues and the deadline is the headline. After grace expires
 * it turns destructive: Free Plan limits apply, but nothing is lost. Members
 * see the same dates without any payment action or billing details.
 */
function PastDueAlert({
  canManage,
  fixPayment,
  graceActive,
  graceEndsAt,
}: {
  readonly canManage: boolean;
  readonly fixPayment: ReactNode;
  readonly graceActive: boolean;
  readonly graceEndsAt: number | null;
}) {
  if (graceActive && graceEndsAt !== null) {
    const daysLeft = graceDaysLeft(graceEndsAt);

    return (
      <Alert className="border-amber-500/30 dark:border-amber-500/25">
        <HugeiconsIcon
          className="text-amber-600 dark:text-amber-500"
          icon={Alert02Icon}
          strokeWidth={2}
        />
        <AlertTitle>
          Payment past due — unlimited access ends {formatBillingDate(graceEndsAt)}
        </AlertTitle>
        <AlertDescription>
          The latest Paid Plan payment didn't go through, so the two-week Payment Grace Period is
          running{daysLeft > 0 ? ` (${daysLeft} ${daysLeft === 1 ? "day" : "days"} left)` : ""}.
          Paid access continues until then.{" "}
          {canManage
            ? "Fix payment in the Customer Portal — unlimited access is restored the moment Stripe confirms recovery."
            : "A Church owner or admin can fix payment to keep unlimited access."}
        </AlertDescription>
        {fixPayment}
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
      <AlertTitle>Payment Grace Period ended — Free Plan limits apply</AlertTitle>
      <AlertDescription>
        Payment wasn't recovered during the two-week Payment Grace Period, so this Church now
        follows Free Plan limits. Nothing was deleted or hidden — every Task stays right where it
        is.{" "}
        {canManage
          ? "Fix payment to restore unlimited access immediately."
          : "A Church owner or admin can fix payment to restore the Paid Plan."}
      </AlertDescription>
      {fixPayment}
    </Alert>
  );
}

function CurrentPlanRow({
  isPaid,
  subscriptionOpt,
  actions,
}: {
  readonly isPaid: boolean;
  readonly subscriptionOpt: Subscription | null;
  readonly actions: ReactNode;
}) {
  const status = subscriptionOpt?.status ?? null;
  const cancelAtPeriodEnd = Boolean(subscriptionOpt?.cancelAtPeriodEnd);
  const periodEnd = subscriptionOpt?.periodEnd ?? null;

  const renewalLine = getRenewalLine({ cancelAtPeriodEnd, isPaid, periodEnd });

  return (
    <div className="flex flex-col justify-between gap-4 py-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{isPaid ? "Paid Plan" : "Free Plan"}</span>
          <PlanStatusBadge cancelAtPeriodEnd={cancelAtPeriodEnd} isPaid={isPaid} status={status} />
        </div>
        <p className="text-muted-foreground text-sm">
          {isPaid
            ? `${PAID_PRICE} ${PAID_PRICE_NOTE} · Unlimited usage`
            : "$0 · Unlimited Users and Teams, up to 300 Tasks in the Active Planning Horizon"}
        </p>
        {renewalLine ? <p className="text-muted-foreground text-xs">{renewalLine}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function PlanStatusBadge({
  isPaid,
  status,
  cancelAtPeriodEnd,
}: {
  readonly isPaid: boolean;
  readonly status: string | null;
  readonly cancelAtPeriodEnd: boolean;
}) {
  if (!isPaid) {
    return <Badge variant="outline">Current plan</Badge>;
  }

  if (status === "past_due") {
    return <Badge variant="destructive">Past due</Badge>;
  }

  if (cancelAtPeriodEnd) {
    return <Badge variant="outline">Cancels at period end</Badge>;
  }

  return (
    <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" variant="secondary">
      Active
    </Badge>
  );
}

function PlanCard({
  name,
  price,
  priceNote,
  features,
  current,
  action,
}: {
  readonly name: string;
  readonly price: string;
  readonly priceNote: string;
  readonly features: readonly string[];
  readonly current: boolean;
  readonly action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-4",
        current ? "border-primary/40" : "border-border/70",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm">{name}</span>
        {current ? <Badge variant="secondary">Current</Badge> : null}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <span className="font-semibold text-xl tracking-tight">{price}</span>
        <span className="text-muted-foreground text-xs">{priceNote}</span>
      </div>
      <ul className="flex flex-1 flex-col gap-1.5">
        {features.map((feature) => (
          <li className="flex items-start gap-1.5 text-muted-foreground text-sm" key={feature}>
            <HugeiconsIcon
              className="mt-0.5 size-3.5 shrink-0 text-foreground/60"
              icon={Tick02Icon}
              strokeWidth={2}
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

function BillingSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-1 px-0.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-72" />
        </div>
        <div className="rounded-lg border border-border/70 bg-card px-5">
          <div className="flex items-center justify-between gap-6 py-4">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="px-0.5">
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    </>
  );
}
