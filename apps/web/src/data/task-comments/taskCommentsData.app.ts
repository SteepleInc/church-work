import { mutators, queries, type TaskComment } from "@church-task/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";

import { authClient } from "@/lib/auth-client";
import type { TaskCommentModerationViewer } from "@/data/task-comments/taskCommentModeration-utils";

export type TaskCommentCollectionItem = TaskComment;

type SessionWithRoles = {
  readonly orgRole?: string | null;
  readonly userRole?: string | null;
};

function getSessionRoles(session: unknown): SessionWithRoles {
  if (session === null || typeof session !== "object") return {};
  const roles = session as Record<string, unknown>;
  return {
    orgRole: typeof roles.orgRole === "string" ? roles.orgRole : null,
    userRole: typeof roles.userRole === "string" ? roles.userRole : null,
  };
}

/**
 * Resolves the current viewer's moderation capabilities for Task Comments,
 * mirroring the server `canModerateTaskComment` inputs (author / Church
 * owner-admin / app admin) so the UI only offers Edit + Delete when the
 * mutator would accept them.
 */
export function useTaskCommentModerationViewer(params: {
  readonly currentUserId: string | null;
}): TaskCommentModerationViewer {
  const { data } = authClient.useSession();
  const session = getSessionRoles(data?.session);

  return {
    currentUserId: params.currentUserId,
    churchRole: session.orgRole ?? null,
    isAppAdmin: session.userRole === "admin",
  };
}

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

  return async (body: string, parentCommentId?: string | null) => {
    if (params.churchId === null) throw new Error("Church is required to comment.");
    await zero.mutate(
      mutators.task_comments.create({
        body,
        church_id: params.churchId,
        parent_comment_id: parentCommentId ?? null,
        task_id: params.taskId,
      }),
    );
  };
}

export function useUpdateTaskCommentMutation(params: { readonly churchId: string | null }) {
  const zero = useZero();

  return async (commentId: string, body: string) => {
    if (params.churchId === null) throw new Error("Church is required to edit comments.");
    await zero.mutate(
      mutators.task_comments.update({
        body,
        church_id: params.churchId,
        comment_id: commentId,
      }),
    );
  };
}

export function useDeleteTaskCommentMutation(params: { readonly churchId: string | null }) {
  const zero = useZero();

  return async (commentId: string) => {
    if (params.churchId === null) throw new Error("Church is required to delete comments.");
    await zero.mutate(
      mutators.task_comments.delete({ church_id: params.churchId, comment_id: commentId }),
    );
  };
}
