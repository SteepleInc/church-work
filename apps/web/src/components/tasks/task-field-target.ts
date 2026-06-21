import type { TaskEstimate } from "./task-card-fields";
import type { TaskBoardEstimate, TaskBoardTask, TaskBoardTaskState } from "./task-kanban-adapter";
import type {
  TaskCardAssignChange,
  TaskCardEstimateChange,
  TaskCardLabelsChange,
  TaskCardStatusChange,
} from "./task-kanban-board";
import type {
  TaskCardDueDateChange,
  TaskStateTransition,
  TaskTransitionChange,
} from "./task-context-menu";

export type TaskFieldTargetLabel = {
  readonly id: string;
  readonly teamId?: string | null;
};

export type TaskFieldTarget = {
  readonly kind: "persisted" | "projected";
  readonly id: string;
  readonly identifier: string;
  readonly title: string;
  readonly description?: string | null;
  readonly rowState: TaskBoardTaskState;
  readonly multiple: boolean;
  readonly targetTaskIds: readonly string[];
  readonly fields: {
    readonly status: {
      readonly value: string | null;
      readonly set?: (next: string | null) => void;
    };
    readonly assignee: {
      readonly value: string | null;
      readonly set?: (next: string | null) => void;
    };
    readonly estimate: {
      readonly value: TaskEstimate;
      readonly set?: (next: TaskEstimate) => void;
    };
    readonly labels: {
      readonly value: readonly string[];
      readonly set?: (next: readonly string[]) => void;
    };
    readonly dueDate: {
      readonly value: string | null;
      readonly set?: (next: string | null) => void;
    };
    readonly team: { readonly value: string; readonly set?: (next: string) => void };
  };
  readonly actions: {
    readonly transition?: (transition: TaskStateTransition) => void;
    readonly open?: () => void;
    readonly copyId?: () => string;
    readonly copyLink?: () => string;
    readonly copyTitle?: () => string;
    readonly copyMarkdown?: () => string;
  };
};

export function labelsForTeam(
  labelIds: readonly string[],
  teamId: string,
  labelOptions: readonly TaskFieldTargetLabel[],
): readonly string[] {
  const labelsById = new Map(labelOptions.map((label) => [label.id, label]));
  return labelIds.filter((labelId) => {
    const label = labelsById.get(labelId);
    return label?.teamId === null || label?.teamId === teamId;
  });
}

function taskToMarkdown(task: Pick<TaskBoardTask, "title" | "description">): string {
  const body = task.description?.trim();
  return body ? `# ${task.title}\n\n${body}\n` : `# ${task.title}\n`;
}

type CommonArgs = {
  readonly task: TaskBoardTask;
  readonly labelOptions: readonly TaskFieldTargetLabel[];
  readonly onAssignTask?: (change: TaskCardAssignChange) => void | Promise<void>;
  readonly onChangeTaskLabels?: (change: TaskCardLabelsChange) => void | Promise<void>;
  readonly onChangeTaskEstimate?: (change: TaskCardEstimateChange) => void | Promise<void>;
  readonly onChangeTaskDueDate?: (change: TaskCardDueDateChange) => void | Promise<void>;
  readonly onChangeTaskTeam?: (change: {
    taskId: string;
    teamId: string;
    labelIds: readonly string[];
  }) => void | Promise<void>;
};

type PersistedArgs = CommonArgs & {
  readonly targetTaskIds: readonly string[];
  readonly onChangeTaskStatus?: (change: TaskCardStatusChange) => void | Promise<void>;
  readonly onTransitionTask?: (change: TaskTransitionChange) => void | Promise<void>;
  readonly onOpenTask?: (taskIdentifier: string) => void;
  readonly buildTaskUrl?: (taskIdentifier: string) => string;
};

export function buildPersistedTaskFieldTarget(args: PersistedArgs): TaskFieldTarget {
  return buildTaskFieldTarget({ ...args, kind: "persisted" });
}

export function buildProjectedTaskFieldTarget(args: CommonArgs): TaskFieldTarget {
  return buildTaskFieldTarget({ ...args, kind: "projected", targetTaskIds: [args.task.id] });
}

function buildTaskFieldTarget(
  args: PersistedArgs & { readonly kind: "persisted" | "projected" },
): TaskFieldTarget {
  const { task, labelOptions } = args;
  const ids = args.targetTaskIds.length > 0 ? args.targetTaskIds : [task.id];
  const multiple = ids.length > 1;
  const applyMany = <T, V>(
    fn: ((change: T) => void | Promise<void>) | undefined,
    build: (taskId: string, next: V) => T,
  ) => {
    if (!fn) return undefined;
    return (next: V) => {
      for (const taskId of ids) void fn(build(taskId, next));
    };
  };

  const statusSet =
    args.kind === "persisted" && args.onChangeTaskStatus
      ? (next: string | null) => {
          if (!next) return;
          for (const taskId of ids)
            void args.onChangeTaskStatus?.({ taskId, workflowStatusId: next });
        }
      : undefined;

  const teamSet = args.onChangeTaskTeam
    ? (nextTeamId: string) => {
        const nextLabelIds = labelsForTeam(task.labelIds ?? [], nextTeamId, labelOptions);
        void args.onChangeTaskTeam?.({
          taskId: task.id,
          teamId: nextTeamId,
          labelIds: nextLabelIds,
        });
      }
    : undefined;

  return {
    kind: args.kind,
    id: task.id,
    identifier: task.identifier,
    title: task.title,
    description: task.description,
    rowState: task.taskState,
    multiple,
    targetTaskIds: ids,
    fields: {
      status: { value: multiple ? null : task.workflowStatusId, set: statusSet },
      assignee: {
        value: multiple ? null : (task.assignedUserId ?? null),
        set: applyMany(args.onAssignTask, (taskId: string, next: string | null) => ({
          taskId,
          assignedUserId: next,
        })),
      },
      estimate: {
        value: multiple ? "no_estimate" : ((task.estimate ?? "no_estimate") as TaskEstimate),
        set: applyMany(args.onChangeTaskEstimate, (taskId: string, next: TaskEstimate) => ({
          taskId,
          estimate: next === "no_estimate" ? null : (next as TaskBoardEstimate),
        })),
      },
      labels: {
        value: task.labelIds ?? [],
        set:
          multiple || !args.onChangeTaskLabels
            ? undefined
            : (next) => void args.onChangeTaskLabels?.({ taskId: task.id, labelIds: next }),
      },
      dueDate: {
        value: multiple ? null : (task.dueDate ?? null),
        set: applyMany(args.onChangeTaskDueDate, (taskId: string, next: string | null) => ({
          taskId,
          dueDate: next,
        })),
      },
      team: { value: task.teamId, set: teamSet },
    },
    actions: {
      transition:
        args.kind === "persisted" && args.onTransitionTask
          ? (transition) => {
              for (const taskId of ids) void args.onTransitionTask?.({ taskId, transition });
            }
          : undefined,
      open:
        args.kind === "persisted" && args.onOpenTask
          ? () => args.onOpenTask?.(task.identifier)
          : undefined,
      copyId: args.kind === "persisted" ? () => task.identifier : undefined,
      copyLink:
        args.kind === "persisted" && args.buildTaskUrl
          ? () => args.buildTaskUrl?.(task.identifier) ?? ""
          : undefined,
      copyTitle: () => task.title,
      copyMarkdown: () => taskToMarkdown(task),
    },
  };
}
