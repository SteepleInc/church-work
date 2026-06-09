import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export type CollectionTags = "orgs" | "users" | "default";

type ColumnHeaderProps<T> = {
  readonly column: Column<T>;
  readonly children?: ReactNode;
};

export function ColumnHeader<T extends object>({ column, children }: ColumnHeaderProps<T>) {
  const sortDirection = column.getIsSorted();
  const canSort = column.getCanSort();

  return (
    <Button
      className="-ml-1 px-1"
      disabled={!canSort}
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      size="sm"
      type="button"
      variant="ghost"
    >
      {children}
      {!canSort ? null : sortDirection === "asc" ? (
        <ArrowUp />
      ) : sortDirection === "desc" ? (
        <ArrowDown />
      ) : (
        <ChevronsUpDown />
      )}
    </Button>
  );
}
