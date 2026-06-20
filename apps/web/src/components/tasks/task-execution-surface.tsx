import { SparklesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { AppHeaderSlot } from "@/components/app-header-slot";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useOpenTaskDetailsPaneUrl } from "@/components/details-pane/details-pane-helpers";
import { TeamWeekSelector } from "@/components/weeks/team-week-selector";
import { WeekActionsMenu } from "@/components/weeks/week-actions-menu";
import type { WeekCsvTask } from "@/components/weeks/week-actions-data";
import { buildProjectedWeekCycles } from "@/components/weeks/team-weeks-index-data";
import { useCyclesCollection } from "@/data/cycles/cyclesData.app";
import { useLabelsCollection } from "@/data/labels/labelsData.app";
import { useTeamMembershipsCollection } from "@/data/teams/teamsData.app";
import {
  useAdjustProjectedTemplateTaskMutation,
  useMaterializeProjectedTemplateTaskMutation,
  useCancelTaskMutation,
  useCompleteTaskMutation,
  useReopenTaskMutation,
  useTasksCollection,
  useUpdateTaskMutation,
  useUpdateTasksBatchMutation,
  type TaskCollectionItem,
  type TaskUpdateFields,
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
import { useMemo, useState, type ReactNode } from "react";

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
  getTaskExecutionReadArgs,
  getTaskGroupAddPreset,
  getTaskParentContext,
  resolveExecutionCycleScope,
  type ExecutionSurface,
  type TaskSummary,
  type TaskState,
  type WeekShortcut,
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

  // `buildProjectedWeekCycles` projects the sparse Cycle calendar into the
  // contiguous Weeks the board reasons about (origin/main foundation).
  const cycles = buildProjectedWeekCycles({
    churchTimeZone,
    cycles: cyclesCollection.cyclesCollection,
    today,
  });
  // A Team Week board is scoped to its selected Week; cross-team surfaces
  // (My Work, Our Work) show every Task regardless of Week, like Linear's
  // issue views, so they never filter by Cycle.
  const scopedCycle = resolveExecutionCycleScope({ surface, week, weekNumber, cycles, today });
  const executionCycleId = surface === "team_board" ? (scopedCycle?.id ?? null) : null;
  // The Week shown in the header switcher tracks the actually-scoped Week, so
  // the switcher never implies a window the board is not honoring: a Week board
  // (`?week=…` / `/week/$n`) shows that Week, while the unscoped Default Team
  // View ("Tasks", all Cycles) shows no switcher.
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
    projectionCycle:
      surface === "team_board" && scopedCycle
        ? {
            endDate: scopedCycle.endDate,
            id: scopedCycle.id,
            startDate: scopedCycle.startDate,
          }
        : null,
  });

  const updateTask = useUpdateTaskMutation();
  const updateTasksBatch = useUpdateTasksBatchMutation();
  const adjustProjectedTask = useAdjustProjectedTemplateTaskMutation();
  const materializeProjectedTask = useMaterializeProjectedTemplateTaskMutation();
  const completeTask = useCompleteTaskMutation();
  const cancelTask = useCancelTaskMutation();
  const reopenTask = useReopenTaskMutation();

  const transitionTask = (taskId: string, transition: TaskStateTransition) => {
    const mutate =
      transition === "complete" ? completeTask : transition === "cancel" ? cancelTask : reopenTask;
    void mutate({ churchId, actorUserId: currentUserId, taskId });
  };

  const tasks = tasksCollection.tasksCollection;

  // Materializing a projected Template Task turns a planning ghost into a real,
  // numbered Task — an action that creates durable work and cannot be silently
  // undone. Route every materialization trigger (status menu, status-lane drag)
  // through a confirmation prompt so it reads as intentional, not accidental.
  const [pendingMaterialization, setPendingMaterialization] = useState<{
    readonly task: TaskCollectionItem;
    readonly workflowStatusId: string;
  } | null>(null);
  const [materializing, setMaterializing] = useState(false);

  const requestMaterialize = (params: {
    readonly task: TaskCollectionItem;
    readonly workflowStatusId: string;
  }) => {
    setPendingMaterialization(params);
  };

  const confirmMaterialize = () => {
    if (!pendingMaterialization) return;
    setMaterializing(true);
    void Promise.resolve(
      materializeProjectedTask({
        task: pendingMaterialization.task,
        workflowStatusId: pendingMaterialization.workflowStatusId,
      }),
    ).finally(() => {
      setMaterializing(false);
      setPendingMaterialization(null);
    });
  };

  // A single inline-edit seam shared by the Board, List, and right-click menu.
  // Materialized Tasks update their Task row; projected Template Tasks have no
  // row yet, so the same planning fields are written as an occurrence-scoped
  // Cycle Adjustment keyed by Template Schedule + Template Task + occurrence.
  const editTask = (taskId: string, fields: TaskUpdateFields) => {
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (
      task?.isProjected &&
      task.sourceTemplateScheduleId &&
      task.sourceTemplateOccurrenceKey &&
      task.sourceTemplateTaskId &&
      task.cycleId
    ) {
      void adjustProjectedTask({
        churchId,
        cycleId: task.cycleId,
        fields,
        sourceTemplateOccurrenceKey: task.sourceTemplateOccurrenceKey,
        sourceTemplateScheduleId: task.sourceTemplateScheduleId,
        sourceTemplateTaskId: task.sourceTemplateTaskId,
      });
      return;
    }
    void updateTask({ churchId, actorUserId: currentUserId, taskId, fields });
  };
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
      editTask(change.taskId, { assignedUserId: change.assignedUserId });
    },
    onChangeTaskStatus: (change: { taskId: string; workflowStatusId: string }) => {
      const task = tasks.find((candidate) => candidate.id === change.taskId);
      if (task?.isProjected) {
        requestMaterialize({ task, workflowStatusId: change.workflowStatusId });
        return;
      }
      void updateTask({
        churchId,
        actorUserId: currentUserId,
        taskId: change.taskId,
        fields: { workflowStatusId: change.workflowStatusId },
      });
    },
    onChangeTaskLabels: (change: { taskId: string; labelIds: readonly string[] }) => {
      editTask(change.taskId, { labelIds: [...change.labelIds] });
    },
    onChangeTaskEstimate: (change: { taskId: string; estimate: TaskBoardEstimate | null }) => {
      editTask(change.taskId, { estimate: change.estimate });
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
      editTask(change.taskId, { dueDate: change.dueDate });
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
            {currentWeek && surface === "team_board" && team?.identifier ? (
              <AppHeaderSlot>
                <div className="flex min-w-0 items-center gap-1">
                  <TeamWeekSelector
                    cycles={cycles}
                    selectedCycleId={currentWeek.id}
                    teamIdentifier={team.identifier}
                    teamName={team.name}
                  />
                  <WeekActionsMenu churchId={churchId} cycle={currentWeek} tasks={weekCsvTasks} />
                </div>
              </AppHeaderSlot>
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
                  const movedTask = tasks.find((candidate) => candidate.id === move.taskId);
                  if (movedTask?.isProjected) {
                    if ("workflowStatusId" in fields && fields.workflowStatusId) {
                      requestMaterialize({
                        task: movedTask,
                        workflowStatusId: fields.workflowStatusId,
                      });
                      return;
                    }
                    editTask(move.taskId, fields);
                    return;
                  }
                  void updateTask({
                    churchId,
                    actorUserId: currentUserId,
                    taskId: move.taskId,
                    fields,
                  });
                }}
                hiddenColumnIds={hiddenColumnIds}
                onMoveTasks={(moves) => {
                  // Projected Template Tasks cannot be reordered or moved
                  // between Workflow Status lanes — they have no Task row.
                  const persistable = moves.filter((move) => {
                    const task = tasks.find((candidate) => candidate.id === move.taskId);
                    return !task?.isProjected;
                  });
                  if (persistable.length === 0) return;
                  if (persistable.length === 1) {
                    const move = persistable[0];
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
                    updates: persistable.map((move) => ({
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
                onAssignTask={sharedSurfaceProps.onAssignTask}
                onChangeTaskStatus={sharedSurfaceProps.onChangeTaskStatus}
                onChangeTaskLabels={sharedSurfaceProps.onChangeTaskLabels}
                onChangeTaskEstimate={sharedSurfaceProps.onChangeTaskEstimate}
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
        <MaterializeProjectedTaskDialog
          loading={materializing}
          onConfirm={confirmMaterialize}
          onOpenChange={(open) => {
            if (!materializing && !open) setPendingMaterialization(null);
          }}
          pending={pendingMaterialization}
          statusName={
            pendingMaterialization
              ? (workflowStatusNamesById.get(pendingMaterialization.workflowStatusId) ?? null)
              : null
          }
        />
      </TaskContextMenuBridge>
    </TaskSurfaceKeyboardProvider>
  );
}

function MaterializeProjectedTaskDialog({
  pending,
  statusName,
  loading,
  onConfirm,
  onOpenChange,
}: {
  readonly pending: {
    readonly task: TaskCollectionItem;
    readonly workflowStatusId: string;
  } | null;
  readonly statusName: string | null;
  readonly loading: boolean;
  readonly onConfirm: () => void;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const scheduleName = pending?.task.sourceBadge?.scheduleName ?? null;
  const occurrenceLabel = pending?.task.sourceBadge?.occurrenceLabel ?? null;

  return (
    <AlertDialog onOpenChange={onOpenChange} open={pending !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} />
          </AlertDialogMedia>
          <AlertDialogTitle>Turn this planned work into a Task?</AlertDialogTitle>
          <AlertDialogDescription>
            {pending ? (
              <>
                “{pending.task.title}” is projected from{" "}
                {scheduleName ? <span className="font-medium">{scheduleName}</span> : "a Template"}
                {occurrenceLabel ? <> ({occurrenceLabel})</> : null}.{" "}
                {statusName ? (
                  <>
                    Moving it to <span className="font-medium">{statusName}</span> creates
                  </>
                ) : (
                  "This creates"
                )}{" "}
                a real, numbered Task in this Week. It becomes assignable, counts toward Week
                progress, and stays even if the projection later changes.
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Keep as planned</AlertDialogCancel>
          <AlertDialogAction disabled={loading} loading={loading} onClick={onConfirm}>
            {loading ? "Creating Task…" : "Create Task"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
    isProjected: task.isProjected ?? false,
    isAdjusted: task.isAdjusted ?? false,
    sourceBadge: task.sourceBadge ?? null,
  };
}
