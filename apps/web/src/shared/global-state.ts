import { Match, pipe } from "effect";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const detailsPaneStickyAtom = atom(false);

export enum FilterKeys {
  Orgs = "orgs-filters",
  Users = "users-filters",
  Default = "default-filters",
}

export type CollectionView = "table" | "cards";

export const collectionViewsAtom = atomWithStorage<Record<string, CollectionView>>(
  "collection-views",
  {},
);

export function getCollectionView(
  collectionViews: Record<string, CollectionView>,
  key: string,
): CollectionView {
  return collectionViews[key] ?? "table";
}

export function setCollectionView(
  collectionViews: Record<string, CollectionView>,
  key: string,
  view: CollectionView,
): Record<string, CollectionView> {
  return { ...collectionViews, [key]: view };
}

export const collectionViewMatch = <T>(match: {
  readonly table: () => T;
  readonly cards: () => T;
}) =>
  pipe(
    Match.type<CollectionView>(),
    Match.when("table", match.table),
    Match.when("cards", match.cards),
    Match.exhaustive,
  );
