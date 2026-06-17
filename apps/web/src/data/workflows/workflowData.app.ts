import { recordFromCollection } from "@/data/collection-query-state";
import { useWorkflowsCollection } from "@/data/workflows/workflowsData.app";

export function useWorkflowData(params: {
  readonly churchId: string | null;
  readonly workflowId: string;
}) {
  const workflows = useWorkflowsCollection({ churchId: params.churchId });
  const state = recordFromCollection(workflows, (workflow) => workflow.id === params.workflowId);

  return {
    loading: state.loading,
    workflowOpt: state.record,
  };
}
