export type ExecutionSurface = "my_work" | "our_work" | "team_board";

type ExecutionCycle = {
  readonly id: string;
  readonly startDate: string;
  readonly endDate: string;
};

export type TaskState = "todo" | "in_progress" | "done" | "canceled";

export type TaskSummary = {
  readonly id: string;
  readonly title: string;
  readonly teamId: string | null;
  readonly assignedUserId: string | null;
  readonly cycleId: string;
  readonly dueDate: string;
  readonly createdAt: number;
  readonly parentTaskId: string | null;
  readonly workflowStatusId: string;
  readonly taskState: TaskState;
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
  if (!args.cycleId) {
    return null;
  }

  return {
    churchId: args.churchId,
    actorUserId: args.currentUserId,
    ...(args.surface === "team_board"
      ? { teamId: args.teamId ?? null }
      : { surface: args.surface }),
    cycleId: args.cycleId,
  };
}

export function buildTeamMemberIndex(
  memberships: readonly { readonly teamId: string; readonly userId: string }[],
): ReadonlyMap<string, ReadonlySet<string>> {
  const index = new Map<string, Set<string>>();
  for (const membership of memberships) {
    const members = index.get(membership.teamId) ?? new Set<string>();
    members.add(membership.userId);
    index.set(membership.teamId, members);
  }
  return index;
}

export function getTaskParentContext(task: TaskSummary, tasks: readonly TaskSummary[]) {
  if (!task.parentTaskId) return null;

  const parentTask = tasks.find((candidate) => candidate.id === task.parentTaskId);
  if (!parentTask) return null;

  return { id: parentTask.id, title: parentTask.title };
}
