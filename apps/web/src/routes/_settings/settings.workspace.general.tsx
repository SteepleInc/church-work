import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage, SettingsPageHeader } from "@/features/settings/settings-page";
import { SettingsChurchPanel } from "@/routes/-settings";

export const Route = createFileRoute("/_settings/settings/workspace/general")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <SettingsPage>
      <SettingsPageHeader
        description="Manage the Church details used across onboarding, invitations, and Cycle boundaries."
        title="Workspace"
      />
      <SettingsChurchPanel />
    </SettingsPage>
  );
}
