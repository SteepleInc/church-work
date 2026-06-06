import type { Table as ReactTable } from "@tanstack/react-table";

import { DefaultCollectionCard } from "@/components/collections/defaultCollectionCard";
import { Button } from "@/components/ui/button";

type CollectionCardViewProps<TData> = {
  readonly table: ReactTable<TData>;
  readonly nextPage: () => void;
  readonly pageSize: number;
  readonly limit: number;
  readonly canLoadMore?: boolean;
  readonly loadingMore?: boolean;
};

export function CollectionCardView<TData>({
  table,
  nextPage,
  pageSize,
  limit,
  canLoadMore = false,
  loadingMore = false,
}: CollectionCardViewProps<TData>) {
  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card">
      <div className="grid gap-3 overflow-auto p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((row) => (
          <DefaultCollectionCard key={row.id} row={row} />
        ))}
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
