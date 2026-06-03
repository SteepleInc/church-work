import { api } from "@church-task/backend/convex/_generated/api";
import type { Org } from "@church-task/domain";
import { useQuery } from "convex/react";

import { collectionFromQueryResult } from "@/data/convex-query-adapter";

export type OrgCollectionItem = Pick<Org, "id" | "name" | "slug" | "completedOnboarding"> & {
  readonly churchTimeZone: Org["churchTimeZone"] | null;
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
