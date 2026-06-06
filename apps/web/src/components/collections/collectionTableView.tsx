import type { Table as ReactTable } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CollectionTableViewProps<TData> = {
  readonly table: ReactTable<TData>;
  readonly nextPage: () => void;
  readonly pageSize: number;
  readonly limit: number;
  readonly canLoadMore?: boolean;
  readonly loadingMore?: boolean;
};

export function CollectionTableView<TData>({
  table,
  nextPage,
  pageSize,
  limit,
  canLoadMore = false,
  loadingMore = false,
}: CollectionTableViewProps<TData>) {
  const rows = table.getRowModel().rows;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} style={{ width: header.getSize() }}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow data-state={row.getIsSelected() && "selected"} key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell className="h-24 text-center" colSpan={table.getAllColumns().length}>
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between border-t px-3 py-2 text-muted-foreground text-sm">
        <span>
          Showing {rows.length} of {Math.max(limit, rows.length)} loaded
        </span>
        <Button
          disabled={!canLoadMore || loadingMore}
          loading={loadingMore}
          onClick={nextPage}
          size="sm"
          type="button"
          variant="outline"
        >
          {canLoadMore ? `Load ${pageSize} more` : "All results loaded"}
        </Button>
      </div>
    </div>
  );
}
