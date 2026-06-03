import { api } from "@church-task/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";

import { successfulResponseCollection } from "@/data/convex-query-adapter";

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
  return useMutation(api.workflows.createForChurch);
}

export function useRenameWorkflowMutation() {
  return useMutation(api.workflows.renameForChurch);
}

export function useReorderWorkflowsMutation() {
  return useMutation(api.workflows.reorderForChurch);
}

export function useArchiveWorkflowMutation() {
  return useMutation(api.workflows.archiveForChurch);
}

export function useSetDefaultWorkflowMutation() {
  return useMutation(api.workflows.setDefaultForChurch);
}

export function useAddWorkflowStatusMutation() {
  return useMutation(api.workflows.addStatus);
}

export function useRenameWorkflowStatusMutation() {
  return useMutation(api.workflows.renameStatus);
}

export function useReorderWorkflowStatusesMutation() {
  return useMutation(api.workflows.reorderStatuses);
}

export function useArchiveWorkflowStatusMutation() {
  return useMutation(api.workflows.archiveStatus);
}
