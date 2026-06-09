import type { ColumnDef, ColumnPinningState, SortingState } from "@tanstack/react-table";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { CollectionCardView } from "@/components/collections/collectionCardView";
import { CollectionTableView } from "@/components/collections/collectionTableView";
import type { CollectionTags } from "@/components/collections/collectionComponents";
import { CollectionToolbar } from "@/components/collections/collectionToolbar";
import {
  createRowActionsColumn,
  type RowActionsRenderer,
} from "@/components/collections/rowActions";
import { useCreateTable } from "@/components/collections/useCreateTable";
import type { ColumnConfig } from "@/components/data-table-filter/core/types";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useAtomValue } from "jotai";
import { collectionViewsAtom, getCollectionView } from "@/shared/global-state";
import { useFiltersValue, useSorting } from "@/shared/hooks/useFilters";

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
  readonly filterKey: Parameters<typeof useSorting>[0];
  readonly filterPlaceHolder: string;
  readonly filtersDef?: ReadonlyArray<ColumnConfig<TItem> | unknown>;
  readonly getRowKey?: (item: TItem) => string;
  readonly getRowLabel?: (item: TItem) => string;
  readonly limit?: number;
  readonly loading?: boolean;
  readonly loadingMore?: boolean;
  readonly nextPage?: () => void;
  readonly noResultsState?: ReactNode;
  readonly onRowClick?: (item: TItem) => void;
  readonly pageSize?: number;
  readonly rowActions?: RowActionsRenderer<TItem>;
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
  _tag,
  Actions,
  canLoadMore = false,
  columnPinning,
  columnsDef,
  data,
  emptyState,
  filterKey,
  filterColumnId,
  filterPlaceHolder,
  filtersDef = [],
  limit,
  loading = false,
  loadingMore = false,
  nextPage,
  noResultsState,
  onRowClick,
  pageSize,
  rowActions,
}: CollectionProps<TItem>) {
  const collectionViews = useAtomValue(collectionViewsAtom);
  const persistedView = getCollectionView(collectionViews, _tag);
  const forceCards = useForceCardsView();
  const currentView = forceCards ? "cards" : persistedView;
  const [sorting, setSorting] = useSorting(filterKey);
  const filters = useFiltersValue(filterKey);
  const normalizedColumnsDef = useMemo(() => {
    const columns = columnsDef.map((columnDef) => toTanStackColumnDef(columnDef));

    return rowActions ? [...columns, createRowActionsColumn(rowActions)] : columns;
  }, [columnsDef, rowActions]);
  const normalizedColumnPinning = useMemo(
    () =>
      rowActions
        ? {
            ...columnPinning,
            right: Array.from(new Set([...(columnPinning?.right ?? []), "actions"])),
          }
        : columnPinning,
    [columnPinning, rowActions],
  );
  const tableData = useMemo(() => [...data], [data]);
  const table = useCreateTable({
    columnPinning: normalizedColumnPinning,
    columnsDef: normalizedColumnsDef,
    data: tableData,
    onSortingChange: (updaterOrValue) => {
      if (typeof updaterOrValue === "function") {
        setSorting((previous) => updaterOrValue(previous as SortingState));
        return;
      }

      setSorting(updaterOrValue);
    },
    sorting: sorting as SortingState,
  });
  const hasActiveFilters = filters.length > 0;

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
        <CollectionToolbar
          _tag={_tag}
          Actions={Actions}
          data={data}
          filterColumnId={filterColumnId}
          filterKey={filterKey}
          filterPlaceHolder={filterPlaceHolder}
          filtersDef={filtersDef as ReadonlyArray<ColumnConfig<TItem>>}
          table={table}
        />
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
      <CollectionToolbar
        _tag={_tag}
        Actions={Actions}
        data={data}
        filterColumnId={filterColumnId}
        filterKey={filterKey}
        filterPlaceHolder={filterPlaceHolder}
        filtersDef={filtersDef as ReadonlyArray<ColumnConfig<TItem>>}
        table={table}
      />
      {currentView === "cards" ? (
        <CollectionCardView
          canLoadMore={canLoadMore}
          limit={limit ?? data.length}
          loadingMore={loadingMore}
          nextPage={nextPage ?? (() => {})}
          onRowClick={onRowClick}
          pageSize={pageSize ?? data.length}
          table={table}
        />
      ) : (
        <CollectionTableView
          canLoadMore={canLoadMore}
          limit={limit ?? data.length}
          loadingMore={loadingMore}
          nextPage={nextPage ?? (() => {})}
          onRowClick={onRowClick}
          pageSize={pageSize ?? data.length}
          table={table}
        />
      )}
    </div>
  );
}

function useForceCardsView() {
  const [forceCards, setForceCards] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const update = () => setForceCards(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);

    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return forceCards;
}
