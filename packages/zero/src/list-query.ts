import { Schema } from "effect";

const TextFilterSchema = Schema.Struct({
  column_id: Schema.String,
  operator: Schema.Literals(["contains", "does not contain"]),
  type: Schema.Literal("text"),
  values: Schema.Array(Schema.String),
});

const NumberFilterSchema = Schema.Struct({
  column_id: Schema.String,
  operator: Schema.Literals([
    "is",
    "is not",
    "is less than",
    "is greater than or equal to",
    "is greater than",
    "is less than or equal to",
    "is between",
    "is not between",
  ]),
  type: Schema.Literal("number"),
  values: Schema.Array(Schema.Number),
});

const DateFilterSchema = Schema.Struct({
  column_id: Schema.String,
  operator: Schema.Literals([
    "is",
    "is not",
    "is before",
    "is on or after",
    "is after",
    "is on or before",
    "is between",
    "is not between",
  ]),
  type: Schema.Literal("date"),
  values: Schema.Array(Schema.Number),
});

const OptionFilterSchema = Schema.Struct({
  column_id: Schema.String,
  operator: Schema.Literals(["is", "is not", "is any of", "is none of"]),
  type: Schema.Literal("option"),
  values: Schema.Array(Schema.Union([Schema.String, Schema.Null])),
});

const MultiOptionFilterSchema = Schema.Struct({
  column_id: Schema.String,
  operator: Schema.Literals([
    "include",
    "exclude",
    "include any of",
    "include all of",
    "exclude if any of",
    "exclude if all",
  ]),
  type: Schema.Literal("multiOption"),
  values: Schema.Array(Schema.String),
});

export const ListArgsEffectSchema = Schema.Struct({
  exclude_ids: Schema.optional(Schema.Array(Schema.String)),
  filters: Schema.optional(
    Schema.Array(
      Schema.Union([
        TextFilterSchema,
        NumberFilterSchema,
        DateFilterSchema,
        OptionFilterSchema,
        MultiOptionFilterSchema,
      ]),
    ),
  ),
  limit: Schema.optional(Schema.Number),
  offset: Schema.optional(Schema.Number),
  order_by: Schema.optional(Schema.String),
  order_direction: Schema.optional(Schema.Literals(["asc", "desc"])),
  selected_ids: Schema.optional(Schema.Array(Schema.String)),
});

export type ListArgs = typeof ListArgsEffectSchema.Type;
type FilterItem = NonNullable<ListArgs["filters"]>[number];
type QueryLike = any;

type ListQueryConfig = {
  readonly allowed_columns: readonly string[];
  readonly column_map?: Record<string, string>;
  readonly default_order_by: string;
  readonly default_order_direction?: "asc" | "desc";
};

const escapeLike = (value: string) =>
  value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");

const hasValues = (filter: FilterItem) => filter.values.length > 0;

const resolveColumn = (column: string, config: ListQueryConfig) =>
  config.column_map?.[column] ?? column;

function applyTextFilter(query: QueryLike, filter: FilterItem, column: string) {
  if (filter.type !== "text" || !hasValues(filter)) return query;

  const value = filter.values[0]?.trim();
  if (!value) return query;

  return query.where(
    column,
    filter.operator === "contains" ? "ILIKE" : "NOT ILIKE",
    `%${escapeLike(value)}%`,
  );
}

function applyOptionFilter(query: QueryLike, filter: FilterItem, column: string) {
  if (filter.type !== "option" || !hasValues(filter)) return query;

  const values = filter.values;
  const stringValues = values.filter((value): value is string => value !== null);
  const includesNull = values.includes(null);

  if (filter.operator === "is") {
    const value = values[0];
    return value === null ? query.where(column, "IS", null) : query.where(column, value);
  }
  if (filter.operator === "is not") {
    const value = values[0];
    return value === null ? query.where(column, "IS NOT", null) : query.where(column, "!=", value);
  }
  if (filter.operator === "is any of") {
    if (!includesNull) return query.where(column, "IN", stringValues);
    if (stringValues.length === 0) return query.where(column, "IS", null);

    return query.where(({ cmp, or }: QueryLike) =>
      or(cmp(column, "IN", stringValues), cmp(column, "IS", null)),
    );
  }

  let result = stringValues.length > 0 ? query.where(column, "NOT IN", stringValues) : query;
  if (includesNull) result = result.where(column, "IS NOT", null);
  return result;
}

function applyNumberFilter(query: QueryLike, filter: FilterItem, column: string) {
  if (filter.type !== "number" || !hasValues(filter)) return query;

  const [first, second] = filter.values;
  if (first === undefined) return query;

  if (filter.operator === "is") return query.where(column, first);
  if (filter.operator === "is not") return query.where(column, "!=", first);
  if (filter.operator === "is less than") return query.where(column, "<", first);
  if (filter.operator === "is greater than or equal to") return query.where(column, ">=", first);
  if (filter.operator === "is greater than") return query.where(column, ">", first);
  if (filter.operator === "is less than or equal to") return query.where(column, "<=", first);
  if (second === undefined) return query;

  const between = query.where(column, ">=", first).where(column, "<=", second);
  return filter.operator === "is between"
    ? between
    : query.where(column, "<", first).where(column, ">", second);
}

function applyDateFilter(query: QueryLike, filter: FilterItem, column: string) {
  if (filter.type !== "date" || !hasValues(filter)) return query;

  const [first, second] = filter.values;
  if (first === undefined) return query;

  if (filter.operator === "is") return query.where(column, first);
  if (filter.operator === "is not") return query.where(column, "!=", first);
  if (filter.operator === "is before") return query.where(column, "<", first);
  if (filter.operator === "is on or after") return query.where(column, ">=", first);
  if (filter.operator === "is after") return query.where(column, ">", first);
  if (filter.operator === "is on or before") return query.where(column, "<=", first);
  if (second === undefined) return query;

  const between = query.where(column, ">=", first).where(column, "<=", second);
  return filter.operator === "is between"
    ? between
    : query.where(column, "<", first).where(column, ">", second);
}

function applyFilter(
  query: QueryLike,
  filter: FilterItem,
  allowedColumns: Set<string>,
  config: ListQueryConfig,
) {
  if (!allowedColumns.has(filter.column_id)) return query;
  const column = resolveColumn(filter.column_id, config);
  if (filter.type === "text") return applyTextFilter(query, filter, column);
  if (filter.type === "option") return applyOptionFilter(query, filter, column);
  if (filter.type === "number") return applyNumberFilter(query, filter, column);
  if (filter.type === "date") return applyDateFilter(query, filter, column);

  return query;
}

export function applyZeroListQuery<TQuery extends QueryLike>(
  query: TQuery,
  args: ListArgs | undefined,
  config: ListQueryConfig,
): TQuery {
  const allowedColumns = new Set(config.allowed_columns);
  let result: QueryLike = query;

  for (const filter of args?.filters ?? []) {
    result = applyFilter(result, filter, allowedColumns, config);
  }

  if (args?.exclude_ids?.length) result = result.where("id", "NOT IN", args.exclude_ids);
  if (args?.selected_ids?.length) result = result.where("id", "IN", args.selected_ids);

  const orderBy = resolveColumn(
    args?.order_by && allowedColumns.has(args.order_by) ? args.order_by : config.default_order_by,
    config,
  );
  result = result.orderBy(
    orderBy,
    args?.order_direction ?? config.default_order_direction ?? "asc",
  );

  if (typeof args?.offset === "number" && args.offset > 0 && result.offset) {
    result = result.offset(args.offset);
  }
  if (typeof args?.limit === "number" && args.limit > 0) result = result.limit(args.limit);

  return result as TQuery;
}
