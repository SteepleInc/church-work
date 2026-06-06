import type { Column, Table as ReactTable } from "@tanstack/react-table";
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
import { cn } from "@/lib/utils";

type CollectionTableViewProps<TData> = {
  readonly table: ReactTable<TData>;
  readonly nextPage: () => void;
  readonly pageSize: number;
  readonly limit: number;
  readonly canLoadMore?: boolean;
  readonly loadingMore?: boolean;
};

function getPinnedStyles<TData>(column: Column<TData>) {
  const pinned = column.getIsPinned();

  if (!pinned) {
    return undefined;
  }

  return {
    [pinned]: `${column.getStart(pinned)}px`,
  };
}

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
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const pinned = header.column.getIsPinned();

                  return (
                    <TableHead
                      className={cn(
                        pinned && "sticky z-20 bg-card shadow-sm",
                        pinned === "left" && "left-0",
                        pinned === "right" && "right-0",
                      )}
                      key={header.id}
                      style={{
                        minWidth: header.getSize(),
                        width: header.getSize(),
                        ...getPinnedStyles(header.column),
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow data-state={row.getIsSelected() && "selected"} key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const pinned = cell.column.getIsPinned();

                    return (
                      <TableCell
                        className={cn(
                          pinned && "sticky z-10 bg-card shadow-sm",
                          pinned === "left" && "left-0",
                          pinned === "right" && "right-0",
                        )}
                        key={cell.id}
                        style={{
                          minWidth: cell.column.getSize(),
                          width: cell.column.getSize(),
                          ...getPinnedStyles(cell.column),
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
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
      </div>
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
