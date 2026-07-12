import { queries } from "@church-work/zero";
import { useQuery } from "@rocicorp/zero/react";
import { useSearch } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { authClient } from "@/lib/auth-client";
import { SettingsSection } from "@/features/settings/settings-page";

const paidStatuses = new Set(["active", "trialing", "past_due"]);

export function ChurchBilling() {
  const { currentOrgOpt } = useCurrentOrgOpt();
  const [subscription] = useQuery(
    queries.subscription.by_church({ church_id: currentOrgOpt?.id ?? "__no_church__" }),
  );
  const search = useSearch({ strict: false }) as { checkout?: string };
  const canManage = currentOrgOpt?.role === "owner" || currentOrgOpt?.role === "admin";
  const isPaid = Boolean(subscription && paidStatuses.has(subscription.status ?? ""));

  const startCheckout = async () => {
    if (!currentOrgOpt || !canManage) return;
    const billingUrl = `${window.location.origin}/settings/workspace/billing`;
    await authClient.subscription.upgrade({
      cancelUrl: billingUrl,
      customerType: "organization",
      plan: "paid",
      referenceId: currentOrgOpt.id,
      successUrl: `${billingUrl}?checkout=complete`,
    });
  };
  const openPortal = async () => {
    if (!currentOrgOpt || !canManage) return;
    const billingUrl = `${window.location.origin}/settings/workspace/billing`;
    await authClient.subscription.billingPortal({
      customerType: "organization",
      referenceId: currentOrgOpt.id,
      returnUrl: billingUrl,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {search.checkout === "complete" && !isPaid ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 text-sm">
          Checkout is complete. Paid activation may still be pending while Stripe’s webhook
          synchronizes.
        </div>
      ) : null}
      <SettingsSection card title="Current plan">
        <div className="flex items-center justify-between gap-4 p-4">
          <div>
            <div className="font-medium">{isPaid ? "Paid Plan" : "Free Plan"}</div>
            <p className="text-muted-foreground text-sm">
              {isPaid
                ? "$19.99 USD per week, tax inclusive · Unlimited usage"
                : "$0 · No card required"}
            </p>
          </div>
          {canManage ? (
            subscription?.stripeCustomerId ? (
              <Button onClick={openPortal}>Manage billing</Button>
            ) : (
              <Button onClick={startCheckout}>Upgrade to Paid</Button>
            )
          ) : null}
        </div>
      </SettingsSection>
    </div>
  );
}
