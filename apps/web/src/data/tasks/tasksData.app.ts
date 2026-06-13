import { api } from "@church-task/backend/convex/_generated/api";
import type { TaskStatus } from "@church-task/domain";
import type { OptimisticLocalStore } from "convex/browser";
import { useMutation } from "convex/react";
import { useConvexQuery as useQuery } from "@/data/query-hooks";

import { successfulResponseCollection } from "@/data/convex-query-adapter";
import { collectionItemOptimisticUpdate } from "@/data/optimistic-collection";
import {
  applyTaskTransition,
  applyTaskUpdate,
  workflowStatusStateLookup,
  type OptimisticTask,
  type TaskTransition,
  type TaskUpdateFields,
  type WorkflowStatusStateLookup,
  type WorkflowStatusStateSource,
} from "@/data/tasks/tasksOptimistic";

export type TaskCollectionFilters = {
  readonly surface?: "my_work" | "our_work";
  readonly cycleId?: string;
  readonly teamId?: string;
  readonly assignedUserId?: string | null;
  readonly createdByUserId?: string;
  readonly workflowStatusId?: string;
  readonly taskState?: TaskStatus;
  readonly taskStates?: readonly TaskStatus[];
  readonly excludeSubtasks?: boolean;
  readonly orderBy?: "created" | "due_date";
  readonly taskId?: string;
  // Ad-hoc Board filters: multi-value include/exclude per field. User-id lists
  // allow null to represent Unassigned.
  readonly teamIdIn?: readonly string[];
  readonly teamIdNotIn?: readonly string[];
  readonly assignedUserIdIn?: readonly (string | null)[];
  readonly assignedUserIdNotIn?: readonly (string | null)[];
  readonly createdByUserIdIn?: readonly (string | null)[];
  readonly createdByUserIdNotIn?: readonly (string | null)[];
  readonly workflowStatusIdIn?: readonly string[];
  readonly workflowStatusIdNotIn?: readonly string[];
  readonly taskStateIn?: readonly TaskStatus[];
  readonly taskStateNotIn?: readonly TaskStatus[];
};

export function useTasksCollection(params: {
  readonly churchId: string | null;
  readonly currentUserId: string | null;
  readonly filters?: TaskCollectionFilters;
}) {
  const {
    taskStates,
    teamIdIn,
    teamIdNotIn,
    assignedUserIdIn,
    assignedUserIdNotIn,
    createdByUserIdIn,
    createdByUserIdNotIn,
    workflowStatusIdIn,
    workflowStatusIdNotIn,
    taskStateIn,
    taskStateNotIn,
    ...restFilters
  } = params.filters ?? {};
  const result = useQuery(
    api.tasks.mcpListTasks,
    params.churchId && params.currentUserId
      ? {
          churchId: params.churchId,
          actorUserId: params.currentUserId,
          ...restFilters,
          // Convex argument validators expect mutable arrays.
          ...(taskStates ? { taskStates: [...taskStates] } : {}),
          ...(teamIdIn ? { teamIdIn: [...teamIdIn] } : {}),
          ...(teamIdNotIn ? { teamIdNotIn: [...teamIdNotIn] } : {}),
          ...(assignedUserIdIn ? { assignedUserIdIn: [...assignedUserIdIn] } : {}),
          ...(assignedUserIdNotIn ? { assignedUserIdNotIn: [...assignedUserIdNotIn] } : {}),
          ...(createdByUserIdIn ? { createdByUserIdIn: [...createdByUserIdIn] } : {}),
          ...(createdByUserIdNotIn ? { createdByUserIdNotIn: [...createdByUserIdNotIn] } : {}),
          ...(workflowStatusIdIn ? { workflowStatusIdIn: [...workflowStatusIdIn] } : {}),
          ...(workflowStatusIdNotIn ? { workflowStatusIdNotIn: [...workflowStatusIdNotIn] } : {}),
          ...(taskStateIn ? { taskStateIn: [...taskStateIn] } : {}),
          ...(taskStateNotIn ? { taskStateNotIn: [...taskStateNotIn] } : {}),
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

// Intentionally not optimistic: the server derives `cycleId`/`workflowId` (and
// the task id) on create, so an optimistic row can't satisfy the `mcpListTasks`
// filters and would flicker. The quick-action also navigates to the new Task on
// success, so there is no live list waiting on an optimistic insert.
export function useCreateTaskMutation() {
  return useMutation(api.tasks.mcpCreateTask);
}

/**
 * Read the cached Workflow Statuses (`workDefaults.readForChurch`) for a Church
 * from the optimistic store and turn them into a Workflow Status id → Task
 * state lookup. Falls back to an empty lookup when the query isn't cached yet,
 * in which case `applyTaskUpdate` keeps the Task's existing `taskState`.
 */
function resolveTaskStateFromStore(
  store: OptimisticLocalStore,
  churchId: string,
): WorkflowStatusStateLookup {
  const workDefaults = store.getQuery(api.workDefaults.readForChurch, { churchId });
  const statuses =
    workDefaults?.ok === true
      ? (workDefaults.data.workflowStatuses as ReadonlyArray<WorkflowStatusStateSource>)
      : [];
  return workflowStatusStateLookup(statuses);
}

export function useUpdateTaskMutation() {
  return useMutation(api.tasks.mcpUpdateTask).withOptimisticUpdate(
    collectionItemOptimisticUpdate({
      query: api.tasks.mcpListTasks,
      collectionKey: "tasks",
      patch: (task: OptimisticTask, args, store) =>
        task.id === args.taskId
          ? applyTaskUpdate(task, args.fields, resolveTaskStateFromStore(store, args.churchId))
          : undefined,
    }),
  );
}

/**
 * Batch variant used by group drags on the Board (e.g. "Select all in column"
 * then drag). Optimistically applies each update so all selected cards land in
 * the destination column with their new Board Order immediately.
 */
export function useUpdateTasksBatchMutation() {
  return useMutation(api.tasks.mcpUpdateTasksBatch).withOptimisticUpdate(
    collectionItemOptimisticUpdate({
      query: api.tasks.mcpListTasks,
      collectionKey: "tasks",
      patch: (task: OptimisticTask, args, store) => {
        const updates: ReadonlyArray<{
          readonly taskId: string;
          readonly fields: TaskUpdateFields;
        }> = args.updates;
        const update = updates.find((candidate) => candidate.taskId === task.id);
        return update
          ? applyTaskUpdate(task, update.fields, resolveTaskStateFromStore(store, args.churchId))
          : undefined;
      },
    }),
  );
}

function taskTransitionOptimisticUpdate(transition: TaskTransition) {
  return collectionItemOptimisticUpdate({
    query: api.tasks.mcpListTasks,
    collectionKey: "tasks",
    patch: (task: OptimisticTask, args: { readonly taskId: string }) =>
      task.id === args.taskId ? applyTaskTransition(task, transition) : undefined,
  });
}

export function useCompleteTaskMutation() {
  return useMutation(api.tasks.mcpCompleteTask).withOptimisticUpdate(
    taskTransitionOptimisticUpdate("complete"),
  );
}

export function useCancelTaskMutation() {
  return useMutation(api.tasks.mcpCancelTask).withOptimisticUpdate(
    taskTransitionOptimisticUpdate("cancel"),
  );
}

export function useReopenTaskMutation() {
  return useMutation(api.tasks.mcpReopenTask).withOptimisticUpdate(
    taskTransitionOptimisticUpdate("reopen"),
  );
}
