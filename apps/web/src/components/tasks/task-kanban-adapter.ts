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

  return grouped;
}

export function moveTaskBetweenBoardColumns(args: {
  readonly columns: TaskBoardColumns;
  readonly taskId: string;
  readonly destinationWorkflowStatusId: string;
  readonly destinationIndex: number;
  readonly persistMove: (move: TaskBoardMove) => void | Promise<void>;
}) {
  const sourceWorkflowStatusId = Object.keys(args.columns).find((columnId) =>
    args.columns[columnId].some((task) => task.id === args.taskId),
  );

  if (!sourceWorkflowStatusId || !(args.destinationWorkflowStatusId in args.columns)) {
    return args.columns;
  }

  if (sourceWorkflowStatusId !== args.destinationWorkflowStatusId) {
    void args.persistMove({
      taskId: args.taskId,
      workflowStatusId: args.destinationWorkflowStatusId,
    });
  }

  const sourceTasks = args.columns[sourceWorkflowStatusId];
  const task = sourceTasks.find((candidate) => candidate.id === args.taskId);
  if (!task) return args.columns;

  const nextColumns: TaskBoardColumns = { ...args.columns };
  nextColumns[sourceWorkflowStatusId] = sourceTasks.filter((candidate) => candidate.id !== task.id);

  const destinationTasks =
    sourceWorkflowStatusId === args.destinationWorkflowStatusId
      ? nextColumns[args.destinationWorkflowStatusId]
      : args.columns[args.destinationWorkflowStatusId];
  const destinationIndex = Math.max(0, Math.min(args.destinationIndex, destinationTasks.length));

  nextColumns[args.destinationWorkflowStatusId] = [
    ...destinationTasks.slice(0, destinationIndex),
    { ...task, workflowStatusId: args.destinationWorkflowStatusId },
    ...destinationTasks.slice(destinationIndex),
  ];

  return nextColumns;
}
