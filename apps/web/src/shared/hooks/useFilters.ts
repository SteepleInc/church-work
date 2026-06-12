import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

import type {
  FilterStateValue,
  FiltersState,
  SortingState,
} from "@/components/data-table-filter/core/types";
import type { FilterKeys } from "@/shared/global-state";

export type { FilterStateValue };

export type FilterSearch = Record<string, unknown>;

const orgRouteApi = getRouteApi("/_org");

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function getFilterStateValue(search: FilterSearch, filterKey: string): FilterStateValue {
  const value = search[filterKey];

  if (isObject(value)) {
    return value as FilterStateValue;
  }

  if (Array.isArray(value)) {
    return { filters: value as FiltersState };
  }

  return {};
}

export function getFiltersFromSearch(search: FilterSearch, filterKey: string): FiltersState {
  return [...(getFilterStateValue(search, filterKey).filters ?? [])];
}

export function getSortingFromSearch(search: FilterSearch, filterKey: string): SortingState {
  return [...(getFilterStateValue(search, filterKey).sorting ?? [])];
}

export function getNextFilterSearch(params: {
  readonly currentSearch: FilterSearch;
  readonly filterKey: string;
  readonly filters?: FiltersState;
  readonly sorting?: SortingState;
}): FilterSearch {
  const currentState = getFilterStateValue(params.currentSearch, params.filterKey);
  const hasFiltersParam = Object.hasOwn(params, "filters");
  const hasSortingParam = Object.hasOwn(params, "sorting");
  const nextState: FilterStateValue = {
    filters: hasFiltersParam ? params.filters : currentState.filters,
    sorting: hasSortingParam ? params.sorting : currentState.sorting,
  };
  const hasContent = Boolean(nextState.filters?.length || nextState.sorting?.length);

  return {
    ...params.currentSearch,
    [params.filterKey]: hasContent ? nextState : undefined,
  };
}

export function getListArgsFromSearch(search: FilterSearch, filterKey: string) {
  const filters = getFiltersFromSearch(search, filterKey);
  const [sorting] = getSortingFromSearch(search, filterKey);
  const orderDirection: "asc" | "desc" = sorting?.desc ? "desc" : "asc";

  return {
    ...(filters.length > 0 ? { filters } : {}),
    ...(sorting ? { orderBy: sorting.id, orderDirection } : {}),
  };
}

export function useFilters(
  filterKey: FilterKeys,
): [FiltersState, (updater: FiltersState | ((prev: FiltersState) => FiltersState)) => void] {
  const navigate = useNavigate();
  const search = orgRouteApi.useSearch();
  const filters = useMemo(() => getFiltersFromSearch(search, filterKey), [search, filterKey]);
  const setFilters = useCallback(
    (updater: FiltersState | ((prev: FiltersState) => FiltersState)) => {
      const nextFilters = typeof updater === "function" ? updater(filters) : updater;

      void navigate({
        replace: true,
        search: (prev) =>
          getNextFilterSearch({
            currentSearch: prev,
            filterKey,
            filters: nextFilters.length > 0 ? nextFilters : undefined,
          }),
        to: ".",
      });
    },
    [filters, filterKey, navigate],
  );

  return [filters, setFilters];
}

export function useFiltersValue(filterKey: string): FiltersState {
  const search = orgRouteApi.useSearch();

  return useMemo(() => getFiltersFromSearch(search, filterKey), [search, filterKey]);
}

export function useSorting(
  filterKey: FilterKeys,
): [SortingState, (updater: SortingState | ((prev: SortingState) => SortingState)) => void] {
  const navigate = useNavigate();
  const search = orgRouteApi.useSearch();
  const sorting = useMemo(() => getSortingFromSearch(search, filterKey), [search, filterKey]);
  const setSorting = useCallback(
    (updater: SortingState | ((prev: SortingState) => SortingState)) => {
      const nextSorting = typeof updater === "function" ? updater(sorting) : updater;

      void navigate({
        replace: true,
        search: (prev) =>
          getNextFilterSearch({
            currentSearch: prev,
            filterKey,
            sorting: nextSorting.length > 0 ? nextSorting : undefined,
          }),
        to: ".",
      });
    },
    [filterKey, navigate, sorting],
  );

  return [sorting, setSorting];
}

export function useSortingValue(filterKey: string): SortingState {
  const search = orgRouteApi.useSearch();

  return useMemo(() => getSortingFromSearch(search, filterKey), [search, filterKey]);
}
