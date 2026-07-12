import { createFileRoute } from "@tanstack/react-router";

import { ChurchBilling } from "@/features/settings/church-billing";
import { SettingsPage, SettingsPageHeader } from "@/features/settings/settings-page";

export const Route = createFileRoute("/_settings/settings/workspace/billing")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <SettingsPage>
      <SettingsPageHeader description="Manage the plan for your active Church." title="Billing" />
      <ChurchBilling />
    </SettingsPage>
  );
}
