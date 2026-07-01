import { mutators, queries, type TaskDraft } from "@church-work/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";

export function useMyDraftsCollection() {
  const [rows, result] = useQuery(queries.task_drafts.my_active());
  const collection = rows as readonly TaskDraft[];
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
  return (churchId: string, draftId: string) =>
    zero.mutate(mutators.drafts.discard({ church_id: churchId, draft_id: draftId })).server;
}

export function useDiscardAllDraftsMutation() {
  const zero = useZero();
  return (churchId: string, draftIds: readonly string[]) =>
    zero.mutate(mutators.drafts.discard_all({ church_id: churchId, draft_ids: [...draftIds] }))
      .server;
}

export function useRestoreDraftsMutation() {
  const zero = useZero();
  return (churchId: string, draftIds: readonly string[]) =>
    zero.mutate(mutators.drafts.restore({ church_id: churchId, draft_ids: [...draftIds] })).server;
}
