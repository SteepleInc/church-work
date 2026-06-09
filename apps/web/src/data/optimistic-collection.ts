import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import type { OptimisticLocalStore, OptimisticUpdate } from "convex/browser";

/**
 * Shared Convex response envelope used across this app's collection queries:
 * `{ ok: true, data: { <collectionKey>: Item[] } }`. Optimistic updates patch
 * the named collection in place and leave the rest of the envelope untouched.
 */
type CollectionEnvelope<Key extends string, Item> =
  | { readonly ok: true; readonly data: Record<Key, readonly Item[]> }
  | { readonly ok: false };

/**
 * Any public query reference. We keep this loose (rather than constraining the
 * return type to {@link CollectionEnvelope}) because the real generated query
 * types carry extra fields and unions; the wrapper reads the collection
 * structurally at runtime and `patch`/`collectionKey` provide the item typing.
 */
type CollectionQuery = FunctionReference<"query", "public">;

/**
 * Patch one item from a cached collection given the mutation's arguments and a
 * read-only view of other cached queries (e.g. to resolve a Workflow Status to
 * a Task state). Return a new item to replace it, or `undefined` to leave the
 * item unchanged. Runs against every matching cached query, so it must be pure
 * and immutable.
 */
export type CollectionItemPatch<Item, Args> = (
  item: Item,
  args: Args,
  store: OptimisticLocalStore,
) => Item | undefined;

function patchEnvelope<Key extends string, Item, Args>(
  envelope: CollectionEnvelope<Key, Item>,
  collectionKey: Key,
  args: Args,
  store: OptimisticLocalStore,
  patch: CollectionItemPatch<Item, Args>,
): CollectionEnvelope<Key, Item> {
  if (envelope.ok !== true) return envelope;

  const items = envelope.data[collectionKey];
  let changed = false;
  const nextItems = items.map((item) => {
    const patched = patch(item, args, store);
    if (patched === undefined || patched === item) return item;
    changed = true;
    return patched;
  });

  if (!changed) return envelope;

  return {
    ...envelope,
    data: { ...envelope.data, [collectionKey]: nextItems },
  };
}

/**
 * Build a Convex {@link OptimisticUpdate} that patches one item across every
 * cached instance of a collection query (e.g. the same list mounted on several
 * surfaces). This is the reusable seam that removes optimistic-update
 * boilerplate: each mutation only supplies how to patch a single item.
 *
 * @example
 * const updateTask = useMutation(api.tasks.mcpUpdateTask).withOptimisticUpdate(
 *   collectionItemOptimisticUpdate({
 *     query: api.tasks.mcpListTasks,
 *     collectionKey: "tasks",
 *     patch: (task, args) =>
 *       task.id === args.taskId ? { ...task, ...args.fields } : undefined,
 *   }),
 * );
 */
/**
 * Run `rewrite` against every cached instance of `query`, writing back only the
 * results that actually changed. Shared by the collection and record wrappers.
 */
function rewriteCachedQueries<Query extends FunctionReference<"query">>(
  store: OptimisticLocalStore,
  query: Query,
  rewrite: (value: FunctionReturnType<Query>) => FunctionReturnType<Query>,
): void {
  for (const cached of store.getAllQueries(query)) {
    if (cached.value === undefined) continue;

    const next = rewrite(cached.value as FunctionReturnType<Query>);
    if (next === cached.value) continue;

    store.setQuery(query, cached.args, next);
  }
}

export function collectionItemOptimisticUpdate<
  Key extends string,
  Item,
  Query extends CollectionQuery,
  Mutation extends FunctionReference<"mutation">,
>(config: {
  readonly query: Query;
  readonly collectionKey: Key;
  readonly patch: CollectionItemPatch<Item, FunctionArgs<Mutation>>;
}): OptimisticUpdate<FunctionArgs<Mutation>> {
  return (store, args) => {
    rewriteCachedQueries(
      store,
      config.query,
      (value) =>
        patchEnvelope(
          value as CollectionEnvelope<Key, Item>,
          config.collectionKey,
          args,
          store,
          config.patch,
        ) as FunctionReturnType<Query>,
    );
  };
}

/**
 * Transform the entire collection (not just one item) given the mutation's
 * arguments. Use for inserts, removals, and reorders where item-level patching
 * can't express the change. Return a new array, or the same reference to skip.
 * Runs against every matching cached query, so it must be pure and immutable.
 */
export type CollectionListPatch<Item, Args> = (
  items: readonly Item[],
  args: Args,
  store: OptimisticLocalStore,
) => readonly Item[];

/**
 * Build a Convex {@link OptimisticUpdate} that rewrites a whole collection
 * across every cached instance of a collection query. The reusable seam for
 * create / add / remove / archive / reorder mutations.
 *
 * @example
 * const reorderTeams = useMutation(api.teams.reorderForChurch).withOptimisticUpdate(
 *   collectionListOptimisticUpdate({
 *     query: api.teams.listForChurch,
 *     collectionKey: "teams",
 *     patch: (teams, args) => reorderById(teams, args.teamIds),
 *   }),
 * );
 */
export function collectionListOptimisticUpdate<
  Key extends string,
  Item,
  Query extends CollectionQuery,
  Mutation extends FunctionReference<"mutation">,
>(config: {
  readonly query: Query;
  readonly collectionKey: Key;
  readonly patch: CollectionListPatch<Item, FunctionArgs<Mutation>>;
}): OptimisticUpdate<FunctionArgs<Mutation>> {
  return (store, args) => {
    rewriteCachedQueries(store, config.query, (value) => {
      const envelope = value as CollectionEnvelope<Key, Item>;
      if (envelope.ok !== true) return value;

      const items = envelope.data[config.collectionKey];
      const nextItems = config.patch(items, args, store);
      if (nextItems === items) return value;

      return {
        ...envelope,
        data: { ...envelope.data, [config.collectionKey]: nextItems },
      } as FunctionReturnType<Query>;
    });
  };
}

/**
 * Patch a single-record query result (one object, not a collection). Return a
 * new record, or the same reference to skip. Use for queries like
 * `dashboard.getActiveOrganization` that resolve to one object.
 */
export type RecordPatch<Rec, Args> = (record: Rec, args: Args, store: OptimisticLocalStore) => Rec;

/**
 * Build a Convex {@link OptimisticUpdate} that patches a single-record query
 * result across every cached instance. Skips queries whose result is null.
 */
export function recordOptimisticUpdate<
  Rec,
  Query extends FunctionReference<"query", "public", Record<string, unknown>, Rec | null>,
  Mutation extends FunctionReference<"mutation">,
>(config: {
  readonly query: Query;
  readonly patch: RecordPatch<Rec, FunctionArgs<Mutation>>;
}): OptimisticUpdate<FunctionArgs<Mutation>> {
  return (store, args) => {
    rewriteCachedQueries(store, config.query, (value) => {
      if (value === null) return value;
      return config.patch(value as Rec, args, store) as FunctionReturnType<Query>;
    });
  };
}
