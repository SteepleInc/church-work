import type { CellContext, ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

export type RowActionsRenderer<TData> = (item: TData) => ReactNode;

export function createRowActionsColumn<TData>(
  rowActions: RowActionsRenderer<TData>,
): ColumnDef<TData> {
  return {
    cell: ({ row }: CellContext<TData, unknown>) => rowActions(row.original),
    enableHiding: false,
    enableSorting: false,
    header: "",
    id: "actions",
    maxSize: 48,
    minSize: 48,
    size: 48,
  };
}
