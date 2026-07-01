import {
  mutators,
  queries,
  type Team,
  type Workflow,
  type WorkflowStatus,
} from "@church-work/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";

type TaskStatus = "todo" | "in_progress" | "done" | "canceled";

type WorkflowItem = {
  readonly id: string;
  // Every Team owns its Workflow (ADR 0013): the owning Team's id.
  readonly teamId: string;
  readonly key: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly archivedAt: string | null;
};

type WorkflowStatusItem = {
  readonly id: string;
  readonly workflowId: string;
  readonly key: string;
  readonly name: string;
  readonly taskState: TaskStatus;
  readonly sortOrder: number;
  readonly archivedAt: string | null;
};

type MutationResult = Promise<
  { readonly ok: true } | { readonly ok: false; readonly error: { readonly message: string } }
>;
type ZeroMutationResult = {
  readonly server: Promise<
    | { readonly type: "success" }
    | { readonly type: "error"; readonly error: { readonly message: string } }
  >;
};

const mutationResult = async (run: () => ZeroMutationResult): MutationResult => {
  try {
    const result = await run().server;

    if (result.type === "error") {
      return { error: { message: result.error.message }, ok: false };
    }

    return { ok: true };
  } catch (error) {
    return {
      error: { message: error instanceof Error ? error.message : "Could not update Workflows." },
      ok: false,
    };
  }
};

const workflowKey = (workflow: Workflow): string => workflow.team_id;

const taskStatus = (value: string): TaskStatus => {
  if (value === "todo" || value === "in_progress" || value === "done" || value === "canceled") {
    return value;
  }

  return "todo";
};

const deletedAt = (value: number | null | undefined): string | null =>
  typeof value === "number" ? new Date(value).toISOString() : null;

const mapWorkflow = (workflow: Workflow, teamsById: ReadonlyMap<string, Team>): WorkflowItem => ({
  archivedAt: deletedAt(workflow.deleted_at),
  id: workflow.id,
  key: workflowKey(workflow),
  name: workflow.name,
  sortOrder: teamsById.get(workflow.team_id)?.sort_order ?? 0,
  teamId: workflow.team_id,
});

const mapWorkflowStatus = (status: WorkflowStatus): WorkflowStatusItem => ({
  archivedAt: deletedAt(status.deleted_at),
  id: status.id,
  key: status.key,
  name: status.name,
  sortOrder: status.sort_order,
  taskState: taskStatus(status.task_state),
  workflowId: status.workflow_id,
});

export function useWorkflowsCollection(params: { readonly churchId: string | null }) {
  const [workflowRows] = useQuery(
    queries.workflows.by_church({ church_id: params.churchId ?? "__no_church__" }),
  );
  const [teamRows] = useQuery(
    queries.teams.by_church({ church_id: params.churchId ?? "__no_church__" }),
  );
  const teamsById = new Map(teamRows.map((team) => [team.id, team]));
  const collection =
    params.churchId === null
      ? []
      : workflowRows
          .map((workflow) => mapWorkflow(workflow, teamsById))
          .sort((left, right) => left.sortOrder - right.sortOrder);

  return {
    loading: false,
    collection,
    workflowsCollection: collection,
  };
}

export function useWorkflowStatusesCollection(params: { readonly churchId: string | null }) {
  const [rows] = useQuery(
    queries.workflow_statuses.by_church({ church_id: params.churchId ?? "__no_church__" }),
  );
  const collection = params.churchId === null ? [] : rows.map(mapWorkflowStatus);

  return {
    loading: false,
    collection,
    workflowStatusesCollection: collection,
  };
}

/**
 * Resolves a single Workflow Status's current name by id through its own
 * `workflow_statuses.by_id` subscription, for per-row lookups (e.g. naming the
 * from/to status of an Activity Feed status-change line). Returns `null` while
 * loading or when the status is gone, so callers can fall back to a snapshot
 * label. Zero dedupes identical subscriptions, so many rows naming the same
 * status share one query.
 */
export function useWorkflowStatusName(params: {
  readonly churchId: string | null;
  readonly statusId: string | null;
}): string | null {
  const [row] = useQuery(
    queries.workflow_statuses.by_id({
      church_id: params.churchId ?? "__no_church__",
      id: params.statusId ?? "__no_status__",
    }),
    { enabled: params.churchId !== null && params.statusId !== null },
  );

  return row?.name ?? null;
}

/**
 * Resolves a single Workflow Status's current name *and* its `taskState` by id,
 * for per-row lookups that need the matching Workflow Status glyph (e.g. a Task
 * Draft card showing the status the draft would land in). Returns `null` while
 * loading or when the status is gone, so callers can omit the chip entirely.
 */
export function useWorkflowStatusMeta(params: {
  readonly churchId: string | null;
  readonly statusId: string | null;
}): { readonly name: string; readonly taskState: TaskStatus } | null {
  const [row] = useQuery(
    queries.workflow_statuses.by_id({
      church_id: params.churchId ?? "__no_church__",
      id: params.statusId ?? "__no_status__",
    }),
    { enabled: params.churchId !== null && params.statusId !== null },
  );

  return row ? { name: row.name, taskState: taskStatus(row.task_state) } : null;
}

export function useRenameWorkflowMutation() {
  const zero = useZero();

  return (params: {
    readonly churchId: string;
    readonly name: string;
    readonly workflowId: string;
  }) =>
    mutationResult(() =>
      zero.mutate(
        mutators.workflows.rename({
          church_id: params.churchId,
          name: params.name,
          workflow_id: params.workflowId,
        }),
      ),
    );
}

export function useReorderWorkflowsMutation() {
  const zero = useZero();

  return (params: { readonly churchId: string; readonly workflowIds: readonly string[] }) =>
    mutationResult(() =>
      zero.mutate(
        mutators.workflows.reorder({
          church_id: params.churchId,
          workflow_ids: [...params.workflowIds],
        }),
      ),
    );
}

export function useArchiveWorkflowMutation() {
  const zero = useZero();

  return (params: { readonly churchId: string; readonly workflowId: string }) =>
    mutationResult(() =>
      zero.mutate(
        mutators.workflows.archive({
          church_id: params.churchId,
          workflow_id: params.workflowId,
        }),
      ),
    );
}

export function useAddWorkflowStatusMutation() {
  const zero = useZero();

  return (params: {
    readonly churchId: string;
    readonly workflowId: string;
    readonly status: {
      readonly key: string;
      readonly name: string;
      readonly taskState: TaskStatus;
      readonly sortOrder: number;
    };
  }) =>
    mutationResult(() =>
      zero.mutate(
        mutators.workflows.add_status({
          church_id: params.churchId,
          status: {
            key: params.status.key,
            name: params.status.name,
            sort_order: params.status.sortOrder,
            task_state: params.status.taskState,
          },
          workflow_id: params.workflowId,
        }),
      ),
    );
}

export function useRenameWorkflowStatusMutation() {
  const zero = useZero();

  return (params: {
    readonly churchId: string;
    readonly name: string;
    readonly statusId: string;
  }) =>
    mutationResult(() =>
      zero.mutate(
        mutators.workflows.rename_status({
          church_id: params.churchId,
          name: params.name,
          status_id: params.statusId,
        }),
      ),
    );
}

export function useReorderWorkflowStatusesMutation() {
  const zero = useZero();

  return (params: {
    readonly churchId: string;
    readonly statusIds: readonly string[];
    readonly workflowId: string;
  }) =>
    mutationResult(() =>
      zero.mutate(
        mutators.workflows.reorder_statuses({
          church_id: params.churchId,
          status_ids: [...params.statusIds],
          workflow_id: params.workflowId,
        }),
      ),
    );
}

export function useArchiveWorkflowStatusMutation() {
  const zero = useZero();

  return (params: {
    readonly archivedAt?: string;
    readonly churchId: string;
    readonly statusId: string;
  }) =>
    mutationResult(() =>
      zero.mutate(
        mutators.workflows.archive_status({
          church_id: params.churchId,
          status_id: params.statusId,
        }),
      ),
    );
}
