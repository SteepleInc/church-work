import {
  CheckmarkCircle02Icon,
  CreditCardIcon,
  InformationCircleIcon,
  Tick02Icon,
  Time04Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Subscription } from "@church-work/zero";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useChurchSubscription } from "@/data/subscriptions/subscriptionData.app";
import { useCurrentOrgOpt, type CurrentOrg } from "@/data/orgs/orgData.app";
import { SettingsSection } from "@/features/settings/settings-page";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

/** Webhook statuses that keep Paid Plan access, including the Payment Grace Period. */
const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

const PAID_PRICE = "$19.99";
const PAID_PRICE_NOTE = "USD per Church per week, tax inclusive";

function canManageSubscription(role: string): boolean {
  return role === "owner" || role === "admin";
}

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

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
    return `Paid access ends ${formatDate(periodEnd)}, then this Church returns to the Free Plan.`;
  }

  return `Renews ${formatDate(periodEnd)}.`;
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
  const isPaid = Boolean(subscriptionOpt && PAID_STATUSES.has(subscriptionOpt.status ?? ""));
  const isPastDue = isPaid && subscriptionOpt?.status === "past_due";
  const hasStripeCustomer = Boolean(subscriptionOpt?.stripeCustomerId);
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
        <Alert variant="destructive">
          <HugeiconsIcon icon={CreditCardIcon} strokeWidth={2} />
          <AlertTitle>Payment past due</AlertTitle>
          <AlertDescription>
            The latest payment for the Paid Plan didn't go through. Paid access continues during the
            two-week Payment Grace Period
            {canManage
              ? " — update the payment method in Manage billing to keep it."
              : ". A Church owner or admin can update the payment method from this page."}
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
                {!isPaid ? upgradeButton : null}
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
            action={canManage && !isPaid ? upgradeButton : null}
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
