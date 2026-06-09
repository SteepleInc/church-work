import type { TaskStatus } from "@church-task/domain";

/**
 * Minimal shape of a serialized Task as returned inside `mcpListTasks`.
 * Mirrors `TaskSchema` in `@church-task/domain/Task`; kept structural so the
 * optimistic merge stays decoupled from the full backend response type.
 */
export type OptimisticTask = {
  readonly id: string;
  readonly assignedUserId: string | null;
  readonly teamId: string | null;
  readonly workflowStatusId: string;
  readonly taskState: TaskStatus;
  readonly dueDate: string;
  readonly cycleId: string;
  readonly parentTaskId: string | null;
};

/**
 * Fields a client can change through `mcpUpdateTask`. Subset of the backend
 * `fields` arg that the board actually drives (status, assignee, etc.).
 */
export type TaskUpdateFields = {
  readonly title?: string;
  readonly assignedUserId?: string | null;
  readonly teamId?: string | null;
  readonly workflowStatusId?: string;
  readonly dueDate?: string;
  readonly cycleId?: string;
  readonly parentTaskId?: string | null;
};

/**
 * Lookup from a Workflow Status id to its derived Task state. Used so that an
 * optimistic `workflowStatusId` change also moves the Task into the matching
 * Kanban column (which groups by Workflow Status but falls back to taskState).
 */
export type WorkflowStatusStateLookup = (workflowStatusId: string) => TaskStatus | undefined;

/**
 * Apply a single `mcpUpdateTask` to one serialized Task, returning a new Task.
 *
 * When `workflowStatusId` changes we also recompute `taskState` from the
 * provided lookup so the optimistic Task lands in the correct column with the
 * correct status icon. If the lookup can't resolve the new status (e.g. the
 * Workflow Statuses query isn't cached yet) the previous `taskState` is kept;
 * the authoritative value arrives when the mutation result is synced.
 */
export function applyTaskUpdate<Task extends OptimisticTask>(
  task: Task,
  fields: TaskUpdateFields,
  resolveTaskState: WorkflowStatusStateLookup,
): Task {
  const nextWorkflowStatusId = fields.workflowStatusId ?? task.workflowStatusId;
  const nextTaskState =
    fields.workflowStatusId !== undefined
      ? (resolveTaskState(fields.workflowStatusId) ?? task.taskState)
      : task.taskState;

  return {
    ...task,
    ...(fields.assignedUserId !== undefined ? { assignedUserId: fields.assignedUserId } : {}),
    ...(fields.teamId !== undefined ? { teamId: fields.teamId } : {}),
    ...(fields.dueDate !== undefined ? { dueDate: fields.dueDate } : {}),
    ...(fields.cycleId !== undefined ? { cycleId: fields.cycleId } : {}),
    ...(fields.parentTaskId !== undefined ? { parentTaskId: fields.parentTaskId } : {}),
    workflowStatusId: nextWorkflowStatusId,
    taskState: nextTaskState,
  };
}

/** Task transitions that map directly to a terminal/initial Task state. */
export type TaskTransition = "complete" | "cancel" | "reopen";

const TRANSITION_TASK_STATE: Record<TaskTransition, TaskStatus> = {
  complete: "done",
  cancel: "canceled",
  reopen: "todo",
};

/**
 * Apply a Task transition (`complete`/`cancel`/`reopen`) to one serialized Task.
 *
 * The client does not know which Workflow Status the server will assign, so we
 * only set the derived `taskState` optimistically (enough to dim canceled cards
 * and swap the status icon). The authoritative `workflowStatusId` arrives when
 * the mutation result syncs.
 */
export function applyTaskTransition<Task extends OptimisticTask>(
  task: Task,
  transition: TaskTransition,
): Task {
  const nextTaskState = TRANSITION_TASK_STATE[transition];
  if (task.taskState === nextTaskState) return task;
  return { ...task, taskState: nextTaskState };
}

/**
 * Minimal shape of a Workflow Status as returned by `workDefaults.readForChurch`
 * (`data.workflowStatuses`). Only the id → state mapping is needed here.
 */
export type WorkflowStatusStateSource = {
  readonly id: string;
  readonly taskState: TaskStatus;
};

/**
 * Build a {@link WorkflowStatusStateLookup} from a list of Workflow Statuses.
 * Returns a lookup that resolves a Workflow Status id to its Task state, or
 * `undefined` when the status is unknown.
 */
export function workflowStatusStateLookup(
  statuses: ReadonlyArray<WorkflowStatusStateSource>,
): WorkflowStatusStateLookup {
  const byId = new Map(statuses.map((status) => [status.id, status.taskState]));
  return (workflowStatusId) => byId.get(workflowStatusId);
}
