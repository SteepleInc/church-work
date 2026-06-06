import { paginationOptsValidator } from "convex/server";
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
  return (await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: args.model,
    paginationOpts: {
      ...args.paginationOpts,
      numItems: getListPageSize(args),
    },
    select: args.select,
  })) as {
    readonly page: ReadonlyArray<T>;
    readonly isDone: boolean;
    readonly continueCursor: string;
  };
}
