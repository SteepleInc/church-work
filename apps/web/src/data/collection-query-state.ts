export type CollectionQueryState<Item> = {
  readonly loading: boolean;
  readonly collection: readonly Item[];
};

export type RecordQueryState<Item> = {
  readonly loading: boolean;
  readonly record: Item | null;
};

export function collectionFromQueryResult<Item>(
  result: readonly Item[] | undefined,
): CollectionQueryState<Item> {
  return {
    loading: result === undefined,
    collection: result ?? [],
  };
}

type SuccessfulResponse<Response> = Response & { readonly ok: true };

export function successfulResponseCollection<Response extends { readonly ok: boolean }, Item>(
  result: Response | undefined,
  select: (result: SuccessfulResponse<Response>) => readonly Item[],
): CollectionQueryState<Item> {
  return {
    loading: result === undefined,
    collection: result?.ok === true ? select(result as SuccessfulResponse<Response>) : [],
  };
}

export function recordFromQueryResult<Item>(
  result: Item | null | undefined,
): RecordQueryState<Item> {
  return {
    loading: result === undefined,
    record: result ?? null,
  };
}

export function recordFromCollection<Item>(
  state: CollectionQueryState<Item>,
  predicate: (item: Item) => boolean,
): RecordQueryState<Item> {
  return {
    loading: state.loading,
    record: state.collection.find(predicate) ?? null,
  };
}
