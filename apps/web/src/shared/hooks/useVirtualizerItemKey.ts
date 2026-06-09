import { Array, Option, pipe } from "effect";
import { useCallback } from "react";

/**
 * Creates a memoized getItemKey function for useVirtualizer.
 * This prevents render loops caused by unstable getItemKey references.
 *
 * @param items - Array of items with an `id` property
 * @returns A stable callback that returns the item's id or falls back to the index
 */
export const useVirtualizerItemKey = <T extends { id: string }>(
  items: ReadonlyArray<T>,
): ((index: number) => string | number) =>
  useCallback(
    (index: number) =>
      pipe(
        items,
        Array.get(index),
        Option.match({
          onNone: () => index,
          onSome: (x) => x.id,
        }),
      ),
    [items],
  );
