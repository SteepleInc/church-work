import { api } from "@church-task/backend/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

import { TaskKanbanBoard } from "./task-kanban-board";

export type ExecutionSurface = "my_work" | "our_work" | "team_board";

type ExecutionCycle = {
  readonly id: string;
  readonly startDate: string;
  readonly endDate: string;
};

type TaskState = "todo" | "in_progress" | "done" | "canceled";

type TaskSummary = {
  readonly id: string;
  readonly title: string;
  readonly teamId: string | null;
  readonly assignedUserId: string | null;
  readonly cycleId: string;
  readonly dueDate: string;
  readonly workflowStatusId: string;
  readonly taskState: TaskState;
};

type WorkflowStatus = {
  readonly id: string;
  readonly workflowId: string;
  readonly name: string;
  readonly taskState: TaskState;
  readonly sortOrder: number;
};

type UserSummary = {
  readonly id: string;
  readonly name: string | null;
  readonly email: string | null;
};

type TeamSummary = {
  readonly id: string;
  readonly name: string;
};

type MyWorkEmptyStateTeam = {
  readonly id: string;
  readonly name: string;
};

type MyWorkEmptyStateAction =
  | { readonly kind: "our_work"; readonly label: "Open Our Work" }
  | { readonly kind: "team_board"; readonly teamId: string; readonly label: string };

type TaskActivitySummary = {
  readonly id: string;
  readonly eventType: string;
  readonly actorType: string;
  readonly actorId: string | null;
  readonly occurredAt: string;
};

export function selectCurrentExecutionCycle(
  cycles: readonly ExecutionCycle[],
  today: string,
): ExecutionCycle | null {
  return (
    [...cycles]
      .sort((left, right) => left.startDate.localeCompare(right.startDate))
      .find((cycle) => cycle.startDate <= today && today <= cycle.endDate) ?? null
  );
}

export function getTaskCreationDefaults(args: {
  readonly surface: ExecutionSurface;
  readonly currentUserId: string;
  readonly teamId?: string | null;
}) {
  return {
    assignedUserId: args.surface === "my_work" ? args.currentUserId : null,
    teamId: args.surface === "team_board" ? (args.teamId ?? null) : null,
  };
}

export function getTaskTitleUpdateFields(currentTitle: string, nextTitle: string) {
  const trimmedTitle = nextTitle.trim();

  if (!trimmedTitle || trimmedTitle === currentTitle) {
    return null;
  }

  return { title: trimmedTitle };
}

export function getTaskDueDateUpdateFields(currentDueDate: string, nextDueDate: string) {
  if (!nextDueDate || nextDueDate === currentDueDate) {
    return null;
  }

  return { dueDate: nextDueDate };
}

function addDays(localDate: string, days: number) {
  const [year, month, day] = localDate.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function daysBetween(startDate: string, endDate: string) {
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number) as [number, number, number];
  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((end - start) / 86_400_000);
}

export function getTaskCycleUpdatePreview(args: {
  readonly currentCycleId: string;
  readonly nextCycleId: string;
  readonly currentDueDate: string;
  readonly cycles: readonly ExecutionCycle[];
}) {
  if (!args.nextCycleId || args.nextCycleId === args.currentCycleId) {
    return null;
  }

  const currentCycle = args.cycles.find((cycle) => cycle.id === args.currentCycleId);
  const nextCycle = args.cycles.find((cycle) => cycle.id === args.nextCycleId);

  if (!currentCycle || !nextCycle) {
    return null;
  }

  const weekdayOffset = daysBetween(currentCycle.startDate, args.currentDueDate);

  return {
    cycleId: nextCycle.id,
    previousDueDate: args.currentDueDate,
    dueDate: addDays(nextCycle.startDate, weekdayOffset),
  };
}

export function getTaskTeamUpdateFields(currentTeamId: string | null, nextTeamId: string) {
  const teamId = nextTeamId || null;

  if (teamId === currentTeamId) {
    return null;
  }

  return { teamId };
}

export function getTaskAssigneeOptions(users: readonly UserSummary[]) {
  return users;
}

export function getExecutionWorkflowId(args: {
  readonly surface: ExecutionSurface;
  readonly churchDefaultWorkflowId?: string | null;
  readonly teamDefaultWorkflowId?: string | null;
}) {
  return args.surface === "team_board" ? args.teamDefaultWorkflowId : args.churchDefaultWorkflowId;
}

export function getTaskExecutionReadArgs(args: {
  readonly churchId: string;
  readonly currentUserId: string;
  readonly surface: ExecutionSurface;
  readonly teamId?: string | null;
  readonly cycleId?: string | null;
}) {
  return {
    churchId: args.churchId,
    actorUserId: args.currentUserId,
    ...(args.surface === "team_board"
      ? { teamId: args.teamId ?? null }
      : { surface: args.surface }),
    ...(args.cycleId ? { cycleId: args.cycleId } : {}),
  };
}

export function getMyWorkEmptyStateActions(
  teams: readonly MyWorkEmptyStateTeam[],
): readonly MyWorkEmptyStateAction[] {
  return [
    { kind: "our_work", label: "Open Our Work" },
    ...teams.map((team) => ({ kind: "team_board" as const, teamId: team.id, label: team.name })),
  ];
}

export function formatTaskActivity(activity: TaskActivitySummary) {
  const eventLabel = activity.eventType.replace(/^task\./, "").replaceAll("_", " ");
  const actorLabel =
    activity.actorType === "user" && activity.actorId
      ? `User ${activity.actorId}`
      : activity.actorType === "system"
        ? "System"
        : activity.actorType;

  return `${eventLabel} by ${actorLabel}`;
}

export function TaskExecutionSurface({
  churchId,
  currentUserId,
  surface,
  team,
  myWorkEmptyStateTeams,
  onOpenOurWork,
  onOpenTeamBoard,
}: {
  readonly churchId: string;
  readonly currentUserId: string;
  readonly surface: ExecutionSurface;
  readonly team?: {
    readonly id: string;
    readonly name: string;
    readonly defaultWorkflowId: string | null;
  } | null;
  readonly myWorkEmptyStateTeams?: readonly MyWorkEmptyStateTeam[];
  readonly onOpenOurWork?: () => void;
  readonly onOpenTeamBoard?: (teamId: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cyclesResult = useQuery(api.tasks.mcpListCycles, { churchId, actorUserId: currentUserId });
  const workDefaults = useQuery(api.workDefaults.readForChurch, { churchId });
  const usersResult = useQuery(api.tasks.mcpListUsers, { churchId, actorUserId: currentUserId });
  const teamsResult = useQuery(api.tasks.mcpListTeams, { churchId, actorUserId: currentUserId });

  const cycles = cyclesResult?.ok ? cyclesResult.cycles : [];
  const currentCycle = selectCurrentExecutionCycle(cycles, today);
  const churchDefaultWorkflow = workDefaults?.ok
    ? workDefaults.data.workflows.find((workflow) => workflow.isDefault)
    : null;
  const workflowId = getExecutionWorkflowId({
    surface,
    churchDefaultWorkflowId: churchDefaultWorkflow?.id,
    teamDefaultWorkflowId: team?.defaultWorkflowId,
  });

  const workflowStatusesResult = useQuery(
    api.tasks.mcpListWorkflowStatuses,
    workflowId ? { churchId, actorUserId: currentUserId, workflowId } : "skip",
  );
  const tasksResult = useQuery(
    api.tasks.mcpListTasks,
    cyclesResult === undefined
      ? "skip"
      : getTaskExecutionReadArgs({
          churchId,
          currentUserId,
          surface,
          teamId: team?.id ?? null,
          cycleId: currentCycle?.id ?? null,
        }),
  );

  const createTask = useMutation(api.tasks.mcpCreateTask);
  const updateTask = useMutation(api.tasks.mcpUpdateTask);
  const completeTask = useMutation(api.tasks.mcpCompleteTask);
  const cancelTask = useMutation(api.tasks.mcpCancelTask);
  const reopenTask = useMutation(api.tasks.mcpReopenTask);

  const workflowStatuses = workflowStatusesResult?.ok
    ? workflowStatusesResult.workflowStatuses
    : [];
  const tasks = tasksResult?.ok ? tasksResult.data.tasks : [];
  const users = usersResult?.ok ? usersResult.users : [];
  const teams = teamsResult?.ok ? teamsResult.teams : [];
  const myWorkEmptyStateActions = getMyWorkEmptyStateActions(myWorkEmptyStateTeams ?? []);
  const creationStatus =
    workflowStatuses.find((status) => status.taskState === "todo") ?? workflowStatuses[0];
  const dueDate = currentCycle?.endDate ?? today;
  const isLoading =
    cyclesResult === undefined ||
    workDefaults === undefined ||
    (workflowId !== undefined && workflowId !== null && workflowStatusesResult === undefined) ||
    tasksResult === undefined ||
    usersResult === undefined ||
    teamsResult === undefined;
  const surfaceTitle =
    surface === "my_work"
      ? "My Work"
      : surface === "our_work"
        ? "Our Work"
        : (team?.name ?? "Team");

  const handleCreateTask = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !creationStatus) return;

    setError(null);
    const defaults = getTaskCreationDefaults({ surface, currentUserId, teamId: team?.id ?? null });
    const result = await createTask({
      churchId,
      actorUserId: currentUserId,
      title: trimmedTitle,
      teamId: defaults.teamId,
      assignedUserId: defaults.assignedUserId,
      workflowStatusId: creationStatus.id,
      dueDate,
      parentTaskId: null,
    });

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setTitle("");
  };

  return (
    <section className="grid gap-4">
      <Card>
        <CardHeader className="gap-2">
          <CardTitle>{surfaceTitle}</CardTitle>
          <CardDescription>
            {surface === "my_work"
              ? "Tasks assigned directly to you in the current execution window."
              : surface === "our_work"
                ? "All Tasks in the active Church execution window."
                : "Team Tasks in the current execution window."}
          </CardDescription>
          {currentCycle ? (
            <p className="text-xs text-muted-foreground">
              Cycle: {currentCycle.startDate} to {currentCycle.endDate}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={
              surface === "my_work"
                ? "Add a Task assigned to me"
                : surface === "our_work"
                  ? "Add Church-wide Task"
                  : "Add Team Task"
            }
          />
          <Button
            type="button"
            disabled={!title.trim() || !creationStatus}
            onClick={handleCreateTask}
          >
            Create Task
          </Button>
          {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
        </CardContent>
      </Card>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading Tasks...</p> : null}

      {!isLoading && surface === "my_work" && tasks.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Tasks assigned to you</CardTitle>
            <CardDescription>
              Use Our Work or Team boards to find shared Church work without leaving My Work.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {myWorkEmptyStateActions.map((action) => (
              <Button
                key={action.kind === "our_work" ? "our_work" : action.teamId}
                type="button"
                variant={action.kind === "our_work" ? "default" : "outline"}
                onClick={() => {
                  if (action.kind === "our_work") {
                    onOpenOurWork?.();
                    return;
                  }

                  onOpenTeamBoard?.(action.teamId);
                }}
              >
                {action.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {workflowStatuses.length > 0 ? (
        <TaskKanbanBoard
          workflowStatuses={workflowStatuses.map(toBoardWorkflowStatus)}
          tasks={tasks.map(toBoardTask)}
          onMoveTask={(move) => {
            void updateTask({
              churchId,
              actorUserId: currentUserId,
              taskId: move.taskId,
              fields: { workflowStatusId: move.workflowStatusId },
            });
          }}
        />
      ) : !isLoading ? (
        <p className="text-sm text-muted-foreground">
          Configure {surface === "team_board" ? "this Team's" : "a default"} Workflow before using
          the Task board.
        </p>
      ) : null}

      {tasks.length > 0 ? (
        <TaskActionList
          churchId={churchId}
          currentUserId={currentUserId}
          tasks={tasks}
          cycles={cycles}
          users={users}
          teams={teams}
          updateTask={(taskId, fields) =>
            updateTask({ churchId, actorUserId: currentUserId, taskId, fields })
          }
          completeTask={(taskId) => completeTask({ churchId, actorUserId: currentUserId, taskId })}
          cancelTask={(taskId) => cancelTask({ churchId, actorUserId: currentUserId, taskId })}
          reopenTask={(taskId) => reopenTask({ churchId, actorUserId: currentUserId, taskId })}
        />
      ) : null}
    </section>
  );
}

function TaskActionList({
  churchId,
  tasks,
  cycles,
  users,
  teams,
  updateTask,
  completeTask,
  cancelTask,
  reopenTask,
}: {
  readonly churchId: string;
  readonly currentUserId: string;
  readonly tasks: readonly TaskSummary[];
  readonly cycles: readonly ExecutionCycle[];
  readonly users: readonly UserSummary[];
  readonly teams: readonly TeamSummary[];
  readonly updateTask: (
    taskId: string,
    fields: {
      readonly title?: string;
      readonly dueDate?: string;
      readonly cycleId?: string;
      readonly assignedUserId?: string | null;
      readonly teamId?: string | null;
    },
  ) => void | Promise<unknown>;
  readonly completeTask: (taskId: string) => void | Promise<unknown>;
  readonly cancelTask: (taskId: string) => void | Promise<unknown>;
  readonly reopenTask: (taskId: string) => void | Promise<unknown>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Task Actions</CardTitle>
        <CardDescription>
          Update assignment, Team, and lifecycle without leaving the board.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {tasks.map((task) => (
          <TaskActionRow
            key={task.id}
            churchId={churchId}
            task={task}
            cycles={cycles}
            users={users}
            teams={teams}
            updateTask={updateTask}
            completeTask={completeTask}
            cancelTask={cancelTask}
            reopenTask={reopenTask}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function TaskActionRow({
  churchId,
  task,
  cycles,
  users,
  teams,
  updateTask,
  completeTask,
  cancelTask,
  reopenTask,
}: {
  readonly churchId: string;
  readonly task: TaskSummary;
  readonly cycles: readonly ExecutionCycle[];
  readonly users: readonly UserSummary[];
  readonly teams: readonly TeamSummary[];
  readonly updateTask: (
    taskId: string,
    fields: {
      readonly title?: string;
      readonly dueDate?: string;
      readonly cycleId?: string;
      readonly assignedUserId?: string | null;
      readonly teamId?: string | null;
    },
  ) => void | Promise<unknown>;
  readonly completeTask: (taskId: string) => void | Promise<unknown>;
  readonly cancelTask: (taskId: string) => void | Promise<unknown>;
  readonly reopenTask: (taskId: string) => void | Promise<unknown>;
}) {
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftDueDate, setDraftDueDate] = useState(task.dueDate);
  const titleUpdateFields = getTaskTitleUpdateFields(task.title, draftTitle);
  const dueDateUpdateFields = getTaskDueDateUpdateFields(task.dueDate, draftDueDate);
  const assigneeOptions = getTaskAssigneeOptions(users);

  return (
    <div
      aria-label={`Actions for ${task.title}`}
      className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[minmax(12rem,1fr)_auto_auto_auto_auto] lg:items-center"
      role="group"
    >
      <div className="grid gap-2">
        <Input
          aria-label={`Title for ${task.title}`}
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">State: {task.taskState}</p>
        <TaskActivityList churchId={churchId} taskId={task.id} />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-fit"
          disabled={!titleUpdateFields}
          onClick={() => {
            if (!titleUpdateFields) return;
            void updateTask(task.id, titleUpdateFields);
          }}
        >
          Save Title
        </Button>
        <div className="grid gap-1 sm:max-w-44">
          <label className="text-xs font-medium" htmlFor={`due-date-${task.id}`}>
            Due Date
          </label>
          <div className="flex gap-2">
            <Input
              id={`due-date-${task.id}`}
              aria-label={`Due Date for ${task.title}`}
              type="date"
              value={draftDueDate}
              onChange={(event) => setDraftDueDate(event.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!dueDateUpdateFields}
              onClick={() => {
                if (!dueDateUpdateFields) return;
                void updateTask(task.id, dueDateUpdateFields);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
      <NativeSelect
        size="sm"
        value={task.cycleId}
        aria-label={`Move Cycle for ${task.title}`}
        onChange={(event) => {
          const preview = getTaskCycleUpdatePreview({
            currentCycleId: task.cycleId,
            nextCycleId: event.target.value,
            currentDueDate: task.dueDate,
            cycles,
          });

          if (!preview) return;

          const confirmed = window.confirm(
            `Changing Cycle will shift Due Date from ${preview.previousDueDate} to ${preview.dueDate}. Continue?`,
          );

          if (!confirmed) return;

          void updateTask(task.id, { cycleId: preview.cycleId });
        }}
      >
        {cycles.map((cycle) => (
          <NativeSelectOption key={cycle.id} value={cycle.id}>
            {cycle.startDate} to {cycle.endDate}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        size="sm"
        value={task.assignedUserId ?? ""}
        aria-label={`Assign ${task.title}`}
        onChange={(event) => {
          void updateTask(task.id, { assignedUserId: event.target.value || null });
        }}
      >
        <NativeSelectOption value="">Unassigned</NativeSelectOption>
        {assigneeOptions.map((user) => (
          <NativeSelectOption key={user.id} value={user.id}>
            {user.name ?? user.email ?? user.id}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        size="sm"
        value={task.teamId ?? ""}
        aria-label={`Assign Team for ${task.title}`}
        onChange={(event) => {
          const fields = getTaskTeamUpdateFields(task.teamId, event.target.value);
          if (!fields) return;
          void updateTask(task.id, fields);
        }}
      >
        <NativeSelectOption value="">No Team</NativeSelectOption>
        {teams.map((team) => (
          <NativeSelectOption key={team.id} value={team.id}>
            {team.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <div className="flex flex-wrap gap-2">
        {task.taskState === "canceled" ? (
          <Button type="button" size="sm" variant="outline" onClick={() => reopenTask(task.id)}>
            Reopen
          </Button>
        ) : (
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => completeTask(task.id)}>
              Complete
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => cancelTask(task.id)}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function TaskActivityList({
  churchId,
  taskId,
}: {
  readonly churchId: string;
  readonly taskId: string;
}) {
  const activitiesResult = useQuery(api.activities.listForEntity, {
    churchId,
    entityType: "task",
    entityId: taskId,
  });
  const activities = activitiesResult?.ok
    ? activitiesResult.data.activities.slice(-3).reverse()
    : [];

  return (
    <div aria-label="Recent Task Activity" className="grid gap-1 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">Recent Activity</p>
      {activitiesResult === undefined ? <p>Loading Activity...</p> : null}
      {activitiesResult !== undefined && activities.length === 0 ? <p>No Activity yet.</p> : null}
      {activities.map((activity) => (
        <p key={activity.id}>{formatTaskActivity(activity)}</p>
      ))}
    </div>
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

function toBoardTask(task: TaskSummary) {
  return {
    id: task.id,
    title: task.title,
    teamId: task.teamId,
    cycleId: task.cycleId,
    dueDate: task.dueDate,
    workflowStatusId: task.workflowStatusId,
    taskState: task.taskState,
  };
}
