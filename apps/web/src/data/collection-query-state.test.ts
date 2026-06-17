import { describe, expect, test } from "bun:test";

import {
  collectionFromQueryResult,
  recordFromCollection,
  recordFromQueryResult,
  successfulResponseCollection,
} from "./collection-query-state";

describe("collection query state helpers", () => {
  test("reports plural collection hooks as loading until rows return", () => {
    expect(collectionFromQueryResult<{ id: string }>(undefined)).toEqual({
      loading: true,
      collection: [],
    });
  });

  test("maps successful response collections and ignores failed responses", () => {
    type Result =
      | { readonly ok: true; readonly data: { readonly teams: readonly { id: string }[] } }
      | { readonly ok: false; readonly error: { readonly code: string } };

    expect(
      successfulResponseCollection<Result, { id: string }>(
        { ok: true, data: { teams: [{ id: "team-1" }] } },
        (result) => result.data.teams,
      ),
    ).toEqual({ loading: false, collection: [{ id: "team-1" }] });

    expect(
      successfulResponseCollection<Result, { id: string }>(
        { ok: false, error: { code: "not_church_member" } },
        (result) => result.data.teams,
      ),
    ).toEqual({ loading: false, collection: [] });
  });

  test("derives singular record hook state from query results and plural collections", () => {
    expect(recordFromQueryResult<{ id: string }>(undefined)).toEqual({
      loading: true,
      record: null,
    });

    expect(
      recordFromCollection(
        { loading: false, collection: [{ id: "task-1" }, { id: "task-2" }] },
        (task) => task.id === "task-2",
      ),
    ).toEqual({ loading: false, record: { id: "task-2" } });
  });
});
