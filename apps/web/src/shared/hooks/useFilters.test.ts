import { describe, expect, test } from "bun:test";

import type { FiltersState, SortingState } from "@/components/data-table-filter/core/types";
import { FilterKeys } from "@/shared/global-state";

import {
  getFiltersFromSearch,
  getListArgsFromSearch,
  getNextFilterSearch,
  getSortingFromSearch,
} from "./useFilters";

describe("filter and sorting URL state", () => {
  test("round-trips filters and sorting through a keyed search param", () => {
    const filters: FiltersState = [
      { columnId: "name", operator: "contains", type: "text", values: ["grace"] },
    ];
    const sorting: SortingState = [{ desc: true, id: "createdAt" }];
    const search = getNextFilterSearch({
      currentSearch: {},
      filterKey: FilterKeys.Orgs,
      filters,
    });
    const nextSearch = getNextFilterSearch({
      currentSearch: search,
      filterKey: FilterKeys.Orgs,
      sorting,
    });

    expect(getFiltersFromSearch(nextSearch, FilterKeys.Orgs)).toEqual(filters);
    expect(getSortingFromSearch(nextSearch, FilterKeys.Orgs)).toEqual(sorting);
    expect(getListArgsFromSearch(nextSearch, FilterKeys.Orgs)).toEqual({
      filters,
      orderBy: "createdAt",
      orderDirection: "desc",
    });
  });

  test("clearing the last filters and sorting removes the keyed search value", () => {
    const search = getNextFilterSearch({
      currentSearch: {
        [FilterKeys.Orgs]: {
          filters: [{ columnId: "name", operator: "contains", type: "text", values: ["grace"] }],
          sorting: [{ desc: false, id: "name" }],
        },
      },
      filterKey: FilterKeys.Orgs,
      filters: [],
      sorting: [],
    });

    expect(search[FilterKeys.Orgs]).toBeUndefined();
  });
});
