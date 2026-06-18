import type { ListArgs } from "@church-task/zero";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import type { FilterItem } from "@/components/data-table-filter/core/types";
import { getListArgsFromSearch } from "@/shared/hooks/useFilters";

const orgRouteApi = getRouteApi("/_org");

type ColumnMap = Record<string, string>;
type ZeroFilter = NonNullable<ListArgs["filters"]>[number];

const mapFilter = (
  filter: FilterItem,
  columnMap: ColumnMap,
  mapFilterValues?: (filter: FilterItem) => readonly (string | null)[] | undefined,
): ZeroFilter => {
  const values = mapFilterValues?.(filter) ?? filter.values;
  const { columnId: _columnId, ...rest } = filter;

  return {
    ...rest,
    column_id: columnMap[filter.columnId] ?? filter.columnId,
    values,
  } as ZeroFilter;
};

export function useZeroListArgs(params: {
  readonly filterKey: string;
  readonly columnMap: ColumnMap;
  readonly getAll?: boolean;
  readonly mapFilterValues?: (filter: FilterItem) => readonly (string | null)[] | undefined;
  readonly pageSize?: number;
}) {
  const { columnMap, filterKey, getAll = false, mapFilterValues, pageSize = 50 } = params;
  const search = orgRouteApi.useSearch();
  const [limit, setLimit] = useState(pageSize);
  const listArgs = useMemo<ListArgs>(() => {
    const args = getListArgsFromSearch(search, filterKey);
    const orderBy = args.orderBy ? (columnMap[args.orderBy] ?? args.orderBy) : undefined;

    return {
      ...(args.filters
        ? { filters: args.filters.map((filter) => mapFilter(filter, columnMap, mapFilterValues)) }
        : {}),
      ...(getAll ? {} : { limit }),
      ...(orderBy ? { order_by: orderBy, order_direction: args.orderDirection } : {}),
    } as ListArgs;
  }, [columnMap, filterKey, getAll, limit, mapFilterValues, search]);

  return {
    limit,
    listArgs,
    nextPage: () => setLimit((currentLimit) => currentLimit + pageSize),
    pageSize,
  };
}
