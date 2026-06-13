import type { ComponentType } from "react";
import { Schema } from "effect";

export const TextFilterOperatorSchema = Schema.Literal("contains", "does not contain");
export const NumberFilterOperatorSchema = Schema.Literal(
  "is",
  "is not",
  "is less than",
  "is greater than or equal to",
  "is greater than",
  "is less than or equal to",
  "is between",
  "is not between",
);
export const DateFilterOperatorSchema = Schema.Literal(
  "is",
  "is not",
  "is before",
  "is on or after",
  "is after",
  "is on or before",
  "is between",
  "is not between",
);
export const OptionFilterOperatorSchema = Schema.Literal("is", "is not", "is any of", "is none of");
export const MultiOptionFilterOperatorSchema = Schema.Literal(
  "include",
  "exclude",
  "include any of",
  "include all of",
  "exclude if any of",
  "exclude if all",
);

export type TextFilterOperator = typeof TextFilterOperatorSchema.Type;
export type NumberFilterOperator = typeof NumberFilterOperatorSchema.Type;
export type DateFilterOperator = typeof DateFilterOperatorSchema.Type;
export type OptionFilterOperator = typeof OptionFilterOperatorSchema.Type;
export type MultiOptionFilterOperator = typeof MultiOptionFilterOperatorSchema.Type;

/**
 * The canonical URL filter shape: a discriminated union on `type` so each
 * filter can only carry operators and value types that are legal for its
 * column kind. Date values are epoch-millisecond timestamps.
 */
export const FilterItemSchema = Schema.Union(
  Schema.Struct({
    columnId: Schema.String,
    operator: TextFilterOperatorSchema,
    type: Schema.Literal("text"),
    values: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    columnId: Schema.String,
    operator: NumberFilterOperatorSchema,
    type: Schema.Literal("number"),
    values: Schema.Array(Schema.Number),
  }),
  Schema.Struct({
    columnId: Schema.String,
    operator: DateFilterOperatorSchema,
    type: Schema.Literal("date"),
    values: Schema.Array(Schema.Number),
  }),
  Schema.Struct({
    columnId: Schema.String,
    operator: OptionFilterOperatorSchema,
    type: Schema.Literal("option"),
    values: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    columnId: Schema.String,
    operator: MultiOptionFilterOperatorSchema,
    type: Schema.Literal("multiOption"),
    values: Schema.Array(Schema.String),
  }),
);
export type FilterItem = typeof FilterItemSchema.Type;

export const FiltersStateSchema = Schema.Array(FilterItemSchema);
export type FiltersState = typeof FiltersStateSchema.Type;

export const SortingStateSchema = Schema.Array(
  Schema.Struct({ id: Schema.String, desc: Schema.Boolean }),
);
export type SortingState = typeof SortingStateSchema.Type;

/**
 * Combined `{ filters, sorting }` object stored under a single URL search key
 * per surface (see `FilterKeys`).
 */
export const FilterStateValueSchema = Schema.Struct({
  filters: Schema.optional(FiltersStateSchema),
  sorting: Schema.optional(SortingStateSchema),
});
export type FilterStateValue = typeof FilterStateValueSchema.Type;

export type ColumnOption = {
  readonly label: string;
  readonly value: string;
  // Optional leading visual (avatar/status dot/team color) for rich option
  // pickers. Carried alongside the catalog; never persisted to the URL.
  readonly icon?: import("react").ReactNode;
};

export type ColumnConfig<
  TData,
  TValue = unknown,
  TType extends FilterItem["type"] = FilterItem["type"],
> = {
  readonly accessor: (row: TData) => TValue;
  readonly displayName: string;
  readonly hidden?: boolean;
  readonly icon?: ComponentType<{ className?: string }>;
  readonly id: string;
  readonly options?: readonly ColumnOption[];
  readonly type: TType;
};

export type OptionColumnIds<TColumns extends ReadonlyArray<ColumnConfig<unknown>>> = Extract<
  TColumns[number],
  { readonly type: "option" | "multiOption" }
>["id"];
