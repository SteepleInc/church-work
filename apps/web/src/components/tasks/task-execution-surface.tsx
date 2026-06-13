import { useOpenTaskDetailsPaneUrl } from "@/components/details-pane/details-pane-helpers";
import { useCyclesCollection } from "@/data/cycles/cyclesData.app";
import { useLabelsCollection } from "@/data/labels/labelsData.app";
import { useTeamMembershipsCollection } from "@/data/teams/teamsData.app";
import {
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

import { Skeleton } from "@/components/ui/skeleton";
import { TaskKanbanBoard } from "./task-kanban-board";
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
  const taskReadArgs = getTaskExecutionReadArgs({
    churchId,
    currentUserId,
    surface,
    teamId: team?.id ?? null,
    cycleId: currentCycle?.id ?? null,
  });
  const taskFilters: TaskCollectionFilters | undefined = taskReadArgs
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
  const tasksCollection = useTasksCollection({
    churchId: !cyclesCollection.loading && taskReadArgs !== null ? churchId : null,
    currentUserId,
    filters: taskFilters,
  });

  const updateTask = useUpdateTaskMutation();
  const updateTasksBatch = useUpdateTasksBatchMutation();

  const tasks = tasksCollection.tasksCollection;
  const isLoading =
    cyclesCollection.loading ||
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

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      {isLoading && !showBoard ? <TaskBoardSkeleton /> : null}

      {showBoard ? (
        <TaskKanbanBoard
          className="min-h-0 flex-1"
          workflowStatuses={workflowStatuses.map(toBoardWorkflowStatus)}
          tasks={tasks.map((task) => toBoardTask(task, tasks))}
          assigneeOptions={usersCollection.usersCollection.map((user) => ({
            id: user.id,
            label: getUserDisplayName(user),
          }))}
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
                      assignedUserId: move.columnId === UNASSIGNED_COLUMN_ID ? null : move.columnId,
                    }
                  : boardGrouping === "task_state"
                    ? (() => {
                        const workflowStatusId = findTaskStateStatusId(move.taskId, move.columnId);
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
                fields: { workflowStatusId: move.workflowStatusId, boardOrder: move.boardOrder },
              });
              return;
            }
            void updateTasksBatch({
              churchId,
              actorUserId: currentUserId,
              updates: moves.map((move) => ({
                taskId: move.taskId,
                fields: { workflowStatusId: move.workflowStatusId, boardOrder: move.boardOrder },
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
    </section>
  );
}

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
