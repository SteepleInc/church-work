import { queries } from "@church-work/zero";
import { useQuery } from "@rocicorp/zero/react";

import { recordFromQueryResult } from "@/data/collection-query-state";
import { mapTeam } from "@/data/teams/teamsData.app";

/**
 * Resolves a single Team by id through its own `teams.by_id` subscription, so a
 * component that renders one Team looks up exactly that Team rather than
 * scanning the church-wide Teams collection. Zero dedupes identical
 * subscriptions, so many components asking for the same Team share one query.
 */
export function useTeamData(params: { readonly churchId: string | null; readonly teamId: string }) {
  const [row] = useQuery(
    queries.teams.by_id({
      church_id: params.churchId ?? "__no_church__",
      id: params.teamId,
    }),
    { enabled: params.churchId !== null },
  );
  const state = recordFromQueryResult(row ?? null);

  return {
    loading: state.loading,
    teamOpt: state.record === null ? null : mapTeam(state.record),
  };
}

/**
 * Resolves a single Team's current name by id, for per-row lookups (e.g. naming
 * the destination Team of an Activity Feed team-change line). Returns `null`
 * while loading or when the Team is gone, so callers can fall back to a snapshot
 * label.
 */
export function useTeamName(params: {
  readonly churchId: string | null;
  readonly teamId: string | null;
}): string | null {
  const { teamOpt } = useTeamData({
    churchId: params.teamId === null ? null : params.churchId,
    teamId: params.teamId ?? "__no_team__",
  });

  return teamOpt?.name ?? null;
}
