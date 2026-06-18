import { useOpenTaskDetailsPaneUrl } from "@/components/details-pane/details-pane-helpers";
import { WeekHeader } from "@/components/weeks/week-header";
import { TeamWeekSelector } from "@/components/weeks/team-week-selector";
import type { WeekCsvTask } from "@/components/weeks/week-actions-data";
import { buildProjectedWeekCycles } from "@/components/weeks/team-weeks-index-data";
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
import { Link, useNavigate } from "@tanstack/react-router";
import { useAtom } from "jotai";
import { ChevronRight } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { mapTaskFilterValuesForZero } from "@/components/tasks/task-filters";
import { FilterKeys } from "@/shared/global-state";
import { useZeroListArgs } from "@/shared/hooks/useZeroListArgs";
import type { ListArgs } from "@church-task/zero";

import { Skeleton } from "@/components/ui/skeleton";
import { TaskInsightsPanel } from "@/components/tasks/task-insights-panel";
import { WeekProgressPanel } from "@/components/tasks/week-progress-panel";
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
  getTaskExecutionCycleId,
  getTaskExecutionReadArgs,
  getTaskGroupAddPreset,
  getTaskParentContext,
  resolveExecutionCycleScope,
  selectCurrentExecutionCycle,
  type ExecutionSurface,
  type TaskSummary,
  type TaskState,
  type WeekShortcut,
} from "@/components/tasks/task-execution-surface-utils";
import {
  resolveTaskViewOptions,
  type TaskViewOptions,
  type TaskViewTab,
  type TaskWeekScope,
} from "@/components/tasks/task-view-options";

type WorkflowStatus = {
  readonly id: string;
  readonly workflowId: string;
  readonly name: string;
  readonly taskState: TaskState;
  readonly sortOrder: number;
};

const taskColumnMap = {
  assignee: "assigned_user_id",
  createdAt: "created_at",
  creator: "created_by_user_id",
  cycle: "cycle_id",
  dueDate: "due_date",
  parentTask: "parent_task_id",
  taskState: "task_state",
  team: "team_id",
  workflowStatus: "workflow_status_id",
} as const;

type TaskExecutionQueryFilters = ReturnType<typeof getTaskExecutionFilters> | undefined;

function optionFilter(params: {
  readonly columnId: string;
  readonly operator: "is" | "is any of";
  readonly values: readonly (string | null)[];
}): NonNullable<ListArgs["filters"]>[number] {
  return {
    column_id: params.columnId,
    operator: params.operator,
    type: "option",
    values: params.values,
  };
}

function getTaskScopeListFilters(
  filters: TaskExecutionQueryFilters,
): NonNullable<ListArgs["filters"]> {
  const listFilters: Array<NonNullable<ListArgs["filters"]>[number]> = [];

  if (!filters) return listFilters;
  if (filters.createdByUserId) {
    listFilters.push(
      optionFilter({
        columnId: "created_by_user_id",
        operator: "is",
        values: [filters.createdByUserId],
      }),
    );
  }
  if (filters.cycleId) {
    listFilters.push(
      optionFilter({ columnId: "cycle_id", operator: "is", values: [filters.cycleId] }),
    );
  }
  if (filters.excludeSubtasks) {
    listFilters.push(optionFilter({ columnId: "parent_task_id", operator: "is", values: [null] }));
  }
  if (filters.taskStates?.length) {
    listFilters.push(
      optionFilter({ columnId: "task_state", operator: "is any of", values: filters.taskStates }),
    );
  }

  return listFilters;
}

function mergeTaskListArgs(base: ListArgs, filters: TaskExecutionQueryFilters): ListArgs {
  const mergedFilters = [...getTaskScopeListFilters(filters), ...(base.filters ?? [])];

  return {
    ...base,
    ...(mergedFilters.length ? { filters: mergedFilters } : {}),
    ...(filters?.orderBy === "due_date"
      ? { order_by: "due_date", order_direction: "asc" as const }
      : {}),
  };
}

export function TaskExecutionSurface({
  churchId,
  currentUserId,
  surface,
  team,
  teams = [],
  tab,
  view,
  scope,
  week,
  weekNumber,
  churchTimeZone = "UTC",
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
    readonly identifier?: string | null;
  } | null;
  readonly teams?: readonly { readonly id: string; readonly name: string }[];
  readonly tab?: TaskViewTab;
  readonly view?: TaskViewOptions;
  readonly scope?: TaskWeekScope;
  readonly week?: WeekShortcut;
  readonly weekNumber?: number | null;
  readonly churchTimeZone?: string;
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

  const cycles = buildProjectedWeekCycles({
    churchTimeZone,
    cycles: cyclesCollection.cyclesCollection,
    today,
  });
  const currentCycle = selectCurrentExecutionCycle(cycles, today);
  const scopedCycle = resolveExecutionCycleScope({ surface, week, weekNumber, cycles, today });
  const executionCycleId =
    surface === "team_board"
      ? (scopedCycle?.id ?? null)
      : getTaskExecutionCycleId({
          surface,
          scope,
          currentCycleId: currentCycle?.id ?? null,
        });
  // The selector returns only the date fields it needs; pull the full Week row
  // back out so the header can show its Church-wide name/description.
  const currentWeek = executionCycleId
    ? (() => {
        const cycle = cycles.find((cycle) => cycle.id === executionCycleId);
        return cycle ? { ...cycle, description: cycle.description ?? null } : null;
      })()
    : null;
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
  const { listArgs: adHocTaskListArgs } = useZeroListArgs({
    columnMap: taskColumnMap,
    filterKey: FilterKeys.Tasks,
    getAll: true,
    mapFilterValues: mapTaskFilterValuesForZero,
  });
  const taskReadArgs = getTaskExecutionReadArgs({
    churchId,
    currentUserId,
    surface,
    teamId: team?.id ?? null,
    cycleId: executionCycleId,
  });
  const taskFilters = taskReadArgs
    ? getTaskExecutionFilters({
        surface,
        teamId: team?.id ?? null,
        cycleId: taskReadArgs.cycleId,
        currentUserId,
        tab,
        showSubtasks: resolvedView.showSubtasks,
        ordering: resolvedView.ordering,
      })
    : undefined;
  const taskListArgs = useMemo(
    () => mergeTaskListArgs(adHocTaskListArgs, taskFilters),
    [adHocTaskListArgs, taskFilters],
  );
  const tasksCollection = useTasksCollection({
    churchId: taskReadArgs !== null ? churchId : null,
    currentUserId,
    filters: taskFilters,
    listArgs: taskListArgs,
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
  const showProjectedWeekEmptyState =
    surface === "team_board" && week === "upcoming" && !isLoading && tasks.length === 0;

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
  const workflowStatusNamesById = new Map(
    activeWorkflowStatuses.map((status) => [status.id, status.name] as const),
  );
  const assigneeNamesById = new Map(
    assigneeOptions.map((assignee) => [assignee.id, assignee.label]),
  );
  const teamNamesById = new Map(teams.map((teamOption) => [teamOption.id, teamOption.name]));
  const weekCsvTasks: readonly WeekCsvTask[] = boardTasks.map((task) => ({
    identifier: task.identifier,
    title: task.title,
    taskState: task.taskState,
    workflowStatusName: workflowStatusNamesById.get(task.workflowStatusId) ?? null,
    assignedUserName: task.assignedUserId
      ? (assigneeNamesById.get(task.assignedUserId) ?? null)
      : null,
    teamName: teamNamesById.get(task.teamId) ?? null,
    dueDate: task.dueDate,
    cycleId: task.cycleId,
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
        ...(scopedCycle ? { targetCycle: scopedCycle.targetCycle } : {}),
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
  const weekProgressMeta = {
    assignees: assigneeOptions,
    labels: labelsCollection.labelsCollection,
    teams,
  };

  const keyboardActions: TaskSurfaceKeyboardActions = {
    onToggleLayout,
    // Cmd/Ctrl+I toggles the right-hand panel, mirroring the top-bar button.
    onTogglePanel:
      insightsState && onInsightsChange
        ? () => onInsightsChange({ ...insightsState, open: !insightsState.open })
        : undefined,
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
            {currentWeek ? (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex min-w-0 flex-col gap-1">
                  {surface === "team_board" && team ? (
                    <WeekBreadcrumb teamIdentifier={team.identifier} teamName={team.name} />
                  ) : null}
                  <WeekHeader churchId={churchId} cycle={currentWeek} tasks={weekCsvTasks} />
                </div>
                {surface === "team_board" && team?.identifier ? (
                  <TeamWeekSelector
                    cycles={cycles}
                    currentCycleId={currentCycle?.id ?? null}
                    selectedCycleId={currentWeek.id}
                    teamIdentifier={team.identifier}
                    today={today}
                  />
                ) : null}
              </div>
            ) : null}

            {isLoading && !showBoard ? <TaskBoardSkeleton /> : null}

            {showProjectedWeekEmptyState ? (
              <div className="grid place-items-center gap-1 rounded-lg border border-dashed bg-muted/10 px-4 py-8 text-center">
                <p className="text-sm font-medium">Nothing planned yet</p>
                <p className="text-xs text-muted-foreground">
                  Add Tasks to this Week and it starts tracking progress automatically.
                </p>
              </div>
            ) : null}

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
                    ...(scopedCycle ? { targetCycle: scopedCycle.targetCycle } : {}),
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
            surface === "team_board" ? (
              <WeekProgressPanel
                className="min-h-0 w-full max-w-md shrink-0 self-stretch overflow-y-auto md:w-96 lg:w-[28rem]"
                meta={weekProgressMeta}
                onClose={() => onInsightsChange({ ...insightsState, open: false })}
                tasks={boardTasks}
              />
            ) : (
              <TaskInsightsPanel
                className="min-h-0 w-full max-w-md shrink-0 self-stretch overflow-y-auto md:w-96 lg:w-[28rem]"
                meta={insightsMeta}
                onClose={() => onInsightsChange({ ...insightsState, open: false })}
                onCopyLink={() => {
                  void navigator.clipboard?.writeText(window.location.href);
                }}
                onExportCsv={() => {
                  const sliceLabel =
                    INSIGHTS_DIMENSION_OPTIONS.find(
                      (option) => option.value === insightsState.slice,
                    )?.label ?? "Slice";
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
            )
          ) : null}
        </section>
      </TaskContextMenuBridge>
    </TaskSurfaceKeyboardProvider>
  );
}

/**
 * The Team / Weeks breadcrumb above a Team Week board. The Team segment links
 * back to that Team's Default Team View ("Tasks"), and the current "Weeks"
 * segment anchors the User in the Team Week surface. Keeping it a real trail —
 * not static text — matches the rest of the app's navigation affordances.
 */
function WeekBreadcrumb({
  teamIdentifier,
  teamName,
}: {
  readonly teamIdentifier?: string | null;
  readonly teamName: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
      {teamIdentifier ? (
        <Link
          to="/team/$teamIdentifier"
          params={{ teamIdentifier }}
          search={true}
          className="truncate rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {teamName}
        </Link>
      ) : (
        <span className="truncate">{teamName}</span>
      )}
      <ChevronRight aria-hidden className="size-3 shrink-0 opacity-60" />
      {teamIdentifier ? (
        <Link
          to="/team/$teamIdentifier/weeks"
          params={{ teamIdentifier }}
          search={true}
          className="rounded font-medium text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Weeks
        </Link>
      ) : (
        <span className="font-medium text-foreground/80">Weeks</span>
      )}
    </nav>
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
