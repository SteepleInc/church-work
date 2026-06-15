import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage, SettingsPageHeader } from "@/features/settings/settings-page";
import { SettingsProfilePanel } from "@/routes/-settings";

export const Route = createFileRoute("/_settings/settings/account/profile")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <SettingsPage>
      <SettingsPageHeader description="Manage your Church Task account details." title="Profile" />
      <SettingsProfilePanel />
    </SettingsPage>
  );
}
