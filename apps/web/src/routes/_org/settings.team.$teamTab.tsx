import { createFileRoute } from "@tanstack/react-router";

import { SettingsFrame, SettingsTeamTabPanel } from "@/routes/-settings";

export const Route = createFileRoute("/_org/settings/team/$teamTab")({
  component: RouteComponent,
});

function RouteComponent() {
  const { teamTab } = Route.useParams();

  return (
    <SettingsFrame activeSection={teamTab === "invites" ? "invites" : "members"}>
      <SettingsTeamTabPanel teamTab={teamTab} />
    </SettingsFrame>
  );
}
