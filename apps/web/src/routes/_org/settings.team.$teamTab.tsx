import { createFileRoute } from "@tanstack/react-router";

import { SettingsTeamTabPanel } from "@/routes/-settings";

export const Route = createFileRoute("/_org/settings/team/$teamTab")({
  component: RouteComponent,
});

function RouteComponent() {
  const { teamTab } = Route.useParams();

  return <SettingsTeamTabPanel teamTab={teamTab} />;
}
