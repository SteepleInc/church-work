import { useOpenTaskDetailsPaneUrl } from "@/components/details-pane/details-pane-helpers";
import { useCyclesCollection } from "@/data/cycles/cyclesData.app";
import { useTeamMembershipsCollection } from "@/data/teams/teamsData.app";
import {
  useTasksCollection,
  useUpdateTaskMutation,
  type TaskCollectionFilters,
} from "@/data/tasks/tasksData.app";
import { useChurchUsersCollection } from "@/data/users/usersData.app";
import {
  useWorkflowStatusesCollection,
  useWorkflowsCollection,
} from "@/data/workflows/workflowsData.app";
import { useNavigate } from "@tanstack/react-router";

import { TaskKanbanBoard } from "./task-kanban-board";
import {
  buildTeamMemberIndex,
  getExecutionWorkflowId,
  getTaskExecutionReadArgs,
  getTaskParentContext,
  selectCurrentExecutionCycle,
  type ExecutionSurface,
  type TaskSummary,
  type TaskState,
} from "@/components/tasks/task-execution-surface-utils";

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
}: {
  readonly churchId: string;
  readonly currentUserId: string;
  readonly surface: ExecutionSurface;
  readonly team?: {
    readonly id: string;
    readonly name: string;
    readonly defaultWorkflowId: string | null;
  } | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const navigate = useNavigate();
  const openTaskDetailsPaneUrl = useOpenTaskDetailsPaneUrl();

  const cyclesCollection = useCyclesCollection({ churchId, currentUserId });
  const workflows = useWorkflowsCollection({ churchId });
  const workflowStatusesCollection = useWorkflowStatusesCollection({ churchId });
  const usersCollection = useChurchUsersCollection({ churchId });
  const teamMembershipsCollection = useTeamMembershipsCollection({ churchId });
  const teamMemberIdsByTeamId = buildTeamMemberIndex(
    teamMembershipsCollection.teamMembershipsCollection,
  );

  const cycles = cyclesCollection.cyclesCollection;
  const currentCycle = selectCurrentExecutionCycle(cycles, today);
  const churchDefaultWorkflow = workflows.workflowsCollection.find(
    (workflow) => workflow.isDefault,
  );
  const workflowId = getExecutionWorkflowId({
    surface,
    churchDefaultWorkflowId: churchDefaultWorkflow?.id,
    teamDefaultWorkflowId: team?.defaultWorkflowId,
  });

  const workflowStatuses = workflowId
    ? workflowStatusesCollection.workflowStatusesCollection.filter(
        (status) => status.workflowId === workflowId,
      )
    : [];
  const taskReadArgs = getTaskExecutionReadArgs({
    churchId,
    currentUserId,
    surface,
    teamId: team?.id ?? null,
    cycleId: currentCycle?.id ?? null,
  });
  const taskFilters: TaskCollectionFilters | undefined = taskReadArgs
    ? {
        ...("surface" in taskReadArgs ? { surface: taskReadArgs.surface } : {}),
        ...("teamId" in taskReadArgs ? { teamId: taskReadArgs.teamId } : {}),
        cycleId: taskReadArgs.cycleId,
      }
    : undefined;
  const tasksCollection = useTasksCollection({
    churchId: !cyclesCollection.loading && taskReadArgs !== null ? churchId : null,
    currentUserId,
    filters: taskFilters,
  });

  const updateTask = useUpdateTaskMutation();

  const tasks = tasksCollection.tasksCollection;
  const isLoading =
    cyclesCollection.loading ||
    workflows.loading ||
    (workflowId !== undefined && workflowId !== null && workflowStatusesCollection.loading) ||
    (taskReadArgs !== null && tasksCollection.loading);

  return (
    <section className="grid gap-4">
      {isLoading ? <p className="text-sm text-muted-foreground">Loading Tasks...</p> : null}

      {workflowStatuses.length > 0 ? (
        <TaskKanbanBoard
          workflowStatuses={workflowStatuses.map(toBoardWorkflowStatus)}
          tasks={tasks.map((task) => toBoardTask(task, tasks))}
          assigneeOptions={usersCollection.usersCollection.map((user) => ({
            id: user.id,
            label: user.name ?? user.email ?? user.id,
          }))}
          currentUserId={currentUserId}
          teamMemberIdsByTeamId={teamMemberIdsByTeamId}
          onMoveTask={(move) => {
            void updateTask({
              churchId,
              actorUserId: currentUserId,
              taskId: move.taskId,
              fields: { workflowStatusId: move.workflowStatusId },
            });
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
          onOpenTask={(taskId) => {
            const url = openTaskDetailsPaneUrl({ id: taskId });
            void navigate({ to: url.to, search: url.search });
          }}
        />
      ) : !isLoading ? (
        <p className="text-sm text-muted-foreground">
          Configure {surface === "team_board" ? "this Team's" : "a default"} Workflow before using
          the Task board.
        </p>
      ) : null}
    </section>
  );
}

function toBoardWorkflowStatus(status: WorkflowStatus) {
  return {
    id: status.id,
    name: status.name,
    sortOrder: status.sortOrder,
    taskState: status.taskState,
  };
}

function toBoardTask(task: TaskSummary, tasks: readonly TaskSummary[]) {
  return {
    id: task.id,
    title: task.title,
    teamId: task.teamId,
    cycleId: task.cycleId,
    dueDate: task.dueDate,
    createdAt: task.createdAt,
    assignedUserId: task.assignedUserId,
    parentTask: getTaskParentContext(task, tasks),
    workflowStatusId: task.workflowStatusId,
    taskState: task.taskState,
  };
}
