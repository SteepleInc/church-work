import { createFileRoute } from "@tanstack/react-router";

import { SettingsFrame, SettingsProfilePanel } from "@/routes/-settings";

export const Route = createFileRoute("/_org/settings/profile")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <SettingsFrame>
      <SettingsProfilePanel />
    </SettingsFrame>
  );
}
