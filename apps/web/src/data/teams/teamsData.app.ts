import { mutators, queries, type Team, type TeamMembership } from "@church-work/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";

export type TeamCollectionItem = {
  readonly id: string;
  readonly name: string;
  readonly identifier: string;
  readonly previousIdentifiers: readonly string[];
  readonly color: string;
  readonly sortOrder: number;
};

export type TeamMembershipCollectionItem = {
  readonly id: string;
  readonly teamId: string;
  readonly userId: string;
};

type MutationResult = Promise<
  { readonly ok: true } | { readonly ok: false; readonly error: { readonly message: string } }
>;
type ZeroMutationResult = {
  readonly server: Promise<
    | { readonly type: "success" }
    | { readonly type: "error"; readonly error: { readonly message: string } }
  >;
};

const parsePreviousIdentifiers = (value: string): readonly string[] => {
  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

export const mapTeam = (team: Team): TeamCollectionItem => ({
  color: team.color,
  id: team.id,
  identifier: team.identifier,
  name: team.name,
  previousIdentifiers: parsePreviousIdentifiers(team.previous_identifiers ?? "[]"),
  sortOrder: team.sort_order,
});

const mapTeamMembership = (membership: TeamMembership): TeamMembershipCollectionItem => ({
  id: membership.id,
  teamId: membership.team_id,
  userId: membership.user_id,
});

const mutationResult = async (run: () => ZeroMutationResult): MutationResult => {
  try {
    const result = await run().server;

    if (result.type === "error") {
      return { error: { message: result.error.message }, ok: false };
    }

    return { ok: true };
  } catch (error) {
    return {
      error: { message: error instanceof Error ? error.message : "Could not update Teams." },
      ok: false,
    };
  }
};

export function useTeamsCollection(params: { readonly churchId: string | null }) {
  const [rows] = useQuery(
    queries.teams.by_church({ church_id: params.churchId ?? "__no_church__" }),
  );
  const collection = params.churchId === null ? [] : rows.map(mapTeam);

  return {
    collection,
    loading: false,
    teamsCollection: collection,
  };
}

export function useTeamMembershipsCollection(params: { readonly churchId: string | null }) {
  const [rows] = useQuery(
    queries.team_memberships.by_church({ church_id: params.churchId ?? "__no_church__" }),
  );
  const collection = params.churchId === null ? [] : rows.map(mapTeamMembership);

  return {
    collection,
    loading: false,
    teamMembershipsCollection: collection,
  };
}

export function useCreateTeamMutation() {
  const zero = useZero();

  return (params: { readonly name: string }) =>
    mutationResult(() => zero.mutate(mutators.teams.create({ name: params.name })));
}

export function useRenameTeamMutation() {
  const zero = useZero();

  return (params: { readonly name: string; readonly teamId: string }) =>
    mutationResult(() =>
      zero.mutate(
        mutators.teams.rename({
          name: params.name,
          team_id: params.teamId,
        }),
      ),
    );
}

export function useSetTeamIdentifierMutation() {
  const zero = useZero();

  return (params: { readonly identifier: string; readonly teamId: string }) =>
    mutationResult(() =>
      zero.mutate(
        mutators.teams.set_identifier({
          identifier: params.identifier,
          team_id: params.teamId,
        }),
      ),
    );
}

export function useArchiveTeamMutation() {
  return useDeleteTeamMutation();
}

export function useDeleteTeamMutation() {
  const zero = useZero();

  return (params: { readonly teamId: string }) =>
    mutationResult(() => zero.mutate(mutators.teams.delete({ team_id: params.teamId })));
}

export function useReorderTeamsMutation() {
  const zero = useZero();

  return (params: { readonly teamIds: readonly string[] }) =>
    mutationResult(() => zero.mutate(mutators.teams.reorder({ team_ids: [...params.teamIds] })));
}

export function useAddTeamMemberMutation() {
  const zero = useZero();

  return (params: { readonly teamId: string; readonly userId: string }) =>
    mutationResult(() =>
      zero.mutate(
        mutators.teams.add_member({
          team_id: params.teamId,
          user_id: params.userId,
        }),
      ),
    );
}

export function useRemoveTeamMemberMutation() {
  const zero = useZero();

  return (params: { readonly teamId: string; readonly userId: string }) =>
    mutationResult(() =>
      zero.mutate(
        mutators.teams.remove_member({
          team_id: params.teamId,
          user_id: params.userId,
        }),
      ),
    );
}
