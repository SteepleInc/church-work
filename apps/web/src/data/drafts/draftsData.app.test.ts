import { describe, expect, test } from "bun:test";

import { draftOrderTimestamp, sortDraftsByMostRecentlyUpdated } from "./draftsData.app";

type OrderableDraft = { readonly updated_at: number | null; readonly created_at: number | null };

describe("draftOrderTimestamp", () => {
  test("prefers updated_at", () => {
    expect(draftOrderTimestamp({ updated_at: 200, created_at: 100 })).toBe(200);
  });

  test("falls back to created_at when updated_at is missing", () => {
    expect(draftOrderTimestamp({ updated_at: null, created_at: 100 })).toBe(100);
  });

  test("falls back to 0 when both are missing", () => {
    expect(draftOrderTimestamp({ updated_at: null, created_at: null })).toBe(0);
  });
});

describe("sortDraftsByMostRecentlyUpdated", () => {
  test("orders most-recently-updated first", () => {
    const drafts: readonly (OrderableDraft & { readonly id: string })[] = [
      { id: "old", updated_at: 100, created_at: 100 },
      { id: "new", updated_at: 300, created_at: 100 },
      { id: "mid", updated_at: 200, created_at: 100 },
    ];

    expect(sortDraftsByMostRecentlyUpdated(drafts).map((draft) => draft.id)).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  test("uses created_at for drafts never updated, and sinks timestamp-less drafts", () => {
    const drafts: readonly (OrderableDraft & { readonly id: string })[] = [
      { id: "none", updated_at: null, created_at: null },
      { id: "fresh-create", updated_at: null, created_at: 250 },
      { id: "updated", updated_at: 150, created_at: 100 },
    ];

    expect(sortDraftsByMostRecentlyUpdated(drafts).map((draft) => draft.id)).toEqual([
      "fresh-create",
      "updated",
      "none",
    ]);
  });

  test("does not mutate the input array", () => {
    const drafts: readonly OrderableDraft[] = [
      { updated_at: 100, created_at: 100 },
      { updated_at: 300, created_at: 100 },
    ];
    const snapshot = [...drafts];

    sortDraftsByMostRecentlyUpdated(drafts);

    expect(drafts).toEqual(snapshot);
  });
});
