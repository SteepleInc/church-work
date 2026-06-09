import { describe, expect, test } from "bun:test";

import {
  appendItem,
  removeById,
  removeWhere,
  reorderBySortOrder,
  updateById,
} from "./collection-ops";

type Item = { readonly id: string; readonly name: string; readonly sortOrder: number };

const items: readonly Item[] = [
  { id: "a", name: "A", sortOrder: 0 },
  { id: "b", name: "B", sortOrder: 1 },
  { id: "c", name: "C", sortOrder: 2 },
];

describe("appendItem", () => {
  test("adds the item to the end", () => {
    const next = appendItem(items, { id: "d", name: "D", sortOrder: 3 });
    expect(next.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("removeById", () => {
  test("drops the matching item", () => {
    expect(removeById(items, "b").map((item) => item.id)).toEqual(["a", "c"]);
  });

  test("returns the same reference when the id is absent", () => {
    expect(removeById(items, "missing")).toBe(items);
  });
});

describe("removeWhere", () => {
  test("drops the first item matching the predicate", () => {
    expect(removeWhere(items, (item) => item.name === "C").map((item) => item.id)).toEqual([
      "a",
      "b",
    ]);
  });

  test("returns the same reference when nothing matches", () => {
    expect(removeWhere(items, () => false)).toBe(items);
  });
});

describe("updateById", () => {
  test("applies the update to the matching item", () => {
    const next = updateById(items, "b", (item) => ({ ...item, name: "renamed" }));
    expect(next.find((item) => item.id === "b")?.name).toBe("renamed");
  });

  test("returns the same reference when the id is absent", () => {
    expect(updateById(items, "missing", (item) => item)).toBe(items);
  });

  test("returns the same reference when the update is a no-op", () => {
    expect(updateById(items, "b", (item) => item)).toBe(items);
  });
});

describe("reorderBySortOrder", () => {
  test("reorders items and reassigns sortOrder by position", () => {
    const next = reorderBySortOrder(items, ["c", "a", "b"]);
    expect(next.map((item) => [item.id, item.sortOrder])).toEqual([
      ["c", 0],
      ["a", 1],
      ["b", 2],
    ]);
  });

  test("returns the same reference when ids do not cover the items", () => {
    expect(reorderBySortOrder(items, ["a", "b"])).toBe(items);
    expect(reorderBySortOrder(items, ["a", "b", "missing"])).toBe(items);
  });
});
