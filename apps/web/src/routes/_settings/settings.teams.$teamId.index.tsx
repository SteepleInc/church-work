import { Settings02Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute } from "@tanstack/react-router";

import { TeamAvatar } from "@/components/avatars/teamAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsLinkRow, SettingsPage, SettingsRowGroup } from "@/features/settings/settings-page";
import { useTeamById } from "@/features/settings/team-settings";

export const Route = createFileRoute("/_settings/settings/teams/$teamId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { teamId } = Route.useParams();
  const { loading, team } = useTeamById(teamId);

  return (
    <SettingsPage>
      <div className="flex items-center gap-3">
        {loading ? (
          <Skeleton className="size-10 rounded-lg" />
        ) : team ? (
          <TeamAvatar color={team.color} name={team.name} size={40} />
        ) : null}
        <div className="flex flex-col gap-1">
          <h1 className="font-semibold text-2xl tracking-tight">{team?.name ?? "Team"}</h1>
          <p className="text-muted-foreground text-sm">Accessible to all Church members</p>
        </div>
      </div>

      <SettingsRowGroup>
        <div className="flex flex-col gap-2">
          <SettingsLinkRow
            description="Name, identifier, and broader Team settings"
            icon={<HugeiconsIcon className="size-4" icon={Settings02Icon} strokeWidth={2} />}
            params={{ teamId }}
            title="General"
            to="/settings/teams/$teamId/general"
          />
          <SettingsLinkRow
            description="Manage Team members"
            icon={<HugeiconsIcon className="size-4" icon={UserGroupIcon} strokeWidth={2} />}
            params={{ teamId }}
            title="Members"
            to="/settings/teams/$teamId/members"
          />
        </div>
      </SettingsRowGroup>
    </SettingsPage>
  );
}
