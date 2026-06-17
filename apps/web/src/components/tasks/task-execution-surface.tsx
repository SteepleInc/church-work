import { useOpenTaskDetailsPaneUrl } from "@/components/details-pane/details-pane-helpers";
import { useCyclesCollection } from "@/data/cycles/cyclesData.app";
import { useLabelsCollection } from "@/data/labels/labelsData.app";
import { useTeamMembershipsCollection } from "@/data/teams/teamsData.app";
import {
  useCancelTaskMutation,
  useCompleteTaskMutation,
  useReopenTaskMutation,
  useTasksCollection,
  useUpdateTaskMutation,
  useUpdateTasksBatchMutation,
  type TaskCollectionFilters,
} from "@/data/tasks/tasksData.app";
import { getUserDisplayName, useChurchUsersCollection } from "@/data/users/usersData.app";
import {
  useWorkflowStatusesCollection,
  useWorkflowsCollection,
} from "@/data/workflows/workflowsData.app";
import { useQuickActionOpeners } from "@/features/quick-actions/quick-actions-state";
import {
  getHiddenBoardColumns,
  hiddenBoardColumnsAtom,
  toggleHiddenBoardColumn,
} from "@/shared/global-state";
import { useNavigate } from "@tanstack/react-router";
import { useAtom } from "jotai";
import type { ReactNode } from "react";

import { taskFiltersToCollectionFilters } from "@/components/tasks/task-filters";
import { FilterKeys } from "@/shared/global-state";
import { useFiltersValue } from "@/shared/hooks/useFilters";

import { Skeleton } from "@/components/ui/skeleton";
import { TaskInsightsPanel } from "@/components/tasks/task-insights-panel";
import {
  buildInsightsData,
  insightsToCsv,
  type InsightsBucketMeta,
} from "@/components/tasks/task-insights-data";
import {
  INSIGHTS_DIMENSION_OPTIONS,
  type ResolvedInsightsState,
} from "@/components/tasks/task-insights-options";
import {
  TaskContextMenuProvider,
  type TaskContextMenuConfig,
  type TaskStateTransition,
} from "./task-context-menu";
import { TaskKanbanBoard } from "./task-kanban-board";
import { TaskListSurface } from "./task-list-surface";
import {
  TaskSurfaceKeyboardProvider,
  useTaskSurfaceKeyboard,
  type TaskSurfaceKeyboardActions,
} from "./task-surface-keyboard";
import {
  NO_ESTIMATE_COLUMN_ID,
  UNASSIGNED_COLUMN_ID,
  type TaskBoardEstimate,
} from "./task-kanban-adapter";
import {
  buildTeamMemberIndex,
  getExecutionBoardGrouping,
  getTaskCreationDefaults,
  getTaskExecutionFilters,
  getTaskExecutionReadArgs,
  getTaskGroupAddPreset,
  getTaskParentContext,
  selectCurrentExecutionCycle,
  type ExecutionSurface,
  type TaskSummary,
  type TaskState,
} from "@/components/tasks/task-execution-surface-utils";
import {
  resolveTaskViewOptions,
  type TaskViewOptions,
  type TaskViewTab,
} from "@/components/tasks/task-view-options";

type WorkflowStatus = {
  readonly id: string;
  readonly workflowId: string;
  readonly name: string;
  readonly taskState: TaskState;
  readonly sortOrder: number;
};

export function TaskExecutionSurface({
  churchId,
  currentUserId,
  surface,
  team,
  teams = [],
  tab,
  view,
  insights,
  onInsightsChange,
  onToggleLayout,
  onOpenDisplayOptions,
  onOpenShortcutsHelp,
}: {
  readonly churchId: string;
  readonly currentUserId: string;
  readonly surface: ExecutionSurface;
  readonly team?: {
    readonly id: string;
    readonly name: string;
  } | null;
  readonly teams?: readonly { readonly id: string; readonly name: string }[];
  readonly tab?: TaskViewTab;
  readonly view?: TaskViewOptions;
  readonly insights?: ResolvedInsightsState;
  readonly onInsightsChange?: (next: ResolvedInsightsState) => void;
  // Surface-level keyboard shortcut targets, owned by the route.
  readonly onToggleLayout?: () => void;
  readonly onOpenDisplayOptions?: () => void;
  readonly onOpenShortcutsHelp?: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const navigate = useNavigate();
  const openTaskDetailsPaneUrl = useOpenTaskDetailsPaneUrl();
  const { openCreateTask } = useQuickActionOpeners();

  // Hidden Board Columns are local-device presentation state, keyed per Board.
  const boardKey = surface === "team_board" && team ? `team_board:${team.id}` : surface;
  const [hiddenBoardColumns, setHiddenBoardColumns] = useAtom(hiddenBoardColumnsAtom);
  const hiddenColumnIds = getHiddenBoardColumns(hiddenBoardColumns, boardKey);

  const cyclesCollection = useCyclesCollection({ churchId, currentUserId });
  const workflows = useWorkflowsCollection({ churchId });
  const workflowStatusesCollection = useWorkflowStatusesCollection({ churchId });
  const usersCollection = useChurchUsersCollection({ churchId });
  const teamMembershipsCollection = useTeamMembershipsCollection({ churchId });
  const labelsCollection = useLabelsCollection({ churchId });
  const teamMemberIdsByTeamId = buildTeamMemberIndex(
    teamMembershipsCollection.teamMembershipsCollection,
  );

  const cycles = cyclesCollection.cyclesCollection;
  const currentCycle = selectCurrentExecutionCycle(cycles, today);
  // Every Team owns its Workflow (ADR 0013): a Team Board shows that
  // Workflow's statuses. Cross-team surfaces carry every active status so
  // per-card status pickers stay scoped to each Task's Team Workflow.
  const teamWorkflow =
    surface === "team_board" && team
      ? workflows.workflowsCollection.find(
          (workflow) => workflow.teamId === team.id && workflow.archivedAt === null,
        )
      : undefined;
  const activeWorkflowStatuses = workflowStatusesCollection.workflowStatusesCollection.filter(
    (status) => status.archivedAt === null,
  );
  const workflowStatuses =
    surface === "team_board"
      ? teamWorkflow
        ? activeWorkflowStatuses.filter((status) => status.workflowId === teamWorkflow.id)
        : []
      : activeWorkflowStatuses;
  const resolvedView = resolveTaskViewOptions(view);
  // Ad-hoc Board filters (FilterKeys.Tasks) combine with the surface/tab scope
  // as additional ANDed constraints (see task-filters.tsx).
  const adHocFilters = useFiltersValue(FilterKeys.Tasks);
  const taskReadArgs = getTaskExecutionReadArgs({
    churchId,
    currentUserId,
    surface,
    teamId: team?.id ?? null,
    cycleId: currentCycle?.id ?? null,
  });
  const taskFilters: TaskCollectionFilters | undefined = taskReadArgs
    ? {
        ...getTaskExecutionFilters({
          surface,
          teamId: team?.id ?? null,
          cycleId: taskReadArgs.cycleId,
          currentUserId,
          tab,
          showSubtasks: resolvedView.showSubtasks,
          ordering: resolvedView.ordering,
        }),
        ...taskFiltersToCollectionFilters(adHocFilters),
      }
    : undefined;
  const tasksCollection = useTasksCollection({
    churchId: taskReadArgs !== null ? churchId : null,
    currentUserId,
    filters: taskFilters,
  });

  const updateTask = useUpdateTaskMutation();
  const updateTasksBatch = useUpdateTasksBatchMutation();
  const completeTask = useCompleteTaskMutation();
  const cancelTask = useCancelTaskMutation();
  const reopenTask = useReopenTaskMutation();

  const transitionTask = (taskId: string, transition: TaskStateTransition) => {
    const mutate =
      transition === "complete" ? completeTask : transition === "cancel" ? cancelTask : reopenTask;
    void mutate({ churchId, actorUserId: currentUserId, taskId });
  };

  const tasks = tasksCollection.tasksCollection;
  const isLoading =
    workflows.loading ||
    workflowStatusesCollection.loading ||
    (taskReadArgs !== null && tasksCollection.loading);
  // Cross-team surfaces group by Task State (ADR 0013: there is no single
  // Workflow across Teams), so the board renders without a surface Workflow.
  const boardGrouping = getExecutionBoardGrouping(surface, resolvedView.grouping);
  const showBoard = surface === "team_board" ? workflowStatuses.length > 0 : !isLoading;

  // Dropping a card on a Task State lane resolves to the matching status in
  // that Task's own Team Workflow.
  const findTaskStateStatusId = (taskId: string, taskState: string) => {
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) return null;
    return (
      [...activeWorkflowStatuses]
        .filter((status) => status.workflowId === task.workflowId && status.taskState === taskState)
        .sort((left, right) => left.sortOrder - right.sortOrder)[0]?.id ?? null
    );
  };

  // View mode (list or board) is just one View Option; both presentations are
  // fed the same grouped Tasks and share these inline-edit handlers. Only the
  // Board drags (reorder / cross-column moves), so those handlers stay inline
  // on the Board element below.
  const boardTasks = tasks.map((task) => toBoardTask(task, tasks));
  const assigneeOptions = usersCollection.usersCollection.map((user) => ({
    id: user.id,
    label: getUserDisplayName(user),
  }));
  const sharedSurfaceProps = {
    workflowStatuses: workflowStatuses.map(toBoardWorkflowStatus),
    tasks: boardTasks,
    assigneeOptions,
    teamOptions: teams,
    labelOptions: labelsCollection.labelsCollection,
    currentUserId,
    teamMemberIdsByTeamId,
    grouping: boardGrouping,
    showEmptyColumns: resolvedView.showEmptyColumns,
    displayProperties: resolvedView.displayProperties,
    onAssignTask: (change: { taskId: string; assignedUserId: string | null }) => {
      void updateTask({
        churchId,
        actorUserId: currentUserId,
        taskId: change.taskId,
        fields: { assignedUserId: change.assignedUserId },
      });
    },
    onChangeTaskStatus: (change: { taskId: string; workflowStatusId: string }) => {
      void updateTask({
        churchId,
        actorUserId: currentUserId,
        taskId: change.taskId,
        fields: { workflowStatusId: change.workflowStatusId },
      });
    },
    onChangeTaskLabels: (change: { taskId: string; labelIds: readonly string[] }) => {
      void updateTask({
        churchId,
        actorUserId: currentUserId,
        taskId: change.taskId,
        fields: { labelIds: [...change.labelIds] },
      });
    },
    onChangeTaskEstimate: (change: { taskId: string; estimate: TaskBoardEstimate | null }) => {
      void updateTask({
        churchId,
        actorUserId: currentUserId,
        taskId: change.taskId,
        fields: { estimate: change.estimate },
      });
    },
    onOpenTask: (taskIdentifier: string) => {
      const url = openTaskDetailsPaneUrl({ id: taskIdentifier });
      void navigate({ to: url.to, search: url.search });
    },
  } as const;

  // The per-group "+" pre-fills the create dialog with the grouped field for
  // that group, interpreted the same way the Board column "+" is.
  const onAddTaskForColumn = (columnId: string) => {
    openCreateTask(
      getTaskGroupAddPreset({
        grouping: boardGrouping,
        columnId,
        defaults: getTaskCreationDefaults({ surface, currentUserId, teamId: team?.id ?? null }),
        unassignedColumnId: UNASSIGNED_COLUMN_ID,
      }),
    );
  };

  const insightsState = insights ?? null;
  const insightsMeta: InsightsBucketMeta = {
    workflowStatuses: activeWorkflowStatuses.map(toBoardWorkflowStatus),
    assignees: assigneeOptions,
    teams,
  };

  const keyboardActions: TaskSurfaceKeyboardActions = {
    onToggleLayout,
    onOpenDisplayOptions,
    onOpenShortcutsHelp,
    // Cmd/Ctrl+A selects every non-canceled Task currently shown.
    getSelectAllIds: () =>
      boardTasks.filter((task) => task.taskState !== "canceled").map((task) => task.id),
  };

  const insightsOpen = Boolean(insightsState?.open && onInsightsChange);

  // Shared right-click menu data + callbacks, published once around both
  // surfaces. Field/state changes apply to the right-clicked Task (or the whole
  // selection when it is part of one); see TaskContextMenu. `selectedTaskIds`
  // is layered in by TaskContextMenuBridge, which reads the keyboard layer.
  const contextMenuConfig: Omit<TaskContextMenuConfig, "selectedTaskIds"> = {
    workflowStatuses: workflowStatuses.map(toBoardWorkflowStatus),
    assigneeOptions,
    labelOptions: labelsCollection.labelsCollection,
    currentUserId,
    teamMemberIdsByTeamId,
    onAssignTask: sharedSurfaceProps.onAssignTask,
    onChangeTaskStatus: sharedSurfaceProps.onChangeTaskStatus,
    onChangeTaskLabels: sharedSurfaceProps.onChangeTaskLabels,
    onChangeTaskEstimate: sharedSurfaceProps.onChangeTaskEstimate,
    onChangeTaskDueDate: (change) => {
      void updateTask({
        churchId,
        actorUserId: currentUserId,
        taskId: change.taskId,
        fields: { dueDate: change.dueDate },
      });
    },
    onTransitionTask: (change) => transitionTask(change.taskId, change.transition),
    onOpenTask: sharedSurfaceProps.onOpenTask,
    buildTaskUrl: (taskIdentifier) => {
      const url = openTaskDetailsPaneUrl({ id: taskIdentifier });
      const search = url.search(
        Object.fromEntries(new URLSearchParams(window.location.search)),
      ) as Record<string, unknown>;
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(search)) {
        if (value === undefined || value === null) continue;
        params.set(key, typeof value === "string" ? value : JSON.stringify(value));
      }
      const query = params.toString();
      return `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ""}`;
    },
  };

  return (
    <TaskSurfaceKeyboardProvider actions={keyboardActions}>
      <TaskContextMenuBridge config={contextMenuConfig}>
        {/* Insights is a right-hand side pane (Linear): the Board/List keeps the
            remaining width, the pane scrolls independently. */}
        <section className="flex min-h-0 min-w-0 flex-1 gap-4">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
            {isLoading && !showBoard ? <TaskBoardSkeleton /> : null}

            {showBoard && resolvedView.mode === "list" ? (
              <TaskListSurface
                className="min-h-0 flex-1"
                {...sharedSurfaceProps}
                onAddTask={onAddTaskForColumn}
              />
            ) : showBoard ? (
              <TaskKanbanBoard
                className="min-h-0 flex-1"
                workflowStatuses={workflowStatuses.map(toBoardWorkflowStatus)}
                tasks={boardTasks}
                assigneeOptions={assigneeOptions}
                teamOptions={teams}
                labelOptions={labelsCollection.labelsCollection}
                currentUserId={currentUserId}
                teamMemberIdsByTeamId={teamMemberIdsByTeamId}
                grouping={boardGrouping}
                showEmptyColumns={resolvedView.showEmptyColumns}
                displayProperties={resolvedView.displayProperties}
                onMoveTask={(move) => {
                  // The drag's destination column id means a different field per
                  // grouping; team lanes are not draggable.
                  const fields =
                    boardGrouping === "workflow_status"
                      ? { workflowStatusId: move.columnId }
                      : boardGrouping === "assignee"
                        ? {
                            assignedUserId:
                              move.columnId === UNASSIGNED_COLUMN_ID ? null : move.columnId,
                          }
                        : boardGrouping === "task_state"
                          ? (() => {
                              const workflowStatusId = findTaskStateStatusId(
                                move.taskId,
                                move.columnId,
                              );
                              return workflowStatusId ? { workflowStatusId } : null;
                            })()
                          : resolvedView.grouping === "estimate"
                            ? {
                                estimate:
                                  move.columnId === NO_ESTIMATE_COLUMN_ID
                                    ? null
                                    : (move.columnId as TaskBoardEstimate),
                              }
                            : null;
                  if (!fields) return;
                  void updateTask({
                    churchId,
                    actorUserId: currentUserId,
                    taskId: move.taskId,
                    fields,
                  });
                }}
                hiddenColumnIds={hiddenColumnIds}
                onMoveTasks={(moves) => {
                  if (moves.length === 1) {
                    const move = moves[0];
                    void updateTask({
                      churchId,
                      actorUserId: currentUserId,
                      taskId: move.taskId,
                      fields: {
                        workflowStatusId: move.workflowStatusId,
                        boardOrder: move.boardOrder,
                      },
                    });
                    return;
                  }
                  void updateTasksBatch({
                    churchId,
                    actorUserId: currentUserId,
                    updates: moves.map((move) => ({
                      taskId: move.taskId,
                      fields: {
                        workflowStatusId: move.workflowStatusId,
                        boardOrder: move.boardOrder,
                      },
                    })),
                  });
                }}
                onAddTask={(workflowStatusId) => {
                  const defaults = getTaskCreationDefaults({
                    surface,
                    currentUserId,
                    teamId: team?.id ?? null,
                  });
                  openCreateTask({
                    assignTo: defaults.assignedUserId,
                    teamId: defaults.teamId,
                    workflowStatusId,
                  });
                }}
                onToggleColumnHidden={(workflowStatusId) => {
                  setHiddenBoardColumns((current) =>
                    toggleHiddenBoardColumn(current, boardKey, workflowStatusId),
                  );
                }}
                onAssignTask={(change) => {
                  void updateTask({
                    churchId,
                    actorUserId: currentUserId,
                    taskId: change.taskId,
                    fields: { assignedUserId: change.assignedUserId },
                  });
                }}
                onChangeTaskStatus={(change) => {
                  void updateTask({
                    churchId,
                    actorUserId: currentUserId,
                    taskId: change.taskId,
                    fields: { workflowStatusId: change.workflowStatusId },
                  });
                }}
                onChangeTaskLabels={(change) => {
                  void updateTask({
                    churchId,
                    actorUserId: currentUserId,
                    taskId: change.taskId,
                    fields: { labelIds: [...change.labelIds] },
                  });
                }}
                onChangeTaskEstimate={(change) => {
                  void updateTask({
                    churchId,
                    actorUserId: currentUserId,
                    taskId: change.taskId,
                    fields: { estimate: change.estimate },
                  });
                }}
                onOpenTask={(taskIdentifier) => {
                  const url = openTaskDetailsPaneUrl({ id: taskIdentifier });
                  void navigate({ to: url.to, search: url.search });
                }}
              />
            ) : !isLoading ? (
              <p className="text-sm text-muted-foreground">
                Configure this Team's Workflow before using the Task board.
              </p>
            ) : null}
          </div>

          {insightsOpen && insightsState && onInsightsChange ? (
            <TaskInsightsPanel
              className="min-h-0 w-full max-w-md shrink-0 self-stretch overflow-y-auto md:w-96 lg:w-[28rem]"
              meta={insightsMeta}
              onClose={() => onInsightsChange({ ...insightsState, open: false })}
              onCopyLink={() => {
                void navigator.clipboard?.writeText(window.location.href);
              }}
              onExportCsv={() => {
                const sliceLabel =
                  INSIGHTS_DIMENSION_OPTIONS.find((option) => option.value === insightsState.slice)
                    ?.label ?? "Slice";
                const scoped = insightsState.showCanceled
                  ? boardTasks
                  : boardTasks.filter((task) => task.taskState !== "canceled");
                const csv = insightsToCsv(
                  buildInsightsData({
                    slice: insightsState.slice,
                    segment: insightsState.segment,
                    tasks: scoped,
                    meta: insightsMeta,
                  }),
                  sliceLabel,
                );
                downloadCsv(csv, "insights.csv");
              }}
              onRefresh={() => {
                // Data is live through synced collections; Refresh is a no-op re-render.
                // hook kept for parity with Linear's menu.
                onInsightsChange({ ...insightsState });
              }}
              onStateChange={onInsightsChange}
              state={insightsState}
              tasks={boardTasks}
            />
          ) : null}
        </section>
      </TaskContextMenuBridge>
    </TaskSurfaceKeyboardProvider>
  );
}

/**
 * Reads the shared keyboard selection and publishes it with the rest of the
 * context-menu config, so a right-click action can fan out to the whole
 * selection. Kept separate from the orchestrator because the selection lives in
 * the keyboard context, which the orchestrator mounts but is not itself inside.
 */
function TaskContextMenuBridge({
  config,
  children,
}: {
  readonly config: Omit<TaskContextMenuConfig, "selectedTaskIds">;
  readonly children: ReactNode;
}) {
  const keyboard = useTaskSurfaceKeyboard();
  const selectedTaskIds = keyboard?.selectedTaskIds ?? EMPTY_CONTEXT_MENU_SELECTION;
  return (
    <TaskContextMenuProvider config={{ ...config, selectedTaskIds }}>
      {children}
    </TaskContextMenuProvider>
  );
}

const EMPTY_CONTEXT_MENU_SELECTION: ReadonlySet<string> = new Set();

/**
 * Board-shaped Skeleton shown while Workflow Statuses and Tasks have not yet
 * arrived (ADR 0010 — no "Loading Tasks..." text, no spinners).
 */
function TaskBoardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }, (_, columnIndex) => (
        <div className="flex flex-col gap-2" key={columnIndex}>
          <Skeleton className="h-5 w-28" />
          {Array.from({ length: 3 - columnIndex }, (_, cardIndex) => (
            <Skeleton className="h-20 w-full rounded-lg" key={cardIndex} />
          ))}
        </div>
      ))}
    </div>
  );
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toBoardWorkflowStatus(status: WorkflowStatus) {
  return {
    id: status.id,
    workflowId: status.workflowId,
    name: status.name,
    sortOrder: status.sortOrder,
    taskState: status.taskState,
  };
}

function toBoardTask(task: TaskSummary, tasks: readonly TaskSummary[]) {
  return {
    id: task.id,
    identifier: task.identifier,
    title: task.title,
    description: task.description ?? null,
    teamId: task.teamId,
    workflowId: task.workflowId,
    cycleId: task.cycleId,
    dueDate: task.dueDate,
    createdAt: task.createdAt,
    assignedUserId: task.assignedUserId,
    parentTask: getTaskParentContext(task, tasks),
    workflowStatusId: task.workflowStatusId,
    taskState: task.taskState,
    estimate: task.estimate ?? null,
    boardOrder: task.boardOrder,
    labelIds: task.labelIds ?? [],
  };
}
