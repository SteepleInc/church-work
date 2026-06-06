import { api } from "@church-task/backend/convex/_generated/api";
import type { Org } from "@church-task/domain";
import { useQuery } from "convex/react";

import { collectionFromQueryResult } from "@/data/convex-query-adapter";
import { useFilterQuery } from "@/shared/hooks/useFilterQuery";

export type OrgCollectionItem = Pick<Org, "id" | "name" | "slug" | "completedOnboarding"> & {
  readonly churchTimeZone: Org["churchTimeZone"] | null;
  readonly createdAt?: number;
  readonly city?: string | null;
  readonly countryCode?: string | null;
  readonly logo?: string | null;
  readonly membersCount?: number;
  readonly size?: string | null;
  readonly state?: string | null;
  readonly teamsCount?: number;
  readonly url?: string | null;
};

export function useUserOrgsCollection() {
  const result = useQuery(api.dashboard.listOrganizations);
  const state = collectionFromQueryResult<OrgCollectionItem>(result);

  return {
    loading: state.loading,
    collection: state.collection,
    orgsCollection: state.collection,
  };
}

export const useOrgsCollection = useUserOrgsCollection;

export function useAllOrgsCollectionWithFilters() {
  const {
    result: orgsCollection,
    info,
    nextPage,
    pageSize,
    limit,
  } = useFilterQuery<OrgCollectionItem>({
    filterKey: "orgs",
    query: api.admin.listAllOrgs,
  });

  return {
    canLoadMore: info === "CanLoadMore",
    limit,
    loading: info === "LoadingFirstPage",
    loadingMore: info === "LoadingMore",
    nextPage,
    orgsCollection,
    pageSize,
  };
}
