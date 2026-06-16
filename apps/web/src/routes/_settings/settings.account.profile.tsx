import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage, SettingsPageHeader } from "@/features/settings/settings-page";
import { SettingsProfilePanel } from "@/routes/-settings";

export const Route = createFileRoute("/_settings/settings/account/profile")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <SettingsPage>
      <SettingsPageHeader title="Profile" />
      <SettingsProfilePanel />
    </SettingsPage>
  );
}
