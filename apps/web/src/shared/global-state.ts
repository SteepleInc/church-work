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

/**
 * Hidden Board Columns per Board key (e.g. "my_work", "team_board:{teamId}").
 * Local-device presentation state only: hiding a Board Column never affects
 * the Tasks in it. Stored as Workflow Status ids.
 */
export const hiddenBoardColumnsAtom = atomWithStorage<Record<string, readonly string[]>>(
  "hidden-board-columns",
  {},
);

export function getHiddenBoardColumns(
  hiddenBoardColumns: Record<string, readonly string[]>,
  boardKey: string,
): readonly string[] {
  return hiddenBoardColumns[boardKey] ?? [];
}

export function toggleHiddenBoardColumn(
  hiddenBoardColumns: Record<string, readonly string[]>,
  boardKey: string,
  workflowStatusId: string,
): Record<string, readonly string[]> {
  const hidden = getHiddenBoardColumns(hiddenBoardColumns, boardKey);
  const nextHidden = hidden.includes(workflowStatusId)
    ? hidden.filter((id) => id !== workflowStatusId)
    : [...hidden, workflowStatusId];
  return { ...hiddenBoardColumns, [boardKey]: nextHidden };
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
