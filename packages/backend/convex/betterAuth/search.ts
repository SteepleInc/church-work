import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { query } from "./_generated/server";

const searchWhereValidator = v.object({
  connector: v.optional(v.union(v.literal("AND"), v.literal("OR"))),
  field: v.string(),
  operator: v.optional(
    v.union(
      v.literal("lt"),
      v.literal("lte"),
      v.literal("gt"),
      v.literal("gte"),
      v.literal("eq"),
      v.literal("in"),
      v.literal("not_in"),
      v.literal("ne"),
    ),
  ),
  value: v.union(
    v.string(),
    v.number(),
    v.boolean(),
    v.array(v.string()),
    v.array(v.number()),
    v.null(),
  ),
});

type SearchWhere = typeof searchWhereValidator.type;

export const listOrganizationsBySearch = query({
  args: {
    paginationOpts: paginationOptsValidator,
    searchField: v.union(v.literal("name"), v.literal("slug")),
    searchValue: v.string(),
    pageSize: v.number(),
    select: v.optional(v.array(v.string())),
    where: v.optional(v.array(searchWhereValidator)),
  },
  handler: async (ctx, args) => {
    const indexName = args.searchField === "slug" ? "search_slug" : "search_name";

    let queryWithSearch = ctx.db
      .query("organization")
      .withSearchIndex(indexName, (q) => q.search(args.searchField, args.searchValue));

    const wheres = args.where;

    if (wheres && wheres.length > 0) {
      queryWithSearch = queryWithSearch.filter((q) => {
        const predicateFor = (where: SearchWhere) => {
          switch (where.operator) {
            case "lt":
              return q.lt(q.field(where.field), where.value);
            case "lte":
              return q.lte(q.field(where.field), where.value);
            case "gt":
              return q.gt(q.field(where.field), where.value);
            case "gte":
              return q.gte(q.field(where.field), where.value);
            case "ne":
              return q.neq(q.field(where.field), where.value);
            case "in":
              return q.or(
                ...(where.value as Array<string | number>).map((value) =>
                  q.eq(q.field(where.field), value),
                ),
              );
            case "not_in":
              return q.and(
                ...(where.value as Array<string | number>).map((value) =>
                  q.neq(q.field(where.field), value),
                ),
              );
            case "eq":
            default:
              return q.eq(q.field(where.field), where.value);
          }
        };

        let combined = predicateFor(wheres[0]!);

        for (const where of wheres.slice(1)) {
          const next = predicateFor(where);
          combined = where.connector === "OR" ? q.or(combined, next) : q.and(combined, next);
        }

        return combined;
      });
    }

    const result = await queryWithSearch.paginate({
      ...args.paginationOpts,
      numItems: args.pageSize,
    });

    if (!args.select) {
      return result;
    }

    return {
      ...result,
      page: result.page.map((document) =>
        Object.fromEntries(
          args.select.flatMap((field) =>
            field in document ? [[field, document[field as keyof typeof document]]] : [],
          ),
        ),
      ),
    };
  },
});
