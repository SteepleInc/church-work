import { createFileRoute } from "@tanstack/react-router";

import { SettingsChurchPanel, SettingsFrame } from "@/routes/-settings";

export const Route = createFileRoute("/_org/settings/org")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <SettingsFrame>
      <SettingsChurchPanel />
    </SettingsFrame>
  );
}
