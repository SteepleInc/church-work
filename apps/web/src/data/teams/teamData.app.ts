import { recordFromCollection } from "@/data/collection-query-state";
import { useTeamsCollection } from "@/data/teams/teamsData.app";

export function useTeamData(params: { readonly churchId: string | null; readonly teamId: string }) {
  const teams = useTeamsCollection({ churchId: params.churchId });
  const state = recordFromCollection(teams, (team) => team.id === params.teamId);

  return {
    loading: state.loading,
    teamOpt: state.record,
  };
}
