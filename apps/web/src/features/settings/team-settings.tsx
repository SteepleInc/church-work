import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrgOpt, type CurrentOrg } from "@/data/orgs/orgData.app";
import {
  useAddTeamMemberMutation,
  useArchiveTeamMutation,
  useRemoveTeamMemberMutation,
  useRenameTeamMutation,
  useSetTeamIdentifierMutation,
  useTeamMembershipsCollection,
  useTeamsCollection,
  type TeamCollectionItem,
} from "@/data/teams/teamsData.app";
import { getUserDisplayName, useChurchUsersCollection } from "@/data/users/usersData.app";

function canManageTeams(role: string | readonly string[]) {
  return Array.isArray(role)
    ? role.includes("owner") || role.includes("admin")
    : role === "owner" || role === "admin";
}

/** Resolve a single Team within the Active Church by its id. */
export function useTeamById(teamId: string) {
  const { currentOrgOpt: activeChurch, loading: orgLoading } = useCurrentOrgOpt();
  const teams = useTeamsCollection({ churchId: activeChurch?.id ?? null });
  const team = teams.teamsCollection.find((candidate) => candidate.id === teamId) ?? null;

  return {
    activeChurch,
    loading: orgLoading || teams.loading,
    team,
  };
}

export function TeamGeneralPanel({ teamId }: { readonly teamId: string }) {
  const { activeChurch, loading, team } = useTeamById(teamId);

  if (loading) {
    return <Skeleton className="h-9 w-full max-w-md" />;
  }

  if (!activeChurch || !team) {
    return <p className="text-muted-foreground text-sm">Team not found.</p>;
  }

  return <TeamGeneralForm activeChurch={activeChurch} team={team} />;
}

function TeamGeneralForm({
  activeChurch,
  team,
}: {
  readonly activeChurch: CurrentOrg;
  readonly team: TeamCollectionItem;
}) {
  const renameTeam = useRenameTeamMutation();
  const setIdentifier = useSetTeamIdentifierMutation();
  const archiveTeam = useArchiveTeamMutation();
  const canManage = canManageTeams(activeChurch.role);

  const [name, setName] = useState(team.name);
  const [identifier, setIdentifierValue] = useState(team.identifier);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const run = async (
    action: string,
    mutation: () => Promise<{ ok: boolean; error?: { message: string } }>,
    successMessage: string,
  ) => {
    setError(null);
    setPendingAction(action);
    const result = await mutation();
    setPendingAction(null);

    if (!result.ok) {
      setError(result.error?.message ?? "Could not update Team.");
      return;
    }

    toast.success(successMessage);
  };

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!canManage ? (
        <Alert>
          <AlertDescription>Only Church owners and admins can change Teams.</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="team-name">Name</Label>
        <div className="flex items-center gap-2">
          <Input
            className="max-w-md"
            disabled={!canManage || pendingAction === "rename"}
            id="team-name"
            onChange={(event) => setName(event.currentTarget.value)}
            value={name}
          />
          <Button
            disabled={!canManage || !name.trim() || name.trim() === team.name}
            loading={pendingAction === "rename"}
            onClick={() =>
              void run(
                "rename",
                () => renameTeam({ churchId: activeChurch.id, name: name.trim(), teamId: team.id }),
                "Team renamed.",
              )
            }
            type="button"
            variant="outline"
          >
            Save
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="team-identifier">Identifier</Label>
        <p className="text-muted-foreground text-sm">Used in Task IDs.</p>
        <div className="flex items-center gap-2">
          <Input
            className="max-w-xs uppercase"
            disabled={!canManage || pendingAction === "identifier"}
            id="team-identifier"
            onChange={(event) => setIdentifierValue(event.currentTarget.value.toUpperCase())}
            value={identifier}
          />
          <Button
            disabled={
              !canManage ||
              !identifier.trim() ||
              identifier.trim().toUpperCase() === team.identifier
            }
            loading={pendingAction === "identifier"}
            onClick={() =>
              void run(
                "identifier",
                () =>
                  setIdentifier({
                    churchId: activeChurch.id,
                    identifier: identifier.trim().toUpperCase(),
                    teamId: team.id,
                  }),
                "Team identifier updated.",
              )
            }
            type="button"
            variant="outline"
          >
            Save
          </Button>
        </div>
      </div>

      {canManage ? (
        <div className="flex flex-col gap-2 border-destructive/30 border-t pt-6">
          <span className="font-medium text-sm">Archive Team</span>
          <p className="text-muted-foreground text-sm">
            Archiving removes the Team from active work areas.
          </p>
          <Button
            className="w-fit"
            loading={pendingAction === "archive"}
            onClick={() =>
              void run(
                "archive",
                () => archiveTeam({ churchId: activeChurch.id, teamId: team.id }),
                `Archived Team ${team.name}.`,
              )
            }
            type="button"
            variant="destructive"
          >
            Archive {team.name}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function TeamMembersPanel({ teamId }: { readonly teamId: string }) {
  const { currentOrgOpt: activeChurch, loading: orgLoading } = useCurrentOrgOpt();
  const teams = useTeamsCollection({ churchId: activeChurch?.id ?? null });
  const memberships = useTeamMembershipsCollection({ churchId: activeChurch?.id ?? null });
  const members = useChurchUsersCollection({ churchId: activeChurch?.id ?? null });
  const addTeamMember = useAddTeamMemberMutation();
  const removeTeamMember = useRemoveTeamMemberMutation();

  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const team = teams.teamsCollection.find((candidate) => candidate.id === teamId) ?? null;
  const canManage = activeChurch ? canManageTeams(activeChurch.role) : false;

  if (orgLoading || teams.loading || memberships.loading || members.loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((index) => (
          <Skeleton className="h-14 w-full rounded-lg" key={index} />
        ))}
      </div>
    );
  }

  if (!activeChurch || !team) {
    return <p className="text-muted-foreground text-sm">Team not found.</p>;
  }

  const membersById = new Map(members.usersCollection.map((member) => [member.id, member]));
  const teamMemberUserIds = new Set(
    memberships.teamMembershipsCollection
      .filter((membership) => membership.teamId === team.id)
      .map((membership) => membership.userId),
  );
  const teamMembers = members.usersCollection.filter((member) => teamMemberUserIds.has(member.id));
  const availableMembers = members.usersCollection.filter(
    (member) => !teamMemberUserIds.has(member.id),
  );

  const run = async (
    action: string,
    mutation: () => Promise<{ ok: boolean; error?: { message: string } }>,
    successMessage: string,
  ) => {
    setError(null);
    setPendingAction(action);
    const result = await mutation();
    setPendingAction(null);

    if (!result.ok) {
      setError(result.error?.message ?? "Could not update Team Membership.");
      return;
    }

    toast.success(successMessage);
  };

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {canManage ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedUserId) return;
            const member = membersById.get(selectedUserId);
            void run(
              "add",
              () =>
                addTeamMember({
                  churchId: activeChurch.id,
                  teamId: team.id,
                  userId: selectedUserId,
                }),
              `Added ${member ? getUserDisplayName(member) : "member"} to ${team.name}.`,
            ).then(() => setSelectedUserId(""));
          }}
        >
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="add-team-member">Add member</Label>
            <NativeSelect
              disabled={pendingAction === "add" || availableMembers.length === 0}
              id="add-team-member"
              onChange={(event) => setSelectedUserId(event.currentTarget.value)}
              value={selectedUserId}
            >
              <NativeSelectOption value="">
                {availableMembers.length === 0
                  ? "All members are on this Team"
                  : "Select a Church Member"}
              </NativeSelectOption>
              {availableMembers.map((member) => (
                <NativeSelectOption key={member.id} value={member.id}>
                  {getUserDisplayName(member)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <Button disabled={pendingAction === "add" || !selectedUserId} type="submit">
            Add
          </Button>
        </form>
      ) : (
        <p className="text-muted-foreground text-sm">
          Only Church owners and admins can change Team Memberships.
        </p>
      )}

      <ItemGroup className="gap-2">
        {teamMembers.length === 0 ? (
          <p className="text-muted-foreground text-sm">No members on this Team yet.</p>
        ) : (
          teamMembers.map((member) => (
            <Item key={member.id} variant="outline">
              <ItemContent>
                <ItemTitle>{getUserDisplayName(member)}</ItemTitle>
                {member.email ? <ItemDescription>{member.email}</ItemDescription> : null}
              </ItemContent>
              {canManage ? (
                <Button
                  disabled={pendingAction === `remove-${member.id}`}
                  onClick={() =>
                    void run(
                      `remove-${member.id}`,
                      () =>
                        removeTeamMember({
                          churchId: activeChurch.id,
                          teamId: team.id,
                          userId: member.id,
                        }),
                      `Removed ${getUserDisplayName(member)} from ${team.name}.`,
                    )
                  }
                  type="button"
                  variant="outline"
                >
                  Remove
                </Button>
              ) : null}
            </Item>
          ))
        )}
      </ItemGroup>
    </div>
  );
}
