import { api } from "@church-task/backend/convex/_generated/api";
import type { TaskStatus } from "@church-task/domain";
import { useMutation, useQuery } from "convex/react";

import { successfulResponseCollection } from "@/data/convex-query-adapter";

export type TaskCollectionFilters = {
  readonly surface?: "my_work" | "our_work";
  readonly cycleId?: string;
  readonly teamId?: string | null;
  readonly assignedUserId?: string | null;
  readonly workflowStatusId?: string;
  readonly taskState?: TaskStatus;
  readonly taskId?: string;
};

export function useTasksCollection(params: {
  readonly churchId: string | null;
  readonly currentUserId: string | null;
  readonly filters?: TaskCollectionFilters;
}) {
  const result = useQuery(
    api.tasks.mcpListTasks,
    params.churchId && params.currentUserId
      ? {
          churchId: params.churchId,
          actorUserId: params.currentUserId,
          ...params.filters,
        }
      : "skip",
  );
  const state = successfulResponseCollection(result, (response) => response.data.tasks);

  return {
    loading: params.churchId !== null && params.currentUserId !== null && state.loading,
    collection: state.collection,
    tasksCollection: state.collection,
  };
}

export function useCreateTaskMutation() {
  return useMutation(api.tasks.mcpCreateTask);
}

export function useUpdateTaskMutation() {
  return useMutation(api.tasks.mcpUpdateTask);
}

export function useCompleteTaskMutation() {
  return useMutation(api.tasks.mcpCompleteTask);
}

export function useCancelTaskMutation() {
  return useMutation(api.tasks.mcpCancelTask);
}

export function useReopenTaskMutation() {
  return useMutation(api.tasks.mcpReopenTask);
}
