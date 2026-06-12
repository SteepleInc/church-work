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
};

/**
 * Board Column grouping (see CONTEXT.md — a Board Column is a presentation
 * lane, not a status). Workflow Status is the default; the others present the
 * same Tasks re-grouped client-side.
 */
export type TaskBoardGrouping = "workflow_status" | "task_state" | "assignee" | "team";

export type TaskBoardGroupColumn = {
  readonly id: string;
  readonly title: string;
  // Set for workflow_status/task_state groupings; null for assignee/team.
  readonly taskState: TaskBoardTaskState | null;
};

export type TaskBoardColumnMove = {
  readonly taskId: string;
  readonly columnId: string;
};

export const UNASSIGNED_COLUMN_ID = "unassigned";
export const NO_TEAM_COLUMN_ID = "no_team";

const TASK_STATE_LABELS: Record<TaskBoardTaskState, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  canceled: "Canceled",
};

export function taskStateLabel(taskState: TaskBoardTaskState): string {
  return TASK_STATE_LABELS[taskState];
}

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

export function getTaskGroupColumnId(grouping: TaskBoardGrouping, task: TaskBoardTask): string {
  switch (grouping) {
    case "workflow_status":
      return task.workflowStatusId;
    case "task_state":
      return task.taskState;
    case "assignee":
      return task.assignedUserId ?? UNASSIGNED_COLUMN_ID;
    case "team":
      return task.teamId ?? NO_TEAM_COLUMN_ID;
  }
}

export function buildTaskBoardGroupColumns(args: {
  readonly grouping: TaskBoardGrouping;
  readonly workflowStatuses: readonly TaskBoardWorkflowStatus[];
  readonly assignees: readonly { readonly id: string; readonly label: string }[];
  readonly teams: readonly { readonly id: string; readonly name: string }[];
  readonly tasks: readonly TaskBoardTask[];
  readonly showEmptyColumns: boolean;
}): TaskBoardGroupColumn[] {
  const columns = ((): TaskBoardGroupColumn[] => {
    switch (args.grouping) {
      case "workflow_status":
        return buildTaskBoardColumns(args.workflowStatuses).map((column) => ({
          id: column.id,
          title: column.title,
          taskState: column.taskState,
        }));
      case "task_state":
        return (["todo", "in_progress", "done", "canceled"] as const).map((state) => ({
          id: state,
          title: TASK_STATE_LABELS[state],
          taskState: state,
        }));
      case "assignee":
        return [
          { id: UNASSIGNED_COLUMN_ID, title: "Unassigned", taskState: null },
          ...args.assignees.map((assignee) => ({
            id: assignee.id,
            title: assignee.label,
            taskState: null,
          })),
        ];
      case "team":
        return [
          { id: NO_TEAM_COLUMN_ID, title: "No Team", taskState: null },
          ...args.teams.map((team) => ({ id: team.id, title: team.name, taskState: null })),
        ];
    }
  })();

  if (args.showEmptyColumns) return columns;

  const populatedColumnIds = new Set(
    args.tasks.map((task) => getTaskGroupColumnId(args.grouping, task)),
  );
  return columns.filter((column) => populatedColumnIds.has(column.id));
}

export function groupTasksByColumn(
  grouping: TaskBoardGrouping,
  columns: readonly TaskBoardGroupColumn[],
  tasks: readonly TaskBoardTask[],
): TaskBoardColumns {
  const grouped = Object.fromEntries(columns.map((column) => [column.id, []])) as TaskBoardColumns;
  const columnIds = new Set(columns.map((column) => column.id));

  for (const task of tasks) {
    const columnId = getTaskGroupColumnId(grouping, task);
    if (!columnIds.has(columnId)) continue;
    grouped[columnId] = [...grouped[columnId], task];
  }

  return grouped;
}

export function groupTasksByWorkflowStatus(
  columns: readonly TaskBoardColumn[],
  tasks: readonly TaskBoardTask[],
): TaskBoardColumns {
  return groupTasksByColumn(
    "workflow_status",
    columns.map((column) => ({ ...column, taskState: column.taskState as TaskBoardTaskState })),
    tasks,
  );
}

/**
 * Dragging between Board Columns mutates the grouped field, so it is only
 * enabled where that mutation is a clean single-field write. Team grouping
 * requires a Workflow remap and Task State grouping maps to many statuses;
 * both stay read-only lanes for now.
 */
export function isTaskBoardGroupingDraggable(grouping: TaskBoardGrouping): boolean {
  return grouping === "workflow_status" || grouping === "assignee";
}

function applyColumnToTask(
  grouping: TaskBoardGrouping,
  task: TaskBoardTask,
  columnId: string,
): TaskBoardTask {
  switch (grouping) {
    case "workflow_status":
      return { ...task, workflowStatusId: columnId };
    case "assignee":
      return {
        ...task,
        assignedUserId: columnId === UNASSIGNED_COLUMN_ID ? null : columnId,
      };
    case "task_state":
    case "team":
      return task;
  }
}

export function moveTaskBetweenGroupColumns(args: {
  readonly grouping: TaskBoardGrouping;
  readonly columns: TaskBoardColumns;
  readonly taskId: string;
  readonly destinationColumnId: string;
  readonly destinationIndex: number;
  readonly persistMove: (move: TaskBoardColumnMove) => void | Promise<void>;
}) {
  const sourceColumnId = Object.keys(args.columns).find((columnId) =>
    args.columns[columnId].some((task) => task.id === args.taskId),
  );

  if (!sourceColumnId || !(args.destinationColumnId in args.columns)) {
    return args.columns;
  }

  if (sourceColumnId !== args.destinationColumnId) {
    void args.persistMove({
      taskId: args.taskId,
      columnId: args.destinationColumnId,
    });
  }

  const sourceTasks = args.columns[sourceColumnId];
  const task = sourceTasks.find((candidate) => candidate.id === args.taskId);
  if (!task) return args.columns;

  const nextColumns: TaskBoardColumns = { ...args.columns };
  nextColumns[sourceColumnId] = sourceTasks.filter((candidate) => candidate.id !== task.id);

  const destinationTasks =
    sourceColumnId === args.destinationColumnId
      ? nextColumns[args.destinationColumnId]
      : args.columns[args.destinationColumnId];
  const destinationIndex = Math.max(0, Math.min(args.destinationIndex, destinationTasks.length));

  nextColumns[args.destinationColumnId] = [
    ...destinationTasks.slice(0, destinationIndex),
    applyColumnToTask(args.grouping, task, args.destinationColumnId),
    ...destinationTasks.slice(destinationIndex),
  ];

  return nextColumns;
}

export function moveTaskBetweenBoardColumns(args: {
  readonly columns: TaskBoardColumns;
  readonly taskId: string;
  readonly destinationWorkflowStatusId: string;
  readonly destinationIndex: number;
  readonly persistMove: (move: TaskBoardMove) => void | Promise<void>;
}) {
  return moveTaskBetweenGroupColumns({
    grouping: "workflow_status",
    columns: args.columns,
    taskId: args.taskId,
    destinationColumnId: args.destinationWorkflowStatusId,
    destinationIndex: args.destinationIndex,
    persistMove: (move) =>
      args.persistMove({ taskId: move.taskId, workflowStatusId: move.columnId }),
  });
}
