import type { ComponentType } from "react";

export type TextFilterOperator = "contains" | "does not contain";
export type NumberFilterOperator =
  | "is"
  | "is not"
  | "is less than"
  | "is greater than or equal to"
  | "is greater than"
  | "is less than or equal to"
  | "is between"
  | "is not between";
export type DateFilterOperator =
  | "is"
  | "is not"
  | "is before"
  | "is on or after"
  | "is after"
  | "is on or before"
  | "is between"
  | "is not between";
export type OptionFilterOperator = "is" | "is not" | "is any of" | "is none of";
export type MultiOptionFilterOperator =
  | "include"
  | "exclude"
  | "include any of"
  | "include all of"
  | "exclude if any of"
  | "exclude if all";

export type FilterItem =
  | {
      readonly columnId: string;
      readonly operator: TextFilterOperator;
      readonly type: "text";
      readonly values: readonly string[];
    }
  | {
      readonly columnId: string;
      readonly operator: NumberFilterOperator;
      readonly type: "number";
      readonly values: readonly number[];
    }
  | {
      readonly columnId: string;
      readonly operator: DateFilterOperator;
      readonly type: "date";
      readonly values: readonly number[];
    }
  | {
      readonly columnId: string;
      readonly operator: OptionFilterOperator;
      readonly type: "option";
      readonly values: readonly string[];
    }
  | {
      readonly columnId: string;
      readonly operator: MultiOptionFilterOperator;
      readonly type: "multiOption";
      readonly values: readonly string[];
    };

export type FiltersState = readonly FilterItem[];
export type SortingState = readonly { readonly id: string; readonly desc: boolean }[];

export type ColumnOption = {
  readonly label: string;
  readonly value: string;
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
