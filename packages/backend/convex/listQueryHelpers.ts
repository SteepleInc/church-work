import { paginationOptsValidator } from "convex/server";
import type { FunctionReference } from "convex/server";
import { v } from "convex/values";

import { components } from "./_generated/api";
import type { QueryCtx } from "./_generated/server";

const textFilterOperatorValidator = v.union(v.literal("contains"), v.literal("does not contain"));

const numberFilterOperatorValidator = v.union(
  v.literal("is"),
  v.literal("is not"),
  v.literal("is less than"),
  v.literal("is greater than or equal to"),
  v.literal("is greater than"),
  v.literal("is less than or equal to"),
  v.literal("is between"),
  v.literal("is not between"),
);

const dateFilterOperatorValidator = v.union(
  v.literal("is"),
  v.literal("is not"),
  v.literal("is before"),
  v.literal("is on or after"),
  v.literal("is after"),
  v.literal("is on or before"),
  v.literal("is between"),
  v.literal("is not between"),
);

const optionFilterOperatorValidator = v.union(
  v.literal("is"),
  v.literal("is not"),
  v.literal("is any of"),
  v.literal("is none of"),
);

const multiOptionFilterOperatorValidator = v.union(
  v.literal("include"),
  v.literal("exclude"),
  v.literal("include any of"),
  v.literal("include all of"),
  v.literal("exclude if any of"),
  v.literal("exclude if all"),
);

export const filterItemValidator = v.union(
  v.object({
    columnId: v.string(),
    operator: textFilterOperatorValidator,
    type: v.literal("text"),
    values: v.array(v.string()),
  }),
  v.object({
    columnId: v.string(),
    operator: numberFilterOperatorValidator,
    type: v.literal("number"),
    values: v.array(v.number()),
  }),
  v.object({
    columnId: v.string(),
    operator: dateFilterOperatorValidator,
    type: v.literal("date"),
    values: v.array(v.number()),
  }),
  v.object({
    columnId: v.string(),
    operator: optionFilterOperatorValidator,
    type: v.literal("option"),
    values: v.array(v.string()),
  }),
  v.object({
    columnId: v.string(),
    operator: multiOptionFilterOperatorValidator,
    type: v.literal("multiOption"),
    values: v.array(v.string()),
  }),
);

export const listArgsValidator = v.object({
  excludeIds: v.optional(v.array(v.string())),
  filters: v.optional(v.array(filterItemValidator)),
  limit: v.optional(v.number()),
  offset: v.optional(v.number()),
  orderBy: v.optional(v.string()),
  orderDirection: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  selectedIds: v.optional(v.array(v.string())),
});

export const listQueryArgsValidator = {
  listArgs: listArgsValidator,
  paginationOpts: paginationOptsValidator,
};

export type ListArgs = typeof listArgsValidator.type;
export type FilterItem = typeof filterItemValidator.type;

type BetterAuthModel = "organization" | "user" | "member" | "team";
type SortBy = { readonly field: string; readonly direction: "asc" | "desc" };
export type BetterAuthWhere = {
  readonly connector?: "AND" | "OR";
  readonly field: string;
  readonly mode?: "sensitive" | "insensitive";
  readonly operator?:
    | "lt"
    | "lte"
    | "gt"
    | "gte"
    | "eq"
    | "in"
    | "not_in"
    | "ne"
    | "contains"
    | "starts_with"
    | "ends_with";
  readonly value: string | number | boolean | Array<string> | Array<number> | null;
};

type BetterAuthSearchWhere = Omit<BetterAuthWhere, "mode" | "operator"> & {
  readonly operator?: Exclude<
    BetterAuthWhere["operator"],
    "contains" | "starts_with" | "ends_with"
  >;
};

type OrganizationSearchField = "name" | "slug";
type UserSearchField = "name" | "email";

type OrganizationSearchQuery = {
  readonly searchField: OrganizationSearchField;
  readonly searchValue: string;
};

type UserSearchQuery = {
  readonly searchField: UserSearchField;
  readonly searchValue: string;
};

type BetterAuthSearchComponent = typeof components.betterAuth & {
  readonly search: {
    readonly listOrganizationsBySearch: FunctionReference<
      "query",
      "internal",
      {
        paginationOpts: typeof paginationOptsValidator.type;
        pageSize: number;
        searchField: OrganizationSearchField;
        searchValue: string;
        select?: Array<string>;
        where?: Array<BetterAuthSearchWhere>;
      },
      {
        readonly page: ReadonlyArray<unknown>;
        readonly isDone: boolean;
        readonly continueCursor: string;
      }
    >;
    readonly listUsersBySearch: FunctionReference<
      "query",
      "internal",
      {
        paginationOpts: typeof paginationOptsValidator.type;
        pageSize: number;
        searchField: UserSearchField;
        searchValue: string;
        select?: Array<string>;
        where?: Array<BetterAuthSearchWhere>;
      },
      {
        readonly page: ReadonlyArray<unknown>;
        readonly isDone: boolean;
        readonly continueCursor: string;
      }
    >;
  };
};

const sortableFieldsByModel = {
  member: new Set(["createdAt", "organizationId", "role", "userId"]),
  organization: new Set([
    "churchTimeZone",
    "completedOnboarding",
    "createdAt",
    "name",
    "size",
    "slug",
    "url",
  ]),
  team: new Set(["createdAt", "name", "organizationId", "sortOrder", "updatedAt"]),
  user: new Set(["_id", "createdAt", "email", "name"]),
} satisfies Record<BetterAuthModel, Set<string>>;

const filterableFieldsByModel = {
  member: new Set(["createdAt", "organizationId", "role", "userId"]),
  organization: new Set([
    "churchTimeZone",
    "completedOnboarding",
    "createdAt",
    "name",
    "size",
    "slug",
    "state",
    "url",
  ]),
  team: new Set(["createdAt", "name", "organizationId", "sortOrder", "updatedAt"]),
  user: new Set(["_id", "createdAt", "email", "name"]),
} satisfies Record<BetterAuthModel, Set<string>>;

function isNonEmptyFilterValue(value: string | number | undefined): value is string | number {
  return typeof value === "number" || (typeof value === "string" && value.trim().length > 0);
}

export function hasTextSearchFilter(listArgs: ListArgs): boolean {
  return Boolean(
    listArgs.filters?.some(
      (filter) =>
        filter.type === "text" &&
        filter.operator === "contains" &&
        typeof filter.values[0] === "string" &&
        filter.values[0].trim().length > 0,
    ),
  );
}

function getTextSearchWheres(
  model: BetterAuthModel,
  filter: Extract<FilterItem, { type: "text" }>,
) {
  const value = filter.values[0]?.trim();

  if (!value) {
    return [];
  }

  const operator = filter.operator === "does not contain" ? "not_in" : "contains";

  if (operator === "not_in") {
    return [];
  }

  if (model === "organization" && filter.columnId === "name") {
    return [
      { field: "name", mode: "insensitive", operator, value },
      { connector: "OR", field: "slug", mode: "insensitive", operator, value },
    ] satisfies BetterAuthWhere[];
  }

  if (!filterableFieldsByModel[model].has(filter.columnId)) {
    return [];
  }

  return [
    { field: filter.columnId, mode: "insensitive", operator, value },
  ] satisfies BetterAuthWhere[];
}

function getOptionWheres(
  model: BetterAuthModel,
  filter: Extract<FilterItem, { type: "option" | "multiOption" }>,
) {
  if (!filterableFieldsByModel[model].has(filter.columnId) || filter.values.length === 0) {
    return [];
  }

  if (model === "organization" && filter.columnId === "completedOnboarding") {
    const [value] = filter.values;

    if (value !== "true" && value !== "false") {
      return [];
    }

    const booleanValue = value === "true";
    const operator = filter.operator === "is" || filter.operator === "is any of" ? "eq" : "ne";

    return [{ field: filter.columnId, operator, value: booleanValue }] satisfies BetterAuthWhere[];
  }

  const positiveOperators = new Set([
    "is",
    "is any of",
    "include",
    "include any of",
    "include all of",
  ]);
  const operator = positiveOperators.has(filter.operator) ? "in" : "not_in";
  const value = [...filter.values];

  if (value.length === 0) {
    return [];
  }

  return [{ field: filter.columnId, operator, value }] satisfies BetterAuthWhere[];
}

function getRangeWheres(filter: Extract<FilterItem, { type: "date" | "number" }>) {
  const [firstValue, secondValue] = filter.values;

  if (!isNonEmptyFilterValue(firstValue)) {
    return [];
  }

  switch (filter.operator) {
    case "is":
      return [
        { field: filter.columnId, operator: "eq", value: firstValue },
      ] satisfies BetterAuthWhere[];
    case "is not":
      return [
        { field: filter.columnId, operator: "ne", value: firstValue },
      ] satisfies BetterAuthWhere[];
    case "is before":
    case "is less than":
      return [
        { field: filter.columnId, operator: "lt", value: firstValue },
      ] satisfies BetterAuthWhere[];
    case "is on or after":
    case "is greater than or equal to":
      return [
        { field: filter.columnId, operator: "gte", value: firstValue },
      ] satisfies BetterAuthWhere[];
    case "is after":
    case "is greater than":
      return [
        { field: filter.columnId, operator: "gt", value: firstValue },
      ] satisfies BetterAuthWhere[];
    case "is on or before":
    case "is less than or equal to":
      return [
        { field: filter.columnId, operator: "lte", value: firstValue },
      ] satisfies BetterAuthWhere[];
    case "is between":
      if (!isNonEmptyFilterValue(secondValue)) return [];
      return [
        { field: filter.columnId, operator: "gte", value: firstValue },
        { field: filter.columnId, operator: "lte", value: secondValue },
      ] satisfies BetterAuthWhere[];
    case "is not between":
      if (!isNonEmptyFilterValue(secondValue)) return [];
      return [
        { field: filter.columnId, operator: "lt", value: firstValue },
        { connector: "OR", field: filter.columnId, operator: "gt", value: secondValue },
      ] satisfies BetterAuthWhere[];
    default:
      return [];
  }
}

export function buildWhereForBetterAuthModel(
  model: BetterAuthModel,
  listArgs: ListArgs,
  options?: { readonly includeTextFilters?: boolean },
): BetterAuthWhere[] {
  const where: BetterAuthWhere[] = [];
  const includeTextFilters = options?.includeTextFilters ?? true;

  if (listArgs.selectedIds && listArgs.selectedIds.length > 0) {
    where.push({ field: "_id", operator: "in", value: [...listArgs.selectedIds] });
  }

  if (listArgs.excludeIds && listArgs.excludeIds.length > 0) {
    where.push({ field: "_id", operator: "not_in", value: [...listArgs.excludeIds] });
  }

  for (const filter of listArgs.filters ?? []) {
    if (!filterableFieldsByModel[model].has(filter.columnId)) {
      continue;
    }

    switch (filter.type) {
      case "text":
        if (!includeTextFilters) {
          break;
        }
        where.push(...getTextSearchWheres(model, filter));
        break;
      case "option":
      case "multiOption":
        where.push(...getOptionWheres(model, filter));
        break;
      case "date":
      case "number":
        where.push(...getRangeWheres(filter));
        break;
    }
  }

  return where;
}

function isBetterAuthSearchWhere(where: BetterAuthWhere): where is BetterAuthSearchWhere {
  return (
    where.operator !== "contains" &&
    where.operator !== "starts_with" &&
    where.operator !== "ends_with" &&
    where.mode === undefined
  );
}

export function getOrganizationSearchQuery(
  listArgs: ListArgs,
): OrganizationSearchQuery | undefined {
  const textFilter = listArgs.filters?.find(
    (filter): filter is Extract<FilterItem, { type: "text" }> =>
      filter.type === "text" &&
      filter.operator === "contains" &&
      (filter.columnId === "name" || filter.columnId === "slug") &&
      typeof filter.values[0] === "string" &&
      filter.values[0].trim().length > 0,
  );

  if (!textFilter) {
    return undefined;
  }

  const searchValue = textFilter.values[0];

  if (textFilter.columnId !== "name" && textFilter.columnId !== "slug") {
    return undefined;
  }

  if (typeof searchValue !== "string") {
    return undefined;
  }

  return {
    searchField: textFilter.columnId,
    searchValue: searchValue.trim(),
  };
}

export function getUserSearchQuery(listArgs: ListArgs): UserSearchQuery | undefined {
  const textFilter = listArgs.filters?.find(
    (filter): filter is Extract<FilterItem, { type: "text" }> =>
      filter.type === "text" &&
      filter.operator === "contains" &&
      (filter.columnId === "name" || filter.columnId === "email") &&
      typeof filter.values[0] === "string" &&
      filter.values[0].trim().length > 0,
  );

  if (!textFilter) {
    return undefined;
  }

  const searchValue = textFilter.values[0];

  if (textFilter.columnId !== "name" && textFilter.columnId !== "email") {
    return undefined;
  }

  if (typeof searchValue !== "string") {
    return undefined;
  }

  return {
    searchField: textFilter.columnId,
    searchValue: searchValue.trim(),
  };
}

export function getSortByForBetterAuthModel(
  model: BetterAuthModel,
  listArgs: ListArgs,
): SortBy | undefined {
  if (hasTextSearchFilter(listArgs)) {
    return undefined;
  }

  if (!listArgs.orderBy || !listArgs.orderDirection) {
    return undefined;
  }

  if (!sortableFieldsByModel[model].has(listArgs.orderBy)) {
    return undefined;
  }

  return { field: listArgs.orderBy, direction: listArgs.orderDirection };
}

export function getListPageSize(args: {
  readonly listArgs: ListArgs;
  readonly paginationOpts: typeof paginationOptsValidator.type;
}) {
  return args.listArgs.limit ?? args.paginationOpts.numItems;
}

export async function listBetterAuthModel<T>(
  ctx: QueryCtx,
  args: {
    readonly model: BetterAuthModel;
    readonly listArgs: ListArgs;
    readonly paginationOpts: typeof paginationOptsValidator.type;
    readonly select?: Array<string>;
  },
) {
  const sortBy = getSortByForBetterAuthModel(args.model, args.listArgs);
  const organizationSearchQuery =
    args.model === "organization" ? getOrganizationSearchQuery(args.listArgs) : undefined;
  const userSearchQuery = args.model === "user" ? getUserSearchQuery(args.listArgs) : undefined;
  const where = buildWhereForBetterAuthModel(args.model, args.listArgs, {
    includeTextFilters: !organizationSearchQuery && !userSearchQuery,
  });
  const searchWhere = where.filter(isBetterAuthSearchWhere);

  if (organizationSearchQuery) {
    const betterAuthSearch = components.betterAuth as BetterAuthSearchComponent;

    return (await ctx.runQuery(betterAuthSearch.search.listOrganizationsBySearch, {
      paginationOpts: args.paginationOpts,
      pageSize: getListPageSize(args),
      searchField: organizationSearchQuery.searchField,
      searchValue: organizationSearchQuery.searchValue,
      select: args.select,
      ...(searchWhere.length > 0 ? { where: searchWhere } : {}),
    })) as {
      readonly page: ReadonlyArray<T>;
      readonly isDone: boolean;
      readonly continueCursor: string;
    };
  }

  if (userSearchQuery) {
    const betterAuthSearch = components.betterAuth as BetterAuthSearchComponent;

    return (await ctx.runQuery(betterAuthSearch.search.listUsersBySearch, {
      paginationOpts: args.paginationOpts,
      pageSize: getListPageSize(args),
      searchField: userSearchQuery.searchField,
      searchValue: userSearchQuery.searchValue,
      select: args.select,
      ...(searchWhere.length > 0 ? { where: searchWhere } : {}),
    })) as {
      readonly page: ReadonlyArray<T>;
      readonly isDone: boolean;
      readonly continueCursor: string;
    };
  }

  return (await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: args.model,
    paginationOpts: {
      ...args.paginationOpts,
      numItems: getListPageSize(args),
    },
    select: args.select,
    ...(sortBy ? { sortBy } : {}),
    ...(where.length > 0 ? { where } : {}),
  })) as {
    readonly page: ReadonlyArray<T>;
    readonly isDone: boolean;
    readonly continueCursor: string;
  };
}
