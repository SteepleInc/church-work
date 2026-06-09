import {
  type ColumnDef,
  type ColumnPinningState,
  type OnChangeFn,
  type SortingState,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { useState } from "react";

export function useCreateTable<TData>(params: {
  readonly columnsDef: Array<ColumnDef<TData>>;
  readonly data: Array<TData>;
  readonly columnPinning?: ColumnPinningState;
  readonly sorting?: SortingState;
  readonly onSortingChange?: OnChangeFn<SortingState>;
}) {
  const { columnsDef, data, columnPinning, sorting = [], onSortingChange } = params;
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ id: false });

  return useReactTable<TData>({
    columnResizeDirection: "ltr",
    columnResizeMode: "onChange",
    columns: columnsDef,
    data,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { columnPinning },
    manualPagination: true,
    manualSorting: true,
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange,
    state: { columnVisibility, sorting },
  });
}
