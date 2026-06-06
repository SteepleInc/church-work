import { describe, expect, it } from "vitest";

import { getListPageSize, type ListArgs } from "../convex/listQueryHelpers";

const paginationOpts = { cursor: null, numItems: 25 };

describe("Convex listQueryHelpers", () => {
  it("uses Convex pagination size when list args do not override it", () => {
    expect(getListPageSize({ listArgs: {}, paginationOpts })).toBe(25);
  });

  it("uses the requested list limit for the page size", () => {
    const listArgs = { limit: 10 } satisfies ListArgs;

    expect(getListPageSize({ listArgs, paginationOpts })).toBe(10);
  });
});
