import { createFileRoute } from "@tanstack/react-router";

import { ChurchBilling } from "@/features/settings/church-billing";
import { SettingsPage, SettingsPageHeader } from "@/features/settings/settings-page";

export const Route = createFileRoute("/_settings/settings/workspace/billing")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): { readonly checkout?: "complete" } =>
    search.checkout === "complete" ? { checkout: "complete" } : {},
});

function RouteComponent() {
  const { checkout } = Route.useSearch();

  return (
    <SettingsPage>
      <SettingsPageHeader
        description="Manage the Church Subscription for your active Church."
        title="Billing"
      />
      <ChurchBilling checkoutComplete={checkout === "complete"} />
    </SettingsPage>
  );
}
