import { createFileRoute } from "@tanstack/react-router";

import { TeamAvatar } from "@/components/avatars/teamAvatar";
import {
  SettingsBackLink,
  SettingsPage,
  SettingsPageHeader,
} from "@/features/settings/settings-page";
import { TeamGeneralPanel, useTeamById } from "@/features/settings/team-settings";

export const Route = createFileRoute("/_settings/settings/teams/$teamId/general")({
  component: RouteComponent,
});

function RouteComponent() {
  const { teamId } = Route.useParams();
  const { team } = useTeamById(teamId);

  return (
    <SettingsPage>
      <SettingsBackLink params={{ teamId }} to="/settings/teams/$teamId">
        {team ? (
          <span className="flex items-center gap-1.5">
            <TeamAvatar color={team.color} name={team.name} size={16} />
            {team.name}
          </span>
        ) : (
          "Team"
        )}
      </SettingsBackLink>
      <SettingsPageHeader title="General" />
      <TeamGeneralPanel teamId={teamId} />
    </SettingsPage>
  );
}
