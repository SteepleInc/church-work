import {
  type ColumnDef,
  type ColumnPinningState,
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
}) {
  const { columnsDef, data, columnPinning } = params;
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
    onColumnVisibilityChange: setColumnVisibility,
    state: { columnVisibility },
  });
}
