/** biome-ignore-all lint/suspicious/noExplicitAny: lib code */
"use client";

import type { ColumnDef, ColumnPinningState, SortingState } from "@tanstack/react-table";
import { Array, Option, pipe } from "effect";
import { useAtom } from "jotai";
import { type ReactNode, useCallback, useMemo } from "react";

import { CollectionCardView } from "@/components/collections/collectionCardView";
import type { CollectionTags } from "@/components/collections/collectionComponents";
import { CollectionTableView } from "@/components/collections/collectionTableView";
import { CollectionToolbar } from "@/components/collections/collectionToolbar";
import {
  createRowActionsColumn,
  type RowActionsRenderer,
} from "@/components/collections/rowActions";
import { useCreateTable } from "@/components/collections/useCreateTable";
import { Divider } from "@/components/ui/divider";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  collectionViewMatch,
  collectionViewsAtom,
  type FilterKeys,
  getCollectionView,
} from "@/shared/global-state";
import { useFiltersValue, useSorting } from "@/shared/hooks/useFilters";
import { useIsMdScreen } from "@/shared/hooks/use-media-query";

type CollectionProps<TData> = {
  filterPlaceHolder: string;
  filterColumnId: string;
  Actions?: ReactNode;
  emptyState?: ReactNode;
  noResultsState?: ReactNode;
  _tag: CollectionTags;
  rowSize?: number;
  filterKey: FilterKeys;
  columnsDef: Array<ColumnDef<TData>>;
  columnPinning?: ColumnPinningState;
  data: ReadonlyArray<TData>;
  loading?: boolean;
  nextPage: () => void;
  pageSize: number;
  limit: number;
  /**
   * Optional render function for row actions.
   * When provided, an actions column is automatically added and pinned to the right.
   */
  rowActions?: RowActionsRenderer<TData>;
};

export const Collection = <TData,>(props: CollectionProps<TData>): ReactNode => {
  // eslint-disable-next-line react-compiler/react-compiler
  "use no memo";

  const {
    filterColumnId,
    filterPlaceHolder,
    Actions,
    emptyState,
    noResultsState,
    _tag,
    rowSize,
    filterKey,
    columnsDef,
    columnPinning,
    data,
    loading,
    nextPage,
    pageSize,
    limit,
    rowActions,
  } = props;

  // If rowActions is provided, add the actions column to the column definitions
  const enhancedColumnsDef = useMemo(
    () =>
      pipe(
        rowActions,
        Option.fromNullable,
        Option.match({
          onNone: () => columnsDef,
          onSome: (renderActions) => [...columnsDef, createRowActionsColumn(renderActions)],
        }),
      ),
    [columnsDef, rowActions],
  );

  // If rowActions is provided, pin the actions column to the right
  const enhancedColumnPinning = useMemo(
    (): ColumnPinningState =>
      pipe(
        rowActions,
        Option.fromNullable,
        Option.match({
          onNone: () => columnPinning ?? {},
          onSome: () => ({
            ...columnPinning,
            right: [...(columnPinning?.right ?? []), "actions"],
          }),
        }),
      ),
    [columnPinning, rowActions],
  );

  // Get sorting state from URL (stored alongside filters under the same filterKey)
  const [sorting, setSorting] = useSorting(filterKey);

  // Adapter to convert TanStack Table's SortingState updater to our URL-based setter
  const onSortingChange = useCallback(
    (updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
      if (typeof updaterOrValue === "function") {
        setSorting((prev) => updaterOrValue(prev as SortingState));
      } else {
        setSorting(updaterOrValue);
      }
    },
    [setSorting],
  );

  const tableData = useMemo(() => [...data], [data]);

  const table = useCreateTable({
    columnPinning: enhancedColumnPinning,
    columnsDef: enhancedColumnsDef,
    data: tableData,
    onSortingChange,
    sorting: sorting as SortingState,
  });

  const [collectionViews] = useAtom(collectionViewsAtom);
  const isMdScreen = useIsMdScreen();

  // Force cards view on small screens, otherwise use the stored preference
  const collectionView = isMdScreen ? getCollectionView(collectionViews, _tag) : "cards";

  // Read URL filters to determine if we have any active filters
  const urlFilters = useFiltersValue(filterKey);

  // Check if there are any active filters (search or otherwise)
  const hasActiveFilters = pipe(urlFilters, Array.isNonEmptyReadonlyArray);

  // Determine which content to show when data is empty
  const getEmptyContent = (): ReactNode | null => {
    if (loading || data.length > 0) {
      return null;
    }
    if (hasActiveFilters) {
      return (
        noResultsState ?? (
          <Empty className="min-h-48">
            <EmptyHeader>
              <EmptyTitle>No records found</EmptyTitle>
              <EmptyDescription>Clear filters to see every matching record.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )
      );
    }
    return emptyState ?? null;
  };

  const emptyContent = getEmptyContent();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <CollectionToolbar<TData>
        _tag={_tag}
        Actions={Actions}
        // We do this negative margin top and padding top because of shadows in components for active states that exist
        // within it that get clipped.
        className="-mt-1 mb-2 pt-1 md:mr-4 md:mb-4"
        data={data}
        filterColumnId={filterColumnId}
        filterKey={filterKey}
        filterPlaceHolder={filterPlaceHolder}
        table={table}
      />

      {emptyContent ??
        pipe(
          collectionView,
          collectionViewMatch({
            cards: () => (
              <>
                <Divider variant="page" />

                <CollectionCardView
                  limit={limit}
                  nextPage={nextPage}
                  pageSize={pageSize}
                  rowSize={rowSize}
                  table={table}
                />
              </>
            ),
            table: () => (
              <CollectionTableView
                limit={limit}
                nextPage={nextPage}
                pageSize={pageSize}
                table={table}
              />
            ),
          }),
        )}
    </div>
  );
};
