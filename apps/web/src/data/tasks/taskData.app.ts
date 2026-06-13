import { api } from "@church-task/backend/convex/_generated/api";

import { successfulResponseCollection } from "@/data/convex-query-adapter";
import { useConvexQuery as useQuery } from "@/data/query-hooks";

/**
 * Resolve a Task by its Task Identifier ("PRD-48", case-insensitive) through
 * the shared identifier-resolution module (ADR 0013): current identifiers
 * first, then previous-identifier aliases. The resolved Task carries the
 * canonical current identifier so the URL can normalize.
 */
export function useTaskByIdentifier(params: {
  readonly churchId: string | null;
  readonly identifier: string;
}) {
  const result = useQuery(
    api.tasks.resolveByIdentifier,
    params.churchId ? { churchId: params.churchId, identifier: params.identifier } : "skip",
  );
  const state = successfulResponseCollection(result, (response) => response.data.tasks);

  return {
    loading: params.churchId !== null && state.loading,
    taskOpt: state.collection[0] ?? null,
  };
}
