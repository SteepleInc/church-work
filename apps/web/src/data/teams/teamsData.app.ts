import { api } from "@church-task/backend/convex/_generated/api";
import type { Team, TeamMembership } from "@church-task/domain";
import { useMutation, useQuery } from "convex/react";

import { successfulResponseCollection } from "@/data/convex-query-adapter";

export type TeamCollectionItem = Pick<Team, "id" | "name" | "defaultWorkflowId" | "sortOrder">;

export type TeamMembershipCollectionItem = Pick<TeamMembership, "id" | "teamId" | "userId">;

export function useTeamsCollection(params: { readonly churchId: string | null }) {
  const result = useQuery(
    api.teams.listForChurch,
    params.churchId ? { churchId: params.churchId } : "skip",
  );
  const state = successfulResponseCollection(result, (response) =>
    "teams" in response.data ? response.data.teams : [],
  );

  return {
    loading: params.churchId !== null && state.loading,
    collection: state.collection as readonly TeamCollectionItem[],
    teamsCollection: state.collection as readonly TeamCollectionItem[],
  };
}

export function useTeamMembershipsCollection(params: { readonly churchId: string | null }) {
  const result = useQuery(
    api.teams.listMembershipsForChurch,
    params.churchId ? { churchId: params.churchId } : "skip",
  );
  const state = successfulResponseCollection(result, (response) =>
    "teamMemberships" in response.data
      ? (response.data.teamMemberships as readonly TeamMembershipCollectionItem[])
      : [],
  );

  return {
    loading: params.churchId !== null && state.loading,
    collection: state.collection,
    teamMembershipsCollection: state.collection,
  };
}

export function useCreateTeamMutation() {
  return useMutation(api.teams.createForChurch);
}

export function useRenameTeamMutation() {
  return useMutation(api.teams.renameForChurch);
}

export function useArchiveTeamMutation() {
  return useMutation(api.teams.archiveForChurch);
}

export function useReorderTeamsMutation() {
  return useMutation(api.teams.reorderForChurch);
}

export function useUpdateTeamProductFieldsMutation() {
  return useMutation(api.teams.updateProductFields);
}

export function useAddTeamMemberMutation() {
  return useMutation(api.teams.addMemberForChurch);
}

export function useRemoveTeamMemberMutation() {
  return useMutation(api.teams.removeMemberForChurch);
}
