import { api } from "@church-task/backend/convex/_generated/api";
import type { Team, TeamMembership } from "@church-task/domain";
import { useMutation, useQuery } from "convex/react";

import {
  appendItem,
  removeById,
  removeWhere,
  reorderBySortOrder,
  updateById,
} from "@/data/collection-ops";
import { successfulResponseCollection } from "@/data/convex-query-adapter";
import {
  collectionItemOptimisticUpdate,
  collectionListOptimisticUpdate,
} from "@/data/optimistic-collection";

export type TeamCollectionItem = Pick<Team, "id" | "name" | "defaultWorkflowId" | "sortOrder">;

export type TeamMembershipCollectionItem = Pick<TeamMembership, "id" | "teamId" | "userId">;

// Optimistic rows the server will replace with a real id once the mutation
// result syncs. Prefixed so they never collide with real Convex ids.
function optimisticId(prefix: string): string {
  return `optimistic-${prefix}-${Math.random().toString(36).slice(2)}`;
}

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
  return useMutation(api.teams.createForChurch).withOptimisticUpdate(
    collectionListOptimisticUpdate({
      query: api.teams.listForChurch,
      collectionKey: "teams",
      patch: (teams: readonly TeamCollectionItem[], args: { readonly name: string }) =>
        appendItem(teams, {
          id: optimisticId("team"),
          name: args.name,
          defaultWorkflowId: null,
          sortOrder: teams.reduce((max, team) => Math.max(max, team.sortOrder ?? -1), -1) + 1,
        }),
    }),
  );
}

export function useRenameTeamMutation() {
  return useMutation(api.teams.renameForChurch).withOptimisticUpdate(
    collectionItemOptimisticUpdate({
      query: api.teams.listForChurch,
      collectionKey: "teams",
      patch: (team: TeamCollectionItem, args: { readonly teamId: string; readonly name: string }) =>
        team.id === args.teamId ? { ...team, name: args.name } : undefined,
    }),
  );
}

export function useArchiveTeamMutation() {
  return useMutation(api.teams.archiveForChurch).withOptimisticUpdate(
    collectionListOptimisticUpdate({
      query: api.teams.listForChurch,
      collectionKey: "teams",
      patch: (teams: readonly TeamCollectionItem[], args: { readonly teamId: string }) =>
        removeById(teams, args.teamId),
    }),
  );
}

export function useReorderTeamsMutation() {
  return useMutation(api.teams.reorderForChurch).withOptimisticUpdate(
    collectionListOptimisticUpdate({
      query: api.teams.listForChurch,
      collectionKey: "teams",
      patch: (
        teams: readonly TeamCollectionItem[],
        args: { readonly teamIds: readonly string[] },
      ) => reorderBySortOrder(teams, args.teamIds),
    }),
  );
}

export function useUpdateTeamProductFieldsMutation() {
  return useMutation(api.teams.updateProductFields).withOptimisticUpdate(
    collectionListOptimisticUpdate({
      query: api.teams.listForChurch,
      collectionKey: "teams",
      patch: (
        teams: readonly TeamCollectionItem[],
        args: {
          readonly updates: readonly {
            readonly teamId: string;
            readonly fields: { readonly defaultWorkflowId?: string | null };
          }[];
        },
      ) =>
        args.updates.reduce(
          (current, update) =>
            "defaultWorkflowId" in update.fields
              ? updateById(current, update.teamId, (team) => ({
                  ...team,
                  defaultWorkflowId: update.fields.defaultWorkflowId ?? null,
                }))
              : current,
          teams,
        ),
    }),
  );
}

export function useAddTeamMemberMutation() {
  return useMutation(api.teams.addMemberForChurch).withOptimisticUpdate(
    collectionListOptimisticUpdate({
      query: api.teams.listMembershipsForChurch,
      collectionKey: "teamMemberships",
      patch: (
        memberships: readonly TeamMembershipCollectionItem[],
        args: { readonly teamId: string; readonly userId: string },
      ) =>
        memberships.some((m) => m.teamId === args.teamId && m.userId === args.userId)
          ? memberships
          : appendItem(memberships, {
              id: optimisticId("membership"),
              teamId: args.teamId,
              userId: args.userId,
            }),
    }),
  );
}

export function useRemoveTeamMemberMutation() {
  return useMutation(api.teams.removeMemberForChurch).withOptimisticUpdate(
    collectionListOptimisticUpdate({
      query: api.teams.listMembershipsForChurch,
      collectionKey: "teamMemberships",
      patch: (
        memberships: readonly TeamMembershipCollectionItem[],
        args: { readonly teamId: string; readonly userId: string },
      ) => removeWhere(memberships, (m) => m.teamId === args.teamId && m.userId === args.userId),
    }),
  );
}
