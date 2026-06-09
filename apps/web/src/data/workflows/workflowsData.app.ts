import { api } from "@church-task/backend/convex/_generated/api";
import type { TaskStatus } from "@church-task/domain";
import { useMutation, useQuery } from "convex/react";

import { appendItem, removeById, reorderBySortOrder } from "@/data/collection-ops";
import { successfulResponseCollection } from "@/data/convex-query-adapter";
import {
  collectionItemOptimisticUpdate,
  collectionListOptimisticUpdate,
} from "@/data/optimistic-collection";

type WorkflowItem = {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly sortOrder: number;
};

type WorkflowStatusItem = {
  readonly id: string;
  readonly workflowId: string;
  readonly name: string;
  readonly taskState: TaskStatus;
  readonly sortOrder: number;
};

function optimisticId(prefix: string): string {
  return `optimistic-${prefix}-${Math.random().toString(36).slice(2)}`;
}

export function useWorkflowsCollection(params: { readonly churchId: string | null }) {
  const result = useQuery(
    api.workDefaults.readForChurch,
    params.churchId ? { churchId: params.churchId } : "skip",
  );
  const state = successfulResponseCollection(result, (response) => response.data.workflows);

  return {
    loading: params.churchId !== null && state.loading,
    collection: state.collection,
    workflowsCollection: state.collection,
  };
}

export function useWorkflowStatusesCollection(params: { readonly churchId: string | null }) {
  const result = useQuery(
    api.workDefaults.readForChurch,
    params.churchId ? { churchId: params.churchId } : "skip",
  );
  const state = successfulResponseCollection(result, (response) => response.data.workflowStatuses);

  return {
    loading: params.churchId !== null && state.loading,
    collection: state.collection,
    workflowStatusesCollection: state.collection,
  };
}

export function useCreateWorkflowMutation() {
  return useMutation(api.workflows.createForChurch).withOptimisticUpdate(
    collectionListOptimisticUpdate({
      query: api.workDefaults.readForChurch,
      collectionKey: "workflows",
      patch: (
        workflows: readonly WorkflowItem[],
        args: { readonly name: string; readonly isDefault?: boolean },
      ) => {
        const isDefault = args.isDefault ?? false;
        const withDefault = isDefault
          ? workflows.map((workflow) =>
              workflow.isDefault ? { ...workflow, isDefault: false } : workflow,
            )
          : workflows;
        return appendItem(withDefault, {
          id: optimisticId("workflow"),
          name: args.name,
          isDefault,
          sortOrder:
            workflows.reduce((max, workflow) => Math.max(max, workflow.sortOrder ?? -1), -1) + 1,
        });
      },
    }),
  );
}

export function useRenameWorkflowMutation() {
  return useMutation(api.workflows.renameForChurch).withOptimisticUpdate(
    collectionItemOptimisticUpdate({
      query: api.workDefaults.readForChurch,
      collectionKey: "workflows",
      patch: (
        workflow: WorkflowItem,
        args: { readonly workflowId: string; readonly name: string },
      ) => (workflow.id === args.workflowId ? { ...workflow, name: args.name } : undefined),
    }),
  );
}

export function useReorderWorkflowsMutation() {
  return useMutation(api.workflows.reorderForChurch).withOptimisticUpdate(
    collectionListOptimisticUpdate({
      query: api.workDefaults.readForChurch,
      collectionKey: "workflows",
      patch: (
        workflows: readonly WorkflowItem[],
        args: { readonly workflowIds: readonly string[] },
      ) => reorderBySortOrder(workflows, args.workflowIds),
    }),
  );
}

export function useArchiveWorkflowMutation() {
  return useMutation(api.workflows.archiveForChurch).withOptimisticUpdate(
    collectionListOptimisticUpdate({
      query: api.workDefaults.readForChurch,
      collectionKey: "workflows",
      patch: (workflows: readonly WorkflowItem[], args: { readonly workflowId: string }) =>
        removeById(workflows, args.workflowId),
    }),
  );
}

export function useSetDefaultWorkflowMutation() {
  return useMutation(api.workflows.setDefaultForChurch).withOptimisticUpdate(
    collectionListOptimisticUpdate({
      query: api.workDefaults.readForChurch,
      collectionKey: "workflows",
      patch: (workflows: readonly WorkflowItem[], args: { readonly workflowId: string }) =>
        workflows.map((workflow) => {
          const shouldBeDefault = workflow.id === args.workflowId;
          return workflow.isDefault === shouldBeDefault
            ? workflow
            : { ...workflow, isDefault: shouldBeDefault };
        }),
    }),
  );
}

export function useAddWorkflowStatusMutation() {
  return useMutation(api.workflows.addStatus).withOptimisticUpdate(
    collectionListOptimisticUpdate({
      query: api.workDefaults.readForChurch,
      collectionKey: "workflowStatuses",
      patch: (
        statuses: readonly WorkflowStatusItem[],
        args: {
          readonly workflowId: string;
          readonly status: { readonly name: string; readonly taskState: TaskStatus };
        },
      ) =>
        appendItem(statuses, {
          id: optimisticId("status"),
          workflowId: args.workflowId,
          name: args.status.name,
          taskState: args.status.taskState,
          sortOrder:
            statuses
              .filter((status) => status.workflowId === args.workflowId)
              .reduce((max, status) => Math.max(max, status.sortOrder ?? -1), -1) + 1,
        }),
    }),
  );
}

export function useRenameWorkflowStatusMutation() {
  return useMutation(api.workflows.renameStatus).withOptimisticUpdate(
    collectionItemOptimisticUpdate({
      query: api.workDefaults.readForChurch,
      collectionKey: "workflowStatuses",
      patch: (status: WorkflowStatusItem, args: { readonly n: string; readonly name: string }) =>
        status.id === args.n ? { ...status, name: args.name } : undefined,
    }),
  );
}

export function useReorderWorkflowStatusesMutation() {
  return useMutation(api.workflows.reorderStatuses).withOptimisticUpdate(
    collectionListOptimisticUpdate({
      query: api.workDefaults.readForChurch,
      collectionKey: "workflowStatuses",
      patch: (statuses: readonly WorkflowStatusItem[], args: { readonly ns: readonly string[] }) =>
        reorderStatusesByIds(statuses, args.ns),
    }),
  );
}

export function useArchiveWorkflowStatusMutation() {
  return useMutation(api.workflows.archiveStatus).withOptimisticUpdate(
    collectionListOptimisticUpdate({
      query: api.workDefaults.readForChurch,
      collectionKey: "workflowStatuses",
      patch: (statuses: readonly WorkflowStatusItem[], args: { readonly n: string }) =>
        removeById(statuses, args.n),
    }),
  );
}

/**
 * Reorder only the statuses referenced by `orderedIds` (a single Workflow's
 * statuses), assigning each its new 0-based `sortOrder`, while leaving statuses
 * from other Workflows untouched in place.
 */
function reorderStatusesByIds(
  statuses: readonly WorkflowStatusItem[],
  orderedIds: readonly string[],
): readonly WorkflowStatusItem[] {
  const reordered = orderedIds
    .map((id) => statuses.find((status) => status.id === id))
    .filter((status): status is WorkflowStatusItem => status !== undefined);
  if (reordered.length !== orderedIds.length) return statuses;

  const newOrderById = new Map(orderedIds.map((id, index) => [id, index]));
  return statuses.map((status) => {
    const nextSortOrder = newOrderById.get(status.id);
    if (nextSortOrder === undefined || status.sortOrder === nextSortOrder) return status;
    return { ...status, sortOrder: nextSortOrder };
  });
}
