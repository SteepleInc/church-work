import { mutators, queries, type Draft, type TaskDraft } from "@church-work/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";

export function useMyDraftsCollection() {
  const [rows, result] = useQuery(queries.drafts.my_active());
  const collection = rows as readonly Draft[];
  return { collection, draftsCollection: collection, loading: result.type !== "complete" };
}

export function useTaskDraft(draftId: string) {
  const [row] = useQuery(queries.task_drafts.by_draft_id({ draft_id: draftId }));
  return row as TaskDraft | undefined;
}

export function useDiscardDraftMutation() {
  const zero = useZero();
  return (draftId: string) => zero.mutate(mutators.drafts.discard({ draft_id: draftId }));
}

export function useDiscardAllDraftsMutation() {
  const zero = useZero();
  return () => zero.mutate(mutators.drafts.discard_all({}));
}

export function useRestoreDraftsMutation() {
  const zero = useZero();
  return (draftIds: readonly string[]) =>
    zero.mutate(mutators.drafts.restore({ draft_ids: [...draftIds] }));
}
