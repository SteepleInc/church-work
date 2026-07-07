import { queries, mutators } from "@church-work/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";

export type OnboardingTeamCollectionItem = {
  readonly id: string;
  readonly name: string;
  readonly identifier: string;
  readonly color: string;
  readonly sortOrder: number;
};

export function useOnboardingTeamsCollection(params: { readonly churchId: string }) {
  const [rows, result] = useQuery(queries.teams.by_church({ church_id: params.churchId }));
  const teamsCollection = rows.map((team) => ({
    color: team.color,
    id: team.id,
    identifier: team.identifier,
    name: team.name,
    sortOrder: team.sort_order,
  }));

  return {
    collection: teamsCollection,
    // Zero reports "unknown" until the server result has fully synced; an
    // empty list before that is "still loading", not "no teams".
    loading: result.type !== "complete",
    teamsCollection,
  };
}

export function useDeleteOnboardingTeamMutation() {
  const zero = useZero();

  return async (params: { readonly churchId: string; readonly teamId: string }) => {
    await zero.mutate(
      mutators.teams.delete({
        church_id: params.churchId,
        team_id: params.teamId,
      }),
    );

    return { ok: true } as const;
  };
}
