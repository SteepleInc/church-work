import { usePaginatedQuery } from "convex/react";
import type { FunctionReference, PaginationResult } from "convex/server";
import { useMemo } from "react";

import type { FiltersState } from "@/components/data-table-filter/core/types";

export type ListArgs = {
  readonly excludeIds?: readonly string[];
  readonly filters?: FiltersState;
  readonly limit?: number;
  readonly offset?: number;
  readonly orderBy?: string;
  readonly orderDirection?: "asc" | "desc";
  readonly selectedIds?: readonly string[];
};

type PaginatedQuery = FunctionReference<
  "query",
  "public",
  {
    readonly listArgs: ListArgs;
    readonly paginationOpts: { readonly cursor: string | null; readonly numItems: number };
  },
  PaginationResult<unknown>
>;

export function useFilterQuery<TItem>(params: {
  readonly query: PaginatedQuery;
  readonly filterKey: string;
  readonly pageSize?: number;
  readonly enabled?: boolean;
}) {
  const { query, pageSize = 50, enabled = true } = params;
  const listArgs = useMemo<ListArgs>(() => ({}), []);
  const result = usePaginatedQuery(query, enabled ? { listArgs } : "skip", {
    initialNumItems: pageSize,
  });

  return {
    info: result.status,
    limit: result.results.length,
    nextPage: () => result.loadMore(pageSize),
    pageSize,
    result: result.results as TItem[],
  };
}
