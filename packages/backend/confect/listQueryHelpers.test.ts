import { describe, expect, it } from "vitest";

import {
  buildWhereForBetterAuthModel,
  getOrganizationSearchQuery,
  getUserSearchQuery,
  getListPageSize,
  getSortByForBetterAuthModel,
  hasTextSearchFilter,
  type ListArgs,
} from "../convex/listQueryHelpers";

const paginationOpts = { cursor: null, numItems: 25 };

describe("Convex listQueryHelpers", () => {
  it("uses Convex pagination size when list args do not override it", () => {
    expect(getListPageSize({ listArgs: {}, paginationOpts })).toBe(25);
  });

  it("uses the requested list limit for the page size", () => {
    const listArgs = { limit: 10 } satisfies ListArgs;

    expect(getListPageSize({ listArgs, paginationOpts })).toBe(10);
  });

  it("translates allowed organization ordering into Better Auth sortBy", () => {
    expect(
      getSortByForBetterAuthModel("organization", {
        orderBy: "createdAt",
        orderDirection: "desc",
      }),
    ).toEqual({ field: "createdAt", direction: "desc" });
  });

  it("suppresses ordering for computed or unsupported organization fields", () => {
    expect(
      getSortByForBetterAuthModel("organization", {
        orderBy: "membersCount",
        orderDirection: "asc",
      }),
    ).toBeUndefined();
  });

  it("suppresses ordering when a text search filter is active", () => {
    const listArgs = {
      filters: [{ columnId: "name", operator: "contains", type: "text", values: ["grace"] }],
      orderBy: "createdAt",
      orderDirection: "desc",
    } satisfies ListArgs;

    expect(hasTextSearchFilter(listArgs)).toBe(true);
    expect(getSortByForBetterAuthModel("organization", listArgs)).toBeUndefined();
  });

  it("translates text search to server-side contains filters", () => {
    expect(
      buildWhereForBetterAuthModel("organization", {
        filters: [{ columnId: "name", operator: "contains", type: "text", values: ["grace"] }],
      }),
    ).toEqual([
      { field: "name", mode: "insensitive", operator: "contains", value: "grace" },
      { connector: "OR", field: "slug", mode: "insensitive", operator: "contains", value: "grace" },
    ]);
  });

  it("extracts organization text search for the Convex search-index query path", () => {
    expect(
      getOrganizationSearchQuery({
        filters: [{ columnId: "name", operator: "contains", type: "text", values: [" grace "] }],
      }),
    ).toEqual({ searchField: "name", searchValue: "grace" });
  });

  it("extracts user text search for the Convex search-index query path", () => {
    expect(
      getUserSearchQuery({
        filters: [{ columnId: "email", operator: "contains", type: "text", values: [" user "] }],
      }),
    ).toEqual({ searchField: "email", searchValue: "user" });
  });

  it("translates selected user ids into adapter where clauses", () => {
    expect(
      buildWhereForBetterAuthModel("user", {
        selectedIds: ["user_1", "user_2"],
      }),
    ).toEqual([{ field: "_id", operator: "in", value: ["user_1", "user_2"] }]);
  });

  it("can omit text search from adapter where clauses when using a search index", () => {
    expect(
      buildWhereForBetterAuthModel(
        "organization",
        {
          filters: [
            { columnId: "name", operator: "contains", type: "text", values: ["grace"] },
            { columnId: "state", operator: "is", type: "option", values: ["TX"] },
          ],
        },
        { includeTextFilters: false },
      ),
    ).toEqual([{ field: "state", operator: "in", value: ["TX"] }]);
  });

  it("translates option filters and coerces onboarding values to booleans", () => {
    expect(
      buildWhereForBetterAuthModel("organization", {
        filters: [
          { columnId: "completedOnboarding", operator: "is", type: "option", values: ["true"] },
        ],
      }),
    ).toEqual([{ field: "completedOnboarding", operator: "eq", value: true }]);
  });

  it("translates date and number filters", () => {
    expect(
      buildWhereForBetterAuthModel("organization", {
        filters: [
          { columnId: "createdAt", operator: "is between", type: "date", values: [100, 200] },
          { columnId: "createdAt", operator: "is greater than", type: "number", values: [150] },
        ],
      }),
    ).toEqual([
      { field: "createdAt", operator: "gte", value: 100 },
      { field: "createdAt", operator: "lte", value: 200 },
      { field: "createdAt", operator: "gt", value: 150 },
    ]);
  });

  it("translates multi-option filters", () => {
    expect(
      buildWhereForBetterAuthModel("organization", {
        filters: [
          {
            columnId: "size",
            operator: "include any of",
            type: "multiOption",
            values: ["1-50", "51-100"],
          },
        ],
      }),
    ).toEqual([{ field: "size", operator: "in", value: ["1-50", "51-100"] }]);
  });
});
