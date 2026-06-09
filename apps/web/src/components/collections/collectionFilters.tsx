import { Plus, X } from "lucide-react";
import { useState } from "react";

import type { ColumnConfig, FilterItem } from "@/components/data-table-filter/core/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FilterKeys } from "@/shared/global-state";
import { useFilters } from "@/shared/hooks/useFilters";

type CollectionFiltersProps<TData> = {
  readonly filterKey: FilterKeys;
  readonly filtersDef: ReadonlyArray<ColumnConfig<TData>>;
};

function getDefaultFilter(column: ColumnConfig<unknown>): FilterItem | null {
  switch (column.type) {
    case "text":
      return { columnId: column.id, operator: "contains", type: "text", values: [""] };
    case "option": {
      const value = column.options?.[0]?.value;
      return value
        ? { columnId: column.id, operator: "is", type: "option", values: [value] }
        : null;
    }
    case "multiOption": {
      const value = column.options?.[0]?.value;
      return value
        ? { columnId: column.id, operator: "include any of", type: "multiOption", values: [value] }
        : null;
    }
    case "date":
      return {
        columnId: column.id,
        operator: "is on or after",
        type: "date",
        values: [Date.now()],
      };
    case "number":
      return {
        columnId: column.id,
        operator: "is greater than or equal to",
        type: "number",
        values: [0],
      };
  }
}

function formatDateInput(timestamp: number | undefined) {
  if (!timestamp) return "";

  return new Date(timestamp).toISOString().slice(0, 10);
}

function getFilterLabel(column: ColumnConfig<unknown> | undefined, filter: FilterItem) {
  const label = column?.displayName ?? filter.columnId;

  if (filter.type === "date") {
    return `${label}: ${filter.operator} ${formatDateInput(filter.values[0])}`;
  }

  return `${label}: ${filter.operator} ${filter.values.join(", ")}`;
}

export function CollectionFilters<TData>({ filterKey, filtersDef }: CollectionFiltersProps<TData>) {
  const [filters, setFilters] = useFilters(filterKey);
  const visibleColumns = filtersDef.filter((filterDef) => !filterDef.hidden);
  const addableColumns = visibleColumns.filter(
    (column) => !filters.some((filter) => filter.columnId === column.id),
  );
  const [selectedColumnId, setSelectedColumnId] = useState(addableColumns[0]?.id ?? "");

  const addFilter = () => {
    const column = visibleColumns.find((filterDef) => filterDef.id === selectedColumnId);

    if (!column) return;

    const filter = getDefaultFilter(column as ColumnConfig<unknown>);

    if (!filter) return;

    setFilters((currentFilters) => [...currentFilters, filter]);
  };

  const updateFilter = (nextFilter: FilterItem) => {
    setFilters((currentFilters) =>
      currentFilters.map((filter) =>
        filter.columnId === nextFilter.columnId ? nextFilter : filter,
      ),
    );
  };

  const removeFilter = (columnId: string) => {
    setFilters((currentFilters) => currentFilters.filter((filter) => filter.columnId !== columnId));
  };

  if (visibleColumns.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={selectedColumnId}
          onValueChange={(value) => setSelectedColumnId(value ?? "")}
        >
          <SelectTrigger size="sm" className="min-w-36">
            <SelectValue placeholder="Add filter" />
          </SelectTrigger>
          <SelectContent>
            {addableColumns.map((column) => (
              <SelectItem key={column.id} value={column.id}>
                {column.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          disabled={addableColumns.length === 0 || !selectedColumnId}
          onClick={addFilter}
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus className="size-3.5" />
          Filter
        </Button>
        {filters.length > 0 ? (
          <Button onClick={() => setFilters([])} size="sm" type="button" variant="ghost">
            Clear all
          </Button>
        ) : null}
      </div>
      {filters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((filter) => {
            const column = visibleColumns.find((filterDef) => filterDef.id === filter.columnId);

            return (
              <div key={filter.columnId} className="flex items-center gap-1">
                {filter.type === "option" || filter.type === "multiOption" ? (
                  <Select
                    value={filter.values[0] ?? ""}
                    onValueChange={(value) => {
                      if (value !== null) {
                        updateFilter({ ...filter, values: [value] });
                      }
                    }}
                  >
                    <SelectTrigger size="sm" className="min-w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {column?.options?.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {column.displayName}: {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : filter.type === "date" ? (
                  <InputDateFilter filter={filter} updateFilter={updateFilter} />
                ) : (
                  <Badge variant="secondary" className="gap-1 py-1">
                    {getFilterLabel(column as ColumnConfig<unknown> | undefined, filter)}
                  </Badge>
                )}
                <Button
                  aria-label={`Remove ${column?.displayName ?? filter.columnId} filter`}
                  onClick={() => removeFilter(filter.columnId)}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function InputDateFilter({
  filter,
  updateFilter,
}: {
  readonly filter: Extract<FilterItem, { type: "date" }>;
  readonly updateFilter: (filter: FilterItem) => void;
}) {
  return (
    <input
      className="h-7 rounded-lg border border-input bg-background px-2 text-sm"
      onChange={(event) => {
        const timestamp = new Date(`${event.target.value}T00:00:00`).getTime();

        if (Number.isFinite(timestamp)) {
          updateFilter({ ...filter, values: [timestamp] });
        }
      }}
      type="date"
      value={formatDateInput(filter.values[0])}
    />
  );
}
