import { createFileRoute } from "@tanstack/react-router";

import { SettingsSchedulingPanel } from "@/features/settings/scheduling-settings";
import { SettingsPage, SettingsPageHeader } from "@/features/settings/settings-page";

export const Route = createFileRoute("/_settings/settings/workspace/scheduling")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <SettingsPage>
      <SettingsPageHeader
        description="Control how Church Task turns scheduled Template work into real Tasks."
        title="Scheduling"
      />
      <SettingsSchedulingPanel />
    </SettingsPage>
  );
}
