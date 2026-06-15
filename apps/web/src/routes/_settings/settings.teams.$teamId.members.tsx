import { createFileRoute } from "@tanstack/react-router";

import { TeamAvatar } from "@/components/avatars/teamAvatar";
import {
  SettingsBackLink,
  SettingsPage,
  SettingsPageHeader,
} from "@/features/settings/settings-page";
import { TeamMembersPanel, useTeamById } from "@/features/settings/team-settings";

export const Route = createFileRoute("/_settings/settings/teams/$teamId/members")({
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
      <SettingsPageHeader description="Manage who belongs to this Team." title="Members" />
      <TeamMembersPanel teamId={teamId} />
    </SettingsPage>
  );
}
