import { resolveTaskViewTab, type TaskViewTab } from "@/components/tasks/task-view-options";

export type ExecutionSurface = "my_work" | "our_work" | "team_board";

type ExecutionCycle = {
  readonly id: string;
  readonly startDate: string;
  readonly endDate: string;
};

export type TaskState = "todo" | "in_progress" | "done" | "canceled";

export type TaskSummary = {
  readonly id: string;
  // The Task Identifier (e.g. "PRD-48") computed by the backend at read time
  // from the Team Identifier and the Task's per-Team number (ADR 0013).
  readonly identifier: string;
  readonly title: string;
  readonly teamId: string;
  readonly assignedUserId: string | null;
  readonly cycleId: string;
  readonly dueDate: string | null;
  readonly createdAt: number;
  readonly parentTaskId: string | null;
  readonly workflowId: string;
  readonly workflowStatusId: string;
  readonly taskState: TaskState;
  readonly estimate?: "xs" | "s" | "m" | "l" | "xl" | null;
  readonly boardOrder?: string;
  readonly labelIds?: readonly string[];
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

/**
 * Default Team for the create-task picker (ADR 0013). The surface preset
 * (Team Board column, subtask parent) wins, then the last-used Team, then
 * the user's first Team Membership, then the Church's first Team — never
 * empty while the Church has Teams. Returns null only when no Teams exist.
 */
export function getDefaultCreateTaskTeamId(args: {
  readonly presetTeamId?: string | null;
  readonly lastUsedTeamId?: string | null;
  readonly currentUserId: string;
  readonly teams: readonly { readonly id: string; readonly sortOrder: number }[];
  readonly memberships: readonly { readonly teamId: string; readonly userId: string }[];
}): string | null {
  const orderedTeams = [...args.teams].sort((left, right) => left.sortOrder - right.sortOrder);
  const teamIds = new Set(orderedTeams.map((team) => team.id));

  if (args.presetTeamId && teamIds.has(args.presetTeamId)) return args.presetTeamId;
  if (args.lastUsedTeamId && teamIds.has(args.lastUsedTeamId)) return args.lastUsedTeamId;

  const membershipTeamIds = new Set(
    args.memberships
      .filter((membership) => membership.userId === args.currentUserId)
      .map((membership) => membership.teamId),
  );
  const membershipTeam = orderedTeams.find((team) => membershipTeamIds.has(team.id));
  if (membershipTeam) return membershipTeam.id;

  return orderedTeams[0]?.id ?? null;
}

/**
 * Board grouping per surface (ADR 0013: every Team owns its Workflow). A Team
 * Board groups by that Team's Workflow Statuses; cross-team surfaces (My
 * Work, Our Work) have no single Workflow, so Workflow Status grouping
 * becomes Task State grouping there.
 */
export function getExecutionBoardGrouping<Grouping extends string>(
  surface: ExecutionSurface,
  grouping: Grouping,
): Grouping | "task_state" {
  return surface !== "team_board" && grouping === "workflow_status" ? "task_state" : grouping;
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
      ? args.teamId
        ? { teamId: args.teamId }
        : {}
      : { surface: args.surface }),
    cycleId: args.cycleId,
  };
}

/**
 * Compile the active View Tab into server-side query filters (ADR 0007). The
 * tab is a named preset that ANDs with everything else; it never appears in
 * the ad-hoc filters list.
 */
export function getTaskTabFilters(args: {
  readonly surface: ExecutionSurface;
  readonly tab?: TaskViewTab;
  readonly currentUserId: string;
}): {
  readonly surface?: "my_work" | "our_work";
  readonly createdByUserId?: string;
  readonly taskStates?: readonly TaskState[];
} {
  const tab = resolveTaskViewTab(args.surface, args.tab);

  if (args.surface === "my_work") {
    return tab === "created" ? { createdByUserId: args.currentUserId } : { surface: "my_work" };
  }

  const taskStates: readonly TaskState[] | undefined =
    tab === "active" ? ["todo", "in_progress"] : tab === "done" ? ["done", "canceled"] : undefined;

  return {
    ...(args.surface === "our_work" ? { surface: "our_work" as const } : {}),
    ...(taskStates ? { taskStates } : {}),
  };
}

/**
 * Full server-side query filters for a task surface: tab preset + Team scope +
 * Cycle scope + View Options that are filters/ordering (sub-task visibility,
 * ordering). Grouping and display properties stay client-side.
 */
export function getTaskExecutionFilters(args: {
  readonly surface: ExecutionSurface;
  readonly teamId?: string | null;
  readonly cycleId: string;
  readonly currentUserId: string;
  readonly tab?: TaskViewTab;
  readonly showSubtasks: boolean;
  readonly ordering: "created" | "due_date";
}) {
  return {
    ...getTaskTabFilters(args),
    ...(args.surface === "team_board" && args.teamId ? { teamId: args.teamId } : {}),
    cycleId: args.cycleId,
    ...(args.showSubtasks ? {} : { excludeSubtasks: true as const }),
    ...(args.ordering === "due_date" ? { orderBy: "due_date" as const } : {}),
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
