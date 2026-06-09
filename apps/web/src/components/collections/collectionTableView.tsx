/** biome-ignore-all lint/suspicious/noExplicitAny: lib code */
"use client";

import { noOp, nullOp } from "@church-task/shared/noOps";
import type { Column, Row, Table } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { Array, Boolean, Option, pipe, Record } from "effect";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";

import { ChevronRightIcon } from "@/components/icons/chevronRightIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Table as TableWrapper,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useVirtualizerItemKey } from "@/shared/hooks/useVirtualizerItemKey";

/**
 * Get CSS styles for pinned columns.
 * Uses sticky positioning with calculated left/right offsets.
 */
const getColumnPinningStyles = <TData,>(column: Column<TData>): CSSProperties => {
  const isPinned = column.getIsPinned();

  return {
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    position: isPinned ? "sticky" : "relative",
    right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    zIndex: isPinned ? 1 : 0,
  };
};

/**
 * Get className for pinned column styling including gradient shadow.
 * The gradient mimics the ScrollArea mask effect.
 * Shadow visibility is controlled via CSS variables:
 * - --pinned-shadow-opacity-left for left-pinned columns
 * - --pinned-shadow-opacity-right for right-pinned columns
 */
const getColumnPinningClassName = <TData,>(column: Column<TData>): string => {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn = isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinnedColumn = isPinned === "right" && column.getIsFirstColumn("right");

  if (!isPinned) {
    return "";
  }

  return cn(
    "bg-background transition-colors group-hover/row:bg-[color-mix(in_oklab,var(--muted)_50%,var(--background))] group-data-[state=selected]/row:bg-muted",
    // Add gradient shadow for the last left-pinned column
    // Opacity is controlled by --pinned-shadow-opacity-left CSS variable set on the table
    // The opacity transitions smoothly based on scroll position (0-30px maps to 0-1)
    isLastLeftPinnedColumn && [
      "relative",
      "after:pointer-events-none after:absolute after:inset-y-0 after:right-0.5 after:w-[30px] after:translate-x-full after:bg-gradient-to-r after:from-black/15 after:to-transparent after:opacity-(--pinned-shadow-opacity-left) after:content-[''] dark:after:from-black/40",
    ],
    // Add gradient shadow for the first right-pinned column (mirrored)
    // Opacity is controlled by --pinned-shadow-opacity-right CSS variable set on the table
    isFirstRightPinnedColumn && [
      "relative",
      "before:pointer-events-none before:absolute before:inset-y-0 before:left-0.5 before:w-[30px] before:-translate-x-full before:bg-gradient-to-l before:from-black/15 before:to-transparent before:opacity-(--pinned-shadow-opacity-right) before:content-[''] dark:before:from-black/40",
    ],
  );
};

type CollectionTableViewProps<TData> = {
  table: Table<TData>;
  nextPage: () => void;
  pageSize: number;
  limit: number;
};

export const CollectionTableView = <TData,>(props: CollectionTableViewProps<TData>): ReactNode => {
  // eslint-disable-next-line react-compiler/react-compiler
  "use no memo";

  const { table, pageSize, nextPage, limit } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const SHADOW_WIDTH = 30;

  /**
   * Instead of calling `column.getSize()` on every render for every header
   * and especially every data cell (very expensive),
   * we will calculate all column sizes at once at the root table level in a useMemo
   * and pass the column sizes down as CSS variables to the <table> element.
   */

  // biome-ignore lint/correctness/useExhaustiveDependencies: lib code
  const columnSizeVars = useMemo(
    () =>
      pipe(
        table.getFlatHeaders(),
        Array.flatMap((header) => [
          [`--header-${header.id}-size`, header.getSize()] as const,
          [`--col-${header.column.id}-size`, header.column.getSize()] as const,
        ]),
        Record.fromEntries,
      ),
    [table.getFlatHeaders(), table.getState().columnSizingInfo, table.getState().columnSizing],
  );

  // Get the rows as a const here instead of piping it from the table.
  // This is so that we can later virtualize the table and have the rows
  // at a different point in memory for lookup.
  const { rows } = table.getRowModel();

  const getItemKey = useVirtualizerItemKey(rows);

  // Create a virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    // adjust estimateSize to increase rendered items
    estimateSize: () => 54, // estimate row height for accurate scrollbar dragging
    getItemKey,
    getScrollElement: () => containerRef.current,
    overscan: 10,
    scrollPaddingEnd: 54,
    scrollPaddingStart: 54,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Track horizontal scroll to gradually show pinned column shadows
  // Updates CSS variables directly on the DOM to avoid re-renders
  const updatePinnedShadowOpacity = useCallback(() => {
    const scrollElement = containerRef.current;
    const tableElement = tableRef.current;
    if (!(scrollElement && tableElement)) {
      return;
    }

    // Left shadow: opacity based on scroll from left edge (0-30px maps to 0-1)
    const leftOpacity = Math.min(scrollElement.scrollLeft / SHADOW_WIDTH, 1);
    tableElement.style.setProperty("--pinned-shadow-opacity-left", String(leftOpacity));

    // Right shadow: opacity based on scroll from right edge
    // Calculate how far we are from the maximum scroll position
    const maxScrollLeft = scrollElement.scrollWidth - scrollElement.clientWidth;
    const distanceFromRight = maxScrollLeft - scrollElement.scrollLeft;
    const rightOpacity = Math.min(distanceFromRight / SHADOW_WIDTH, 1);
    tableElement.style.setProperty("--pinned-shadow-opacity-right", String(rightOpacity));
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    // Update shadows on scroll
    element.addEventListener("scroll", updatePinnedShadowOpacity, { signal });

    // Also update shadows when container size changes (e.g., details pane opens/closes)
    const resizeObserver = new ResizeObserver(updatePinnedShadowOpacity);
    resizeObserver.observe(element);

    updatePinnedShadowOpacity();

    return () => {
      controller.abort();
      resizeObserver.disconnect();
    };
  }, [updatePinnedShadowOpacity]);

  useEffect(() => {
    pipe(
      virtualItems,
      Array.last,
      Option.filter((lastItem) => lastItem.index >= limit - pageSize / 4),
      Option.match({
        onNone: noOp,
        onSome: () => nextPage(),
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualItems, pageSize, limit, nextPage]);

  return (
    <TableWrapper
      maskClassName="before:hidden"
      scrollAreaClassName="pl-4"
      scrollAreaViewportRef={containerRef}
      style={{ ...columnSizeVars } as CSSProperties}
      tableRef={tableRef}
    >
      <TableHeader className="sticky top-0 z-1 grid">
        {pipe(
          table.getHeaderGroups(),
          Array.map((x) => (
            <TableRow className="flex w-full" key={x.id}>
              {pipe(
                x.headers,
                Array.map((y) => (
                  <TableHead
                    className={cn("flex items-center", getColumnPinningClassName(y.column))}
                    key={y.id}
                    style={{
                      width: `calc(var(--header-${y.id}-size) * 1px)`,
                      ...getColumnPinningStyles(y.column),
                    }}
                  >
                    {pipe(
                      // We don't want to render the header for the actions column.
                      y.id !== "actions",
                      Boolean.match({
                        onFalse: nullOp,
                        onTrue: () => (
                          <>
                            {pipe(
                              y.isPlaceholder,
                              Boolean.match({
                                onFalse: () =>
                                  flexRender(y.column.columnDef.header, y.getContext()),
                                onTrue: nullOp,
                              }),
                            )}

                            {/** biome-ignore lint/a11y/noNoninteractiveElementInteractions: lib code */}
                            {/** biome-ignore lint/a11y/noStaticElementInteractions: lib code */}
                            <div
                              className={cn(
                                "my-1 -mr-2 ml-auto w-1 cursor-col-resize touch-none select-none place-self-stretch rounded-sm bg-border/60 hover:bg-primary",
                                y.column.getIsResizing() && "bg-primary opacity-1",
                              )}
                              onDoubleClick={() => y.column.resetSize()}
                              onMouseDown={y.getResizeHandler()}
                              onTouchStart={y.getResizeHandler()}
                            />
                          </>
                        ),
                      }),
                    )}
                  </TableHead>
                )),
              )}
            </TableRow>
          )),
        )}
      </TableHeader>
      <TableBody
        className="relative grid"
        style={{
          height: `${pipe(
            rowVirtualizer.getTotalSize() === 0,
            Boolean.match({
              onFalse: () => rowVirtualizer.getTotalSize(),
              onTrue: () => "auto",
            }),
          )}px`, // Tells scrollbar how big the table is
        }}
      >
        {pipe(
          virtualItems,
          Array.match({
            onEmpty: () => (
              <TableRow className="flex h-24 justify-center p-5">
                <TableCell className="h24 flex text-center">No results.</TableCell>
              </TableRow>
            ),
            onNonEmpty: (x) =>
              pipe(
                x,
                Array.filterMap((virtualRow) =>
                  pipe(
                    rows,
                    Array.get(virtualRow.index),
                    Option.map((y) => (
                      <Row
                        key={y.id}
                        ref={rowVirtualizer.measureElement}
                        row={y}
                        virtualRow={virtualRow}
                      />
                    )),
                  ),
                ),
              ),
          }),
        )}
      </TableBody>
    </TableWrapper>
  );
};

type RowProps = Omit<ComponentProps<"tr">, "onClick" | "children"> & {
  virtualRow: VirtualItem;
  row: Row<any>;
};

// biome-ignore lint/suspicious/noRedeclare: lib code
const Row = memo<RowProps>((props) => {
  const { virtualRow, row, ...domProps } = props;

  return (
    <tr
      className={cn(
        "group/row absolute flex w-full border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        pipe(
          row.getCanExpand(),
          Boolean.match({
            onFalse: () => "",
            onTrue: () => "cursor-pointer select-none",
          }),
        ),
      )}
      data-index={virtualRow.index}
      data-state={row.getIsSelected() && "selected"}
      key={row.id}
      // @ts-expect-error effect Boolean.match returns a union of handlers
      onClick={pipe(
        row.getIsGrouped(),
        Boolean.match({
          onFalse: noOp,
          onTrue: row.getToggleExpandedHandler,
        }),
      )}
      style={{
        transform: `translateY(${virtualRow.start}px)`, // This should always be a `style` as it changes on scroll
      }}
      {...domProps}
    >
      {pipe(
        row.getVisibleCells(),
        Array.map((z) => (
          <TableCell
            className={cn(
              "group/cell flex min-w-0 items-center",
              getColumnPinningClassName(z.column),
            )}
            key={z.id}
            style={{
              width: `calc(var(--col-${z.column.id}-size) * 1px)`,
              ...getColumnPinningStyles(z.column),
            }}
          >
            <div className="min-w-0 flex-1 truncate">
              {pipe(
                // If it's a grouped cell, add an expander and row count
                z.getIsGrouped(),
                Boolean.match({
                  onFalse: () =>
                    pipe(
                      z.getIsAggregated(),
                      Boolean.match({
                        onFalse: () =>
                          // Otherwise, just render the regular cell
                          flexRender(z.column.columnDef.cell, z.getContext()),
                        onTrue: () =>
                          // If the cell is aggregated, use the Aggregated
                          // renderer for cell
                          flexRender(
                            z.column.columnDef.aggregatedCell ?? z.column.columnDef.cell,
                            z.getContext(),
                          ),
                      }),
                    ),
                  onTrue: () => (
                    <div className="-ml-2 flex flex-row items-center gap-2">
                      <Button size="icon-xs" variant="ghost">
                        <ChevronRightIcon
                          className={cn(
                            "transform-gpu transition-transform",
                            pipe(
                              row.getIsExpanded(),
                              Boolean.match({
                                onFalse: () => "rotate-0",
                                onTrue: () => "rotate-90",
                              }),
                            ),
                          )}
                        />
                      </Button>
                      {flexRender(z.column.columnDef.cell, z.getContext())}
                      <Badge variant="secondary">{row.subRows.length}</Badge>
                    </div>
                  ),
                }),
              )}
            </div>
          </TableCell>
        )),
      )}
    </tr>
  );
});
Row.displayName = "Row";
