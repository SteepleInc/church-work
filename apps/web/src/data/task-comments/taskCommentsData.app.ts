import { mutators, queries, type TaskComment } from "@church-task/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";

export type TaskCommentCollectionItem = TaskComment;

export function useTaskCommentsForTaskCollection(params: {
  readonly churchId: string | null;
  readonly taskId: string | null;
}) {
  const [rows, result] = useQuery(
    queries.task_comments.by_task({
      church_id: params.churchId ?? "__no_church__",
      task_id: params.taskId ?? "__no_task__",
    }),
  );

  return {
    loading: params.churchId !== null && params.taskId !== null && result.type !== "complete",
    taskCommentsCollection: rows as readonly TaskCommentCollectionItem[],
  };
}

export function useCreateTaskCommentMutation(params: {
  readonly churchId: string | null;
  readonly taskId: string;
}) {
  const zero = useZero();

  return async (body: string) => {
    if (params.churchId === null) throw new Error("Church is required to comment.");
    await zero.mutate(
      mutators.task_comments.create({
        body,
        church_id: params.churchId,
        task_id: params.taskId,
      }),
    );
  };
}
