import { createElement, useMemo, type ReactNode } from "react";

import type {
  ColumnConfig,
  FilterItem,
  OptionFilterOperator,
} from "@/components/data-table-filter/core/types";
import {
  Filters,
  FiltersContent,
  type Filter,
  type FilterFieldConfig,
  type FilterOperator,
  type FilterOption,
} from "@/components/reui/filters";

/**
 * Renders the reUI Linear-style filter UI on top of the canonical
 * schema-driven model (ColumnConfig catalog + FilterItem[] state). This adapter
 * maps ColumnConfig -> FilterFieldConfig and FilterItem <-> Filter at the
 * boundary; operators are the FilterItemSchema operator strings themselves
 * (value === label), so the component speaks the schema directly with no i18n
 * indirection.
 *
 * The Add-Filter menu (TaskFilterAddMenu) and the active filter chips
 * (TaskFilterChips) render separately so the menu can live in the top bar while
 * the chips render in a row beneath it.
 */

// The option operators the schema allows, used as both value and label.
const OPTION_OPERATORS: FilterOperator[] = [
  { value: "is", label: "is", supportsMultiple: false },
  { value: "is not", label: "is not", supportsMultiple: false },
  { value: "is any of", label: "is any of", supportsMultiple: true },
  { value: "is none of", label: "is none of", supportsMultiple: true },
];

const DEFAULT_OPTION_OPERATOR = "is any of";

function toFilterOption(options: ColumnConfig<unknown>["options"]): FilterOption<string>[] {
  return (options ?? []).map((entry) => ({
    value: entry.value,
    label: entry.label,
    icon: entry.icon,
  }));
}

function toFieldConfig(column: ColumnConfig<unknown>): FilterFieldConfig<string> {
  const icon: ReactNode | undefined = column.icon
    ? createElement(column.icon, { className: "size-4 text-muted-foreground" })
    : undefined;

  return {
    key: column.id,
    label: column.displayName,
    icon,
    // Option/multiOption both render as a multiselect picker; the operator
    // governs include vs exclude. Other column types aren't in the task
    // catalog yet.
    type: "multiselect",
    options: toFilterOption(column.options),
    operators: OPTION_OPERATORS,
    defaultOperator: DEFAULT_OPTION_OPERATOR,
    searchable: true,
  };
}

function toReuiFilter(filter: FilterItem): Filter<string> {
  return {
    // One filter per field: a stable id lets the reUI session reuse it.
    id: filter.columnId,
    field: filter.columnId,
    operator: filter.operator,
    values: [...(filter.values as readonly string[])],
  };
}

function toReuiFilters(filters: readonly FilterItem[]): Filter<string>[] {
  return filters
    .filter((filter) => filter.type === "option" || filter.type === "multiOption")
    .map(toReuiFilter);
}

function toFilterItem(filter: Filter<string>): FilterItem {
  return {
    columnId: filter.field,
    operator: filter.operator as OptionFilterOperator,
    type: "option",
    values: filter.values,
  };
}

/**
 * The Add-Filter trigger + menu. Seeded with an empty filter list so it only
 * emits the newly-added field; we merge that into the existing set. Fields
 * already filtered are hidden from the menu (allowMultiple=false), so the menu
 * only ever adds new fields — editing existing chips happens in
 * TaskFilterChips.
 */
export function TaskFilterAddMenu({
  fields,
  filters,
  onChange,
  trigger,
  enableShortcut = false,
}: {
  readonly fields: ReadonlyArray<ColumnConfig<unknown>>;
  readonly filters: readonly FilterItem[];
  readonly onChange: (filters: FilterItem[]) => void;
  readonly trigger: ReactNode;
  // When true, the reUI Filters menu opens on its built-in `F` shortcut
  // (ignored while typing). Matches Linear's "F opens filters".
  readonly enableShortcut?: boolean;
}) {
  const fieldConfigs = useMemo(() => fields.map(toFieldConfig), [fields]);
  const usedFieldKeys = useMemo(() => new Set(filters.map((filter) => filter.columnId)), [filters]);
  // Hide fields that already have an active filter so the menu only adds new
  // ones; this also keeps the empty-seeded merge unambiguous.
  const availableFields = useMemo(
    () => fieldConfigs.filter((field) => !field.key || !usedFieldKeys.has(field.key)),
    [fieldConfigs, usedFieldKeys],
  );

  return (
    <Filters<string>
      fields={availableFields}
      filters={[]}
      onChange={(next) => {
        // `next` carries only newly-added fields (value-less ones are dropped).
        const added = next.filter((filter) => filter.values.length > 0).map(toFilterItem);
        if (added.length === 0) return;
        onChange([...filters, ...added]);
      }}
      trigger={trigger}
      size="sm"
      allowMultiple={false}
      // Match Linear's "Add Filter…" header copy.
      i18n={{ searchFields: "Add filter..." }}
      enableShortcut={enableShortcut}
      shortcutKey="f"
    />
  );
}

/** The active filter chips row (edit operator/values or remove per chip). */
export function TaskFilterChips({
  fields,
  filters,
  onChange,
}: {
  readonly fields: ReadonlyArray<ColumnConfig<unknown>>;
  readonly filters: readonly FilterItem[];
  readonly onChange: (filters: FilterItem[]) => void;
}) {
  const fieldConfigs = useMemo(() => fields.map(toFieldConfig), [fields]);
  const reuiFilters = useMemo(() => toReuiFilters(filters), [filters]);

  return (
    <FiltersContent<string>
      fields={fieldConfigs}
      filters={reuiFilters}
      onChange={(next) =>
        onChange(next.filter((filter) => filter.values.length > 0).map(toFilterItem))
      }
    />
  );
}
