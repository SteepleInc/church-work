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
  readonly assignedUserId: string | null;
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
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cyclesResult = useQuery(api.tasks.mcpListCycles, { churchId, actorUserId: currentUserId });
  const workDefaults = useQuery(api.workDefaults.readForChurch, { churchId });
  const usersResult = useQuery(api.tasks.mcpListUsers, { churchId, actorUserId: currentUserId });

  const cycles = cyclesResult?.ok ? cyclesResult.cycles : [];
  const currentCycle = selectCurrentExecutionCycle(cycles, today);
  const churchDefaultWorkflow = workDefaults?.ok
    ? workDefaults.data.workflows.find((workflow) => workflow.isDefault)
    : null;
  const workflowId = surface === "team_board" ? team?.defaultWorkflowId : churchDefaultWorkflow?.id;

  const workflowStatusesResult = useQuery(
    api.tasks.mcpListWorkflowStatuses,
    workflowId ? { churchId, actorUserId: currentUserId, workflowId } : "skip",
  );
  const tasksResult = useQuery(
    api.tasks.mcpListTasks,
    cyclesResult === undefined
      ? "skip"
      : {
          churchId,
          actorUserId: currentUserId,
          ...(surface === "team_board" ? { teamId: team?.id ?? null } : { surface }),
          ...(currentCycle ? { cycleId: currentCycle.id } : {}),
        },
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
  const creationStatus =
    workflowStatuses.find((status) => status.taskState === "todo") ?? workflowStatuses[0];
  const dueDate = currentCycle?.endDate ?? today;
  const isLoading =
    cyclesResult === undefined ||
    workDefaults === undefined ||
    (workflowId !== undefined && workflowId !== null && workflowStatusesResult === undefined) ||
    tasksResult === undefined ||
    usersResult === undefined;
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
          users={users}
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
  tasks,
  users,
  updateTask,
  completeTask,
  cancelTask,
  reopenTask,
}: {
  readonly churchId: string;
  readonly currentUserId: string;
  readonly tasks: readonly TaskSummary[];
  readonly users: readonly UserSummary[];
  readonly updateTask: (
    taskId: string,
    fields: { readonly title?: string; readonly assignedUserId?: string | null },
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
          Update assignment and lifecycle without leaving the board.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {tasks.map((task) => (
          <TaskActionRow
            key={task.id}
            task={task}
            users={users}
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
  task,
  users,
  updateTask,
  completeTask,
  cancelTask,
  reopenTask,
}: {
  readonly task: TaskSummary;
  readonly users: readonly UserSummary[];
  readonly updateTask: (
    taskId: string,
    fields: { readonly title?: string; readonly assignedUserId?: string | null },
  ) => void | Promise<unknown>;
  readonly completeTask: (taskId: string) => void | Promise<unknown>;
  readonly cancelTask: (taskId: string) => void | Promise<unknown>;
  readonly reopenTask: (taskId: string) => void | Promise<unknown>;
}) {
  const [draftTitle, setDraftTitle] = useState(task.title);
  const titleUpdateFields = getTaskTitleUpdateFields(task.title, draftTitle);

  return (
    <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(12rem,1fr)_auto_auto] md:items-center">
      <div className="grid gap-2">
        <Input
          aria-label={`Title for ${task.title}`}
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">State: {task.taskState}</p>
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
      </div>
      <NativeSelect
        size="sm"
        value={task.assignedUserId ?? ""}
        aria-label={`Assign ${task.title}`}
        onChange={(event) => {
          void updateTask(task.id, { assignedUserId: event.target.value || null });
        }}
      >
        <NativeSelectOption value="">Unassigned</NativeSelectOption>
        {users.map((user) => (
          <NativeSelectOption key={user.id} value={user.id}>
            {user.name ?? user.email ?? user.id}
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
    workflowStatusId: task.workflowStatusId,
    taskState: task.taskState,
  };
}
