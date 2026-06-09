import { describe, expect, test } from "bun:test";
import type { OptimisticLocalStore } from "convex/browser";
import type { FunctionReference } from "convex/server";

import {
  collectionItemOptimisticUpdate,
  collectionListOptimisticUpdate,
  recordOptimisticUpdate,
} from "./optimistic-collection";

type Item = { readonly id: string; readonly name: string };
type Envelope = { readonly ok: true; readonly data: { readonly items: readonly Item[] } };

// Minimal in-memory OptimisticLocalStore keyed by (query ref, serialized args).
function createFakeStore(
  entries: ReadonlyArray<{ args: Record<string, unknown>; value: unknown }>,
) {
  const store = new Map(entries.map((entry) => [JSON.stringify(entry.args), { ...entry }]));

  const fake = {
    getQuery: (_query: unknown, args: Record<string, unknown>) =>
      store.get(JSON.stringify(args))?.value,
    getAllQueries: () => [...store.values()],
    setQuery: (_query: unknown, args: Record<string, unknown>, value: unknown) => {
      store.set(JSON.stringify(args), { args, value });
    },
  } as unknown as OptimisticLocalStore;

  return { fake, read: (args: Record<string, unknown>) => store.get(JSON.stringify(args))?.value };
}

const query = {} as FunctionReference<
  "query",
  "public",
  Record<string, unknown>,
  Envelope | { readonly ok: false }
>;

describe("collectionItemOptimisticUpdate", () => {
  test("patches the matching item across every cached query", () => {
    const { fake, read } = createFakeStore([
      {
        args: { surface: "my_work" },
        value: {
          ok: true,
          data: {
            items: [
              { id: "a", name: "A" },
              { id: "b", name: "B" },
            ],
          },
        },
      },
      {
        args: { surface: "our_work" },
        value: { ok: true, data: { items: [{ id: "b", name: "B" }] } },
      },
    ]);

    const update = collectionItemOptimisticUpdate<
      "items",
      Item,
      typeof query,
      FunctionReference<"mutation">
    >({
      query,
      collectionKey: "items",
      patch: (item, args: { readonly id: string }) =>
        item.id === args.id ? { ...item, name: "patched" } : undefined,
    });

    update(fake, { id: "b" } as never);

    const first = read({ surface: "my_work" }) as Envelope;
    const second = read({ surface: "our_work" }) as Envelope;
    expect(first.data.items).toEqual([
      { id: "a", name: "A" },
      { id: "b", name: "patched" },
    ]);
    expect(second.data.items).toEqual([{ id: "b", name: "patched" }]);
  });

  test("leaves cached queries untouched when no item matches", () => {
    const original = {
      ok: true as const,
      data: { items: [{ id: "a", name: "A" }] },
    };
    const { fake, read } = createFakeStore([{ args: {}, value: original }]);

    const update = collectionItemOptimisticUpdate<
      "items",
      Item,
      typeof query,
      FunctionReference<"mutation">
    >({
      query,
      collectionKey: "items",
      patch: (item, args: { readonly id: string }) =>
        item.id === args.id ? { ...item, name: "patched" } : undefined,
    });

    update(fake, { id: "missing" } as never);

    // Same reference back: nothing was rewritten.
    expect(read({})).toBe(original);
  });

  test("skips error envelopes and loading (undefined) queries", () => {
    const errorEnvelope = { ok: false as const };
    const { fake, read } = createFakeStore([
      { args: { a: 1 }, value: errorEnvelope },
      { args: { a: 2 }, value: undefined },
    ]);

    const update = collectionItemOptimisticUpdate<
      "items",
      Item,
      typeof query,
      FunctionReference<"mutation">
    >({
      query,
      collectionKey: "items",
      patch: (item, args: { readonly id: string }) =>
        item.id === args.id ? { ...item, name: "patched" } : undefined,
    });

    update(fake, { id: "a" } as never);

    expect(read({ a: 1 })).toBe(errorEnvelope);
    expect(read({ a: 2 })).toBeUndefined();
  });
});

describe("collectionListOptimisticUpdate", () => {
  test("rewrites the whole collection (insert / remove / reorder)", () => {
    const { fake, read } = createFakeStore([
      {
        args: {},
        value: {
          ok: true,
          data: {
            items: [
              { id: "a", name: "A" },
              { id: "b", name: "B" },
            ],
          },
        },
      },
    ]);

    const update = collectionListOptimisticUpdate<
      "items",
      Item,
      typeof query,
      FunctionReference<"mutation">
    >({
      query,
      collectionKey: "items",
      patch: (currentItems, args: { readonly id: string }) =>
        currentItems.filter((item) => item.id !== args.id),
    });

    update(fake, { id: "a" } as never);

    expect((read({}) as Envelope).data.items).toEqual([{ id: "b", name: "B" }]);
  });

  test("skips the write when the patch returns the same array reference", () => {
    const original = { ok: true as const, data: { items: [{ id: "a", name: "A" }] } };
    const { fake, read } = createFakeStore([{ args: {}, value: original }]);

    const update = collectionListOptimisticUpdate<
      "items",
      Item,
      typeof query,
      FunctionReference<"mutation">
    >({
      query,
      collectionKey: "items",
      patch: (currentItems) => currentItems,
    });

    update(fake, {} as never);

    expect(read({})).toBe(original);
  });
});

describe("recordOptimisticUpdate", () => {
  type Org = { readonly id: string; readonly timeZone: string };
  const recordQuery = {} as FunctionReference<
    "query",
    "public",
    Record<string, unknown>,
    Org | null
  >;

  test("patches a single-record query result", () => {
    const { fake, read } = createFakeStore([{ args: {}, value: { id: "org-1", timeZone: "UTC" } }]);

    const update = recordOptimisticUpdate<Org, typeof recordQuery, FunctionReference<"mutation">>({
      query: recordQuery,
      patch: (org, args: { readonly id: string; readonly timeZone: string }) =>
        org.id === args.id ? { ...org, timeZone: args.timeZone } : org,
    });

    update(fake, { id: "org-1", timeZone: "America/New_York" } as never);

    expect(read({})).toEqual({ id: "org-1", timeZone: "America/New_York" });
  });

  test("skips null record results", () => {
    const { fake, read } = createFakeStore([{ args: {}, value: null }]);

    const update = recordOptimisticUpdate<Org, typeof recordQuery, FunctionReference<"mutation">>({
      query: recordQuery,
      patch: (org) => org,
    });

    update(fake, {} as never);

    expect(read({})).toBeNull();
  });
});
