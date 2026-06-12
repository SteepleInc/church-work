import { generateNKeysBetween } from "fractional-indexing";

export type TaskBoardTaskState = "todo" | "in_progress" | "done" | "canceled";

export type TaskBoardWorkflowStatus = {
  readonly id: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly taskState: TaskBoardTaskState;
  readonly archivedAt?: string | null;
};

export type TaskBoardTask = {
  readonly id: string;
  readonly title: string;
  readonly workflowStatusId: string;
  readonly taskState: TaskBoardTaskState;
  // Board Order key (ADR 0012). Optional so the board tolerates cached rows
  // from before the field existed; unkeyed Tasks sort to the end of a column.
  readonly boardOrder?: string;
  readonly teamId?: string | null;
  readonly assignedUserId?: string | null;
  readonly dueDate?: string | null;
  readonly createdAt?: number | null;
  readonly parentTask?: {
    readonly id: string;
    readonly title: string;
  } | null;
};

export type TaskBoardColumn = {
  readonly id: string;
  readonly title: string;
  readonly taskState: Exclude<TaskBoardTaskState, "canceled">;
};

export type TaskBoardColumns = Record<string, TaskBoardTask[]>;

export type TaskBoardMove = {
  readonly taskId: string;
  readonly workflowStatusId: string;
  readonly boardOrder: string;
};

export function buildTaskBoardColumns(statuses: readonly TaskBoardWorkflowStatus[]) {
  return statuses
    .filter(
      (
        status,
      ): status is TaskBoardWorkflowStatus & { readonly taskState: TaskBoardColumn["taskState"] } =>
        status.archivedAt == null && status.taskState !== "canceled",
    )
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map(
      (status): TaskBoardColumn => ({
        id: status.id,
        title: status.name,
        taskState: status.taskState,
      }),
    );
}

/**
 * Board Order comparison: fractional-indexing keys compare as plain strings.
 * Tasks without a key sort after keyed ones, oldest first, so legacy rows
 * stay stable at the bottom of a column.
 */
export function compareBoardOrder(left: TaskBoardTask, right: TaskBoardTask): number {
  if (left.boardOrder != null && right.boardOrder != null) {
    return left.boardOrder < right.boardOrder ? -1 : left.boardOrder > right.boardOrder ? 1 : 0;
  }
  if (left.boardOrder != null) return -1;
  if (right.boardOrder != null) return 1;
  return (left.createdAt ?? 0) - (right.createdAt ?? 0);
}

export function groupTasksByWorkflowStatus(
  columns: readonly TaskBoardColumn[],
  tasks: readonly TaskBoardTask[],
): TaskBoardColumns {
  const grouped = Object.fromEntries(columns.map((column) => [column.id, []])) as TaskBoardColumns;
  const columnIds = new Set(columns.map((column) => column.id));

  for (const task of tasks) {
    if (!columnIds.has(task.workflowStatusId)) continue;
    grouped[task.workflowStatusId] = [...grouped[task.workflowStatusId], task];
  }

  for (const columnId of Object.keys(grouped)) {
    grouped[columnId] = [...grouped[columnId]].sort(compareBoardOrder);
  }

  return grouped;
}

function findColumnOfTask(columns: TaskBoardColumns, taskId: string): string | undefined {
  return Object.keys(columns).find((columnId) =>
    columns[columnId].some((task) => task.id === taskId),
  );
}

/**
 * Compute the persisted Board moves for a finished drag.
 *
 * `columns` is the preview layout at drop time: the dragged Task already sits
 * at its destination position (dnd-kit live-sorts during the drag), while any
 * other selected Tasks are still in their original spots. The moved group is
 * the selection when it contains the dragged Task (group drag), otherwise just
 * the dragged Task. Group members keep their relative visual order and are
 * inserted contiguously at the dragged Task's position, each receiving a fresh
 * fractional Board Order key between the destination neighbors (ADR 0012).
 */
export function computeBoardMoves(args: {
  readonly columns: TaskBoardColumns;
  readonly activeTaskId: string;
  readonly selectedTaskIds?: ReadonlySet<string>;
}): readonly TaskBoardMove[] {
  const destinationId = findColumnOfTask(args.columns, args.activeTaskId);
  if (!destinationId) return [];

  const selected = args.selectedTaskIds ?? new Set<string>();
  const isGroupDrag = selected.has(args.activeTaskId) && selected.size > 1;

  // Visual order of the moved group: walk columns in order, keeping each
  // selected Task's relative position (the dragged Task is at its destination
  // slot already, so the group lands in drop order).
  const movedTasks = isGroupDrag
    ? Object.keys(args.columns).flatMap((columnId) =>
        args.columns[columnId].filter(
          (task) => selected.has(task.id) && task.taskState !== "canceled",
        ),
      )
    : args.columns[destinationId].filter((task) => task.id === args.activeTaskId);

  if (movedTasks.length === 0) return [];

  // Neighbors at the insertion point: the destination column with every moved
  // Task removed except the dragged one, which marks the insertion slot.
  const movedIds = new Set(movedTasks.map((task) => task.id));
  const destinationTasks = args.columns[destinationId].filter(
    (task) => task.id === args.activeTaskId || !movedIds.has(task.id),
  );
  const insertionIndex = destinationTasks.findIndex((task) => task.id === args.activeTaskId);
  const beforeKey = destinationTasks[insertionIndex - 1]?.boardOrder ?? null;
  const afterKey = destinationTasks[insertionIndex + 1]?.boardOrder ?? null;

  const keys = generateBoardOrderKeys(beforeKey, afterKey, movedTasks.length);

  return movedTasks.map((task, index) => ({
    taskId: task.id,
    workflowStatusId: destinationId,
    boardOrder: keys[index],
  }));
}

/**
 * Generate `count` keys between two neighbors, falling back to appending after
 * the lower neighbor when the surrounding keys are inconsistent (e.g. legacy
 * rows without keys produced an inverted pair).
 */
function generateBoardOrderKeys(
  beforeKey: string | null,
  afterKey: string | null,
  count: number,
): readonly string[] {
  try {
    return generateNKeysBetween(beforeKey, afterKey, count);
  } catch {
    return generateNKeysBetween(beforeKey, null, count);
  }
}
