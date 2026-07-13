import { mutators, queries, type TaskDraft } from "@church-work/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";

/**
 * The most-recently-updated timestamp for a Draft, used to order the Drafts
 * page. Falls back to `created_at` (a brand-new Draft may not have been updated
 * yet) and finally to `0` so a Draft missing both never sorts unpredictably.
 */
export function draftOrderTimestamp(draft: Pick<TaskDraft, "updated_at" | "created_at">): number {
  return draft.updated_at ?? draft.created_at ?? 0;
}

/**
 * Orders Drafts most-recently-updated first. The `my_active` query already
 * returns this order, but re-sorting here keeps the page's ordering independent
 * of the query preserving it and resolves ties / missing timestamps
 * deterministically rather than as a flickering order.
 */
export function sortDraftsByMostRecentlyUpdated<
  T extends Pick<TaskDraft, "updated_at" | "created_at"> & {
    readonly draft_id?: string;
    readonly id?: string;
  },
>(drafts: readonly T[]): readonly T[] {
  return [...drafts].sort((left, right) => {
    const timestampDifference = draftOrderTimestamp(right) - draftOrderTimestamp(left);
    if (timestampDifference !== 0) return timestampDifference;

    return (left.draft_id ?? left.id ?? "").localeCompare(right.draft_id ?? right.id ?? "");
  });
}

export function useMyDraftsCollection() {
  const [rows, result] = useQuery(queries.task_drafts.my_active());
  const collection = sortDraftsByMostRecentlyUpdated(rows as readonly TaskDraft[]);
  return { collection, draftsCollection: collection, loading: result.type !== "complete" };
}

export function useTaskDraft(draftId: string) {
  const [row] = useQuery(queries.task_drafts.by_draft_id({ draft_id: draftId }), {
    enabled: draftId !== "__no_draft__",
  });
  return row as TaskDraft | undefined;
}

export function useDiscardDraftMutation() {
  const zero = useZero();
  return (draftId: string) => zero.mutate(mutators.drafts.discard({ draft_id: draftId })).server;
}

export function useDiscardAllDraftsMutation() {
  const zero = useZero();
  return (draftIds: readonly string[]) =>
    zero.mutate(mutators.drafts.discard_all({ draft_ids: [...draftIds] })).server;
}

export function useRestoreDraftsMutation() {
  const zero = useZero();
  return (draftIds: readonly string[]) =>
    zero.mutate(mutators.drafts.restore({ draft_ids: [...draftIds] })).server;
}
