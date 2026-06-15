import { createFileRoute } from "@tanstack/react-router";

import { SettingsLabelsPanel } from "@/features/settings/label-settings";
import { SettingsPage, SettingsPageHeader } from "@/features/settings/settings-page";

export const Route = createFileRoute("/_settings/settings/workspace/labels")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <SettingsPage>
      <SettingsPageHeader
        description="Labels categorize Tasks across the Church. Every member can create and manage them."
        title="Labels"
      />
      <SettingsLabelsPanel />
    </SettingsPage>
  );
}
