export type TaskBoardTaskState = "todo" | "in_progress" | "done" | "canceled";

export type TaskBoardEstimate = "xs" | "s" | "m" | "l" | "xl";

export type TaskBoardWorkflowStatus = {
  readonly id: string;
  // The owning Workflow; used to scope per-card status pickers on cross-team
  // boards (ADR 0013: every Team owns its Workflow).
  readonly workflowId?: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly taskState: TaskBoardTaskState;
  readonly archivedAt?: string | null;
};

export type TaskBoardTask = {
  readonly id: string;
  // The Task Identifier (e.g. "PRD-48"): the Team Identifier plus the Task's
  // per-Team sequence number, computed by the backend at read time (ADR 0013).
  readonly identifier: string;
  readonly title: string;
  // The Task's Team's Workflow (ADR 0013: every Team owns its Workflow);
  // scopes the card's status picker on cross-team boards.
  readonly workflowId: string;
  readonly workflowStatusId: string;
  readonly taskState: TaskBoardTaskState;
  readonly boardOrder?: string;
  readonly teamId: string;
  readonly assignedUserId?: string | null;
  readonly dueDate?: string | null;
  readonly estimate?: TaskBoardEstimate | null;
  readonly createdAt?: number | null;
  readonly labelIds?: readonly string[];
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

export type TaskBoardGrouping = "workflow_status" | "task_state" | "assignee" | "team" | "estimate";

export type TaskBoardGroupColumn = {
  readonly id: string;
  readonly title: string;
  readonly taskState: TaskBoardTaskState | null;
};

export type TaskBoardColumnMove = {
  readonly taskId: string;
  readonly columnId: string;
};

export const UNASSIGNED_COLUMN_ID = "unassigned";
export const NO_ESTIMATE_COLUMN_ID = "no_estimate";

// "No estimate" first to match the Unassigned / No Team columns, then sizes
// ascending.
const ESTIMATE_COLUMNS: ReadonlyArray<{
  readonly id: TaskBoardEstimate;
  readonly title: string;
}> = [
  { id: "xs", title: "XS" },
  { id: "s", title: "S" },
  { id: "m", title: "M" },
  { id: "l", title: "L" },
  { id: "xl", title: "XL" },
];

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
      return task.teamId;
    case "estimate":
      return task.estimate ?? NO_ESTIMATE_COLUMN_ID;
  }
}

export function buildTaskBoardGroupColumns(args: {
  readonly grouping: TaskBoardGrouping;
  readonly workflowStatuses: readonly TaskBoardWorkflowStatus[];
  readonly assignees: readonly { readonly id: string; readonly label: string }[];
  readonly teams: readonly { readonly id: string; readonly name: string }[];
  readonly tasks: readonly TaskBoardTask[];
  readonly showEmptyColumns: boolean;
  readonly hiddenColumnIds?: ReadonlySet<string>;
}): TaskBoardGroupColumn[] {
  const hiddenColumnIds = args.hiddenColumnIds ?? new Set<string>();
  const columns = ((): TaskBoardGroupColumn[] => {
    switch (args.grouping) {
      case "workflow_status":
        return buildTaskBoardColumns(args.workflowStatuses)
          .filter((column) => !hiddenColumnIds.has(column.id))
          .map((column) => ({ id: column.id, title: column.title, taskState: column.taskState }));
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
        return args.teams.map((team) => ({ id: team.id, title: team.name, taskState: null }));
      case "estimate":
        return [
          { id: NO_ESTIMATE_COLUMN_ID, title: "No estimate", taskState: null },
          ...ESTIMATE_COLUMNS.map((column) => ({
            id: column.id,
            title: column.title,
            taskState: null,
          })),
        ];
    }
  })();

  if (args.showEmptyColumns) return columns;

  const populatedColumnIds = new Set(
    args.tasks.map((task) => getTaskGroupColumnId(args.grouping, task)),
  );
  return columns.filter((column) => populatedColumnIds.has(column.id));
}

export function compareBoardOrder(left: TaskBoardTask, right: TaskBoardTask): number {
  if (left.boardOrder != null && right.boardOrder != null) {
    return left.boardOrder < right.boardOrder ? -1 : left.boardOrder > right.boardOrder ? 1 : 0;
  }
  if (left.boardOrder != null) return -1;
  if (right.boardOrder != null) return 1;
  return (left.createdAt ?? 0) - (right.createdAt ?? 0);
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

  for (const columnId of Object.keys(grouped)) {
    grouped[columnId] = [...grouped[columnId]].sort(compareBoardOrder);
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

function findColumnOfTask(columns: TaskBoardColumns, taskId: string): string | undefined {
  return Object.keys(columns).find((columnId) =>
    columns[columnId].some((task) => task.id === taskId),
  );
}

export function isTaskBoardGroupingDraggable(grouping: TaskBoardGrouping): boolean {
  return (
    grouping === "workflow_status" ||
    grouping === "assignee" ||
    grouping === "task_state" ||
    grouping === "estimate"
  );
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
    case "estimate":
      return {
        ...task,
        estimate: columnId === NO_ESTIMATE_COLUMN_ID ? null : (columnId as TaskBoardEstimate),
      };
    case "task_state":
      // The caller resolves the dropped Task State to a status in the Task's
      // own Team Workflow (ADR 0013).
      return { ...task, taskState: columnId as TaskBoardTaskState };
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
  const sourceColumnId = findColumnOfTask(args.columns, args.taskId);

  if (!sourceColumnId || !(args.destinationColumnId in args.columns)) {
    return args.columns;
  }

  if (sourceColumnId !== args.destinationColumnId) {
    void args.persistMove({ taskId: args.taskId, columnId: args.destinationColumnId });
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
      args.persistMove({ taskId: move.taskId, workflowStatusId: move.columnId, boardOrder: "" }),
  });
}

export function computeBoardMoves(args: {
  readonly columns: TaskBoardColumns;
  readonly activeTaskId: string;
  readonly selectedTaskIds?: ReadonlySet<string>;
}): readonly TaskBoardMove[] {
  const destinationId = findColumnOfTask(args.columns, args.activeTaskId);
  if (!destinationId) return [];

  const selected = args.selectedTaskIds ?? new Set<string>();
  const isGroupDrag = selected.has(args.activeTaskId) && selected.size > 1;
  const movedTasks = isGroupDrag
    ? Object.keys(args.columns).flatMap((columnId) =>
        args.columns[columnId].filter(
          (task) => selected.has(task.id) && task.taskState !== "canceled",
        ),
      )
    : args.columns[destinationId].filter((task) => task.id === args.activeTaskId);

  if (movedTasks.length === 0) return [];

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

function generateBoardOrderKeys(
  beforeKey: string | null,
  afterKey: string | null,
  count: number,
): readonly string[] {
  const prefix = beforeKey?.match(/^[a-zA-Z]+/)?.[0] ?? afterKey?.match(/^[a-zA-Z]+/)?.[0] ?? "a";
  const before = parseBoardOrderKey(beforeKey, prefix);
  const after = parseBoardOrderKey(afterKey, prefix);
  const upper = after !== null && after > before ? after : before + count + 1;
  const step = (upper - before) / (count + 1);

  return Array.from({ length: count }, (_, index) =>
    formatBoardOrderKey(prefix, before + step * (index + 1)),
  );
}

function parseBoardOrderKey(key: string | null, prefix: string): number {
  if (key === null) return 0;
  const parsed = Number.parseFloat(key.startsWith(prefix) ? key.slice(prefix.length) : key);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBoardOrderKey(prefix: string, value: number): string {
  return `${prefix}${value.toFixed(12).replace(/0+$/, "").replace(/\.$/, "")}`;
}
