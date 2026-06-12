import { api } from "@church-task/backend/convex/_generated/api";
import type { Cycle } from "@church-task/domain";
import { useConvexQuery as useQuery } from "@/data/query-hooks";

import { collectionFromQueryResult } from "@/data/convex-query-adapter";

export type CycleCollectionItem = Pick<
  Cycle,
  "id" | "startDate" | "endDate" | "startsAt" | "endsAt"
>;

export function useCyclesCollection(params: {
  readonly churchId: string | null;
  readonly currentUserId: string | null;
}) {
  const result = useQuery(
    api.tasks.mcpListCycles,
    params.churchId && params.currentUserId
      ? { churchId: params.churchId, actorUserId: params.currentUserId }
      : "skip",
  );
  const state = collectionFromQueryResult(result?.ok ? result.cycles : undefined);

  return {
    loading: params.churchId !== null && params.currentUserId !== null && state.loading,
    collection: state.collection,
    cyclesCollection: state.collection,
  };
}
