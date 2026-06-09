/**
 * Small, pure helpers for the common optimistic list transforms (insert,
 * remove, reorder, replace-field) shared by the collection-list optimistic
 * updates. Each returns a new array, or the same reference when nothing changed
 * so callers can cheaply skip writing back.
 */

type WithId = { readonly id: string };

/** Append `item` to the list (used for optimistic create/add). */
export function appendItem<Item>(items: readonly Item[], item: Item): readonly Item[] {
  return [...items, item];
}

/** Remove the item with the given id. Returns the same reference if absent. */
export function removeById<Item extends WithId>(
  items: readonly Item[],
  id: string,
): readonly Item[] {
  if (!items.some((item) => item.id === id)) return items;
  return items.filter((item) => item.id !== id);
}

/** Remove the first item matching `predicate`. Same reference if none match. */
export function removeWhere<Item>(
  items: readonly Item[],
  predicate: (item: Item) => boolean,
): readonly Item[] {
  const index = items.findIndex(predicate);
  if (index === -1) return items;
  return [...items.slice(0, index), ...items.slice(index + 1)];
}

/**
 * Replace the item with the given id by applying `update`. Returns the same
 * reference when the item is absent or `update` returns the same reference.
 */
export function updateById<Item extends WithId>(
  items: readonly Item[],
  id: string,
  update: (item: Item) => Item,
): readonly Item[] {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return items;

  const updated = update(items[index]);
  if (updated === items[index]) return items;

  const next = [...items];
  next[index] = updated;
  return next;
}

/**
 * Reorder items to match `orderedIds`, assigning each a 0-based `sortOrder`.
 * Items not present in `orderedIds` keep their relative order at the end.
 * Returns the same reference when the ids don't cover the current items.
 */
export function reorderBySortOrder<Item extends WithId & { readonly sortOrder: number }>(
  items: readonly Item[],
  orderedIds: readonly string[],
): readonly Item[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  if (orderedIds.length !== items.length || orderedIds.some((id) => !byId.has(id))) {
    return items;
  }

  return orderedIds.map((id, index) => {
    const item = byId.get(id) as Item;
    return item.sortOrder === index ? item : { ...item, sortOrder: index };
  });
}
