import { queries, mutators } from "@church-work/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";
import { useEffect } from "react";

export type OnboardingTeamCollectionItem = {
  readonly id: string;
  readonly name: string;
  readonly identifier: string;
  readonly color: string;
  readonly sortOrder: number;
};

export function useOnboardingTeamsCollection(params: { readonly churchId: string }) {
  const [rows, result] = useQuery(queries.teams.by_church({ church_id: params.churchId }));

  // Debug logging for the onboarding session-context race: `resultType`
  // distinguishes "query complete and genuinely empty" (a server-side
  // authorization miss) from "still syncing" (client waiting on zero-cache).
  useEffect(() => {
    console.info("[church-work] onboarding teams query", {
      churchId: params.churchId,
      resultType: result.type,
      teamCount: rows.length,
    });
  }, [params.churchId, result.type, rows.length]);
  const teamsCollection = rows.map((team) => ({
    color: team.color,
    id: team.id,
    identifier: team.identifier,
    name: team.name,
    sortOrder: team.sort_order,
  }));

  return {
    collection: teamsCollection,
    loading: false,
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
