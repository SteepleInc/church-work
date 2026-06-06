import type { ColumnDef, ColumnPinningState } from "@tanstack/react-table";
import { useMemo, type ReactNode } from "react";

import { CollectionTableView } from "@/components/collections/collectionTableView";
import type { CollectionTags } from "@/components/collections/collectionComponents";
import { useCreateTable } from "@/components/collections/useCreateTable";
import type { ColumnConfig } from "@/components/data-table-filter/core/types";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export type CollectionColumnDef<TItem> = {
  readonly id: string;
  readonly header: string;
  readonly cell: (item: TItem) => ReactNode;
  readonly className?: string;
};

export type CollectionProps<TItem> = {
  readonly _tag: CollectionTags;
  readonly Actions?: ReactNode;
  readonly canLoadMore?: boolean;
  readonly columnPinning?: ColumnPinningState;
  readonly columnsDef: ReadonlyArray<ColumnDef<TItem> | CollectionColumnDef<TItem>>;
  readonly data: readonly TItem[];
  readonly emptyState?: ReactNode;
  readonly filterColumnId: string;
  readonly filterKey: string;
  readonly filterPlaceHolder: string;
  readonly filtersDef?: ReadonlyArray<ColumnConfig<TItem> | unknown>;
  readonly getRowKey?: (item: TItem) => string;
  readonly getRowLabel?: (item: TItem) => string;
  readonly limit?: number;
  readonly loading?: boolean;
  readonly loadingMore?: boolean;
  readonly nextPage?: () => void;
  readonly noResultsState?: ReactNode;
  readonly pageSize?: number;
};

function isLegacyColumnDef<TItem>(
  columnDef: ColumnDef<TItem> | CollectionColumnDef<TItem>,
): columnDef is CollectionColumnDef<TItem> {
  return (
    "cell" in columnDef &&
    typeof columnDef.cell === "function" &&
    typeof columnDef.header === "string"
  );
}

function toTanStackColumnDef<TItem>(
  columnDef: ColumnDef<TItem> | CollectionColumnDef<TItem>,
): ColumnDef<TItem> {
  if (!isLegacyColumnDef(columnDef)) {
    return columnDef;
  }

  return {
    cell: ({ row }) => <span className={columnDef.className}>{columnDef.cell(row.original)}</span>,
    header: columnDef.header,
    id: columnDef.id,
  };
}

export function Collection<TItem>({
  Actions,
  canLoadMore = false,
  columnPinning,
  columnsDef,
  data,
  emptyState,
  filtersDef = [],
  limit,
  loading = false,
  loadingMore = false,
  nextPage,
  noResultsState,
  pageSize,
}: CollectionProps<TItem>) {
  const normalizedColumnsDef = useMemo(
    () => columnsDef.map((columnDef) => toTanStackColumnDef(columnDef)),
    [columnsDef],
  );
  const table = useCreateTable({
    columnPinning,
    columnsDef: normalizedColumnsDef,
    data: [...data],
  });
  const hasActiveFilters = filtersDef.length > 0;

  if (loading) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex min-h-48 items-center justify-center rounded-xl border bg-card text-muted-foreground text-sm">
          Loading...
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        {Actions ? (
          <div className="-mt-1 mb-2 flex items-center gap-2 pt-1 md:mr-4 md:mb-4">{Actions}</div>
        ) : null}
        {hasActiveFilters
          ? (noResultsState ?? (
              <Empty className="min-h-48">
                <EmptyHeader>
                  <EmptyTitle>No records found</EmptyTitle>
                  <EmptyDescription>Clear filters to see every matching record.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ))
          : (emptyState ?? (
              <Empty className="min-h-48">
                <EmptyHeader>
                  <EmptyTitle>No Churches yet</EmptyTitle>
                  <EmptyDescription>There are no Churches to administer.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ))}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {Actions ? (
        <div className="-mt-1 mb-2 flex items-center gap-2 pt-1 md:mr-4 md:mb-4">{Actions}</div>
      ) : null}
      <CollectionTableView
        canLoadMore={canLoadMore}
        limit={limit ?? data.length}
        loadingMore={loadingMore}
        nextPage={nextPage ?? (() => {})}
        pageSize={pageSize ?? data.length}
        table={table}
      />
    </div>
  );
}
