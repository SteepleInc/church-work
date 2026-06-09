"use client";

import { noOp, nullOp } from "@church-task/shared/noOps";
import type { Row, Table } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Array, Boolean, Option, pipe } from "effect";
import type { ComponentRef, ElementType, ReactElement, ReactNode, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { DefaultCollectionCard } from "@/components/collections/defaultCollectionCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useElementSize } from "@/shared/hooks/useElementSize";
import {
  useIsLgScreen,
  useIsMdScreen,
  useIsSmScreen,
  useIsXlScreen,
} from "@/shared/hooks/use-media-query";

export type CollectionCardComponent<T, E extends ElementType> = (props: {
  row: Row<T>;
  ref?: RefObject<ComponentRef<E>>;
}) => ReactElement;

type CollectionCardViewProps<TData, E extends ElementType> = {
  table: Table<TData>;
  CollectionCard?: CollectionCardComponent<TData, E>;
  rowSize?: number;
  nextPage: () => void;
  pageSize: number;
  limit: number;
};

const getRowSize = (params: {
  isSmScreen: boolean;
  isMdScreen: boolean;
  isLgScreen: boolean;
  isXlScreen: boolean;
  width?: number;
  fixedRowSize?: number;
}) => {
  const { isMdScreen, isLgScreen, isXlScreen, width, fixedRowSize, isSmScreen } = params;

  return pipe(
    fixedRowSize,
    Option.fromNullable,
    Option.match({
      onNone: () =>
        pipe(
          width,
          Option.fromNullable,
          Option.match({
            onNone: () => {
              if (isXlScreen) {
                return 5;
              }

              if (isLgScreen) {
                return 4;
              }

              if (isMdScreen) {
                return 3;
              }

              if (isSmScreen) {
                return 2;
              }

              return 1;
            },
            onSome: (x) => {
              if (x < 332) {
                return 1;
              }

              return Math.floor((x - 32) / 306);
            },
          }),
        ),
      onSome: (size) => size,
    }),
  );
};

export const CollectionCardView = <TData, E extends ElementType>(
  props: CollectionCardViewProps<TData, E>,
): ReactNode => {
  // eslint-disable-next-line react-compiler/react-compiler
  "use no memo";

  const {
    table,
    CollectionCard = DefaultCollectionCard,
    rowSize,
    nextPage,
    pageSize,
    limit,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);

  const { width } = useElementSize(containerRef);

  // Get the rows as a const here instead of piping it from the table.
  const { rows } = table.getRowModel();

  const isSmScreen = useIsSmScreen();
  const isMdScreen = useIsMdScreen();
  const isLgScreen = useIsLgScreen();
  const isXlScreen = useIsXlScreen();

  const computedRowSize = useMemo(
    () =>
      getRowSize({
        fixedRowSize: rowSize,
        isLgScreen,
        isMdScreen,
        isSmScreen,
        isXlScreen,
        width,
      }),
    [isSmScreen, isMdScreen, isLgScreen, isXlScreen, width, rowSize],
  );

  const rowChunks = useMemo(
    () => pipe(rows, Array.chunksOf(computedRowSize)),
    [rows, computedRowSize],
  );

  // Use rows directly - each chunk's key is the first row's id in that chunk
  // Index into rows at chunk boundaries: index * computedRowSize
  const getItemKey = useCallback(
    (index: number) =>
      pipe(
        rows,
        Array.get(index * computedRowSize),
        Option.match({
          onNone: () => index,
          onSome: (x) => x.id,
        }),
      ),
    [rows, computedRowSize],
  );

  // Create a virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rowChunks.length,
    estimateSize: () => 268,
    gap: 16,
    getItemKey,
    getScrollElement: () => containerRef.current,
    overscan: 3,
    paddingEnd: 16,
    paddingStart: 16,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    pipe(
      virtualItems,
      Array.last,
      Option.filter((lastItem) => lastItem.index * computedRowSize >= limit - pageSize / 4),
      Option.match({
        onNone: noOp,
        onSome: () => nextPage(),
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualItems, pageSize, computedRowSize, limit, nextPage]);

  return (
    <ScrollArea className="w-full flex-1" scrollAreaViewportRef={containerRef}>
      <div
        className="relative flex flex-col overflow-hidden"
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
            onEmpty: nullOp,
            onNonEmpty: (x) =>
              pipe(
                x,
                Array.filterMap((virtualRow) =>
                  pipe(
                    rowChunks,
                    Array.get(virtualRow.index),
                    Option.map((y) => (
                      <div
                        className="absolute right-0 left-0 grid w-full gap-3 px-4"
                        data-index={virtualRow.index}
                        key={virtualRow.key}
                        ref={rowVirtualizer.measureElement}
                        style={{
                          gridTemplateColumns: `repeat(${computedRowSize}, minmax(0, 1fr))`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        {pipe(
                          y,
                          Array.map((z) => <CollectionCard key={z.id} row={z} />),
                        )}
                      </div>
                    )),
                  ),
                ),
              ),
          }),
        )}
      </div>
    </ScrollArea>
  );
};
