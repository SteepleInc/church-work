import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const detailsPaneStickyAtom = atom(false);

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
