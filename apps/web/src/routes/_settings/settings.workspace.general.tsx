import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage, SettingsPageHeader } from "@/features/settings/settings-page";
import { SettingsChurchPanel } from "@/routes/-settings";

export const Route = createFileRoute("/_settings/settings/workspace/general")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <SettingsPage>
      <SettingsPageHeader title="Workspace" />
      <SettingsChurchPanel />
    </SettingsPage>
  );
}
