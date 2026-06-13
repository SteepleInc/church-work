import { createFileRoute } from "@tanstack/react-router";

import { SettingsLabelsPanel } from "@/features/settings/label-settings";
import { SettingsFrame } from "@/routes/-settings";

export const Route = createFileRoute("/_org/settings/labels")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <SettingsFrame>
      <SettingsLabelsPanel />
    </SettingsFrame>
  );
}
