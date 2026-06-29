import { queries, type TaskMention } from "@church-work/zero";
import { useQuery } from "@rocicorp/zero/react";

export type TaskMentionCollectionItem = TaskMention;

/**
 * Incoming task→task mention edges for a Task: the "mentioned in" backlinks
 * showing which other Tasks reference this one in their description. Only live
 * edges are returned (the query filters soft-deleted rows), so removing a
 * mention from a source Task drops it from this list. Each edge's source Task is
 * resolved individually at render time (see `useTask`), so this hook returns
 * only the edges, never a joined Task collection.
 */
export function useTaskBacklinksCollection(params: {
  readonly churchId: string | null;
  readonly taskId: string | null;
}) {
  const [rows, result] = useQuery(
    queries.task_mentions.by_target_task({
      church_id: params.churchId ?? "__no_church__",
      task_id: params.taskId ?? "__no_task__",
    }),
  );

  return {
    loading: params.churchId !== null && params.taskId !== null && result.type !== "complete",
    taskBacklinksCollection: rows as readonly TaskMentionCollectionItem[],
  };
}
