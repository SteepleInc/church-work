import { useMemo } from "react";
import { CircleUserRound } from "lucide-react";

import { TeamAvatar } from "@/components/avatars/teamAvatar";
import { UserAvatar } from "@/components/avatars/userAvatar";
import { createColumnConfigHelper } from "@/components/data-table-filter/core/filters";
import type {
  ColumnConfig,
  ColumnOption,
  FilterItem,
} from "@/components/data-table-filter/core/types";
import { WorkflowStatusIcon } from "@/components/tasks/task-card-fields";
import type {
  ExecutionSurface,
  TaskState,
  TaskSummary,
} from "@/components/tasks/task-execution-surface-utils";
import {
  groupWorkflowStatusesByIdentity,
  taskStateLabel,
  UNASSIGNED_COLUMN_ID,
} from "@/components/tasks/task-kanban-adapter";
import type { TaskViewTab } from "@/components/tasks/task-view-options";
import { getUserDisplayName, useChurchUsersCollection } from "@/data/users/usersData.app";
import { useTeamsCollection } from "@/data/teams/teamsData.app";
import {
  useWorkflowsCollection,
  useWorkflowStatusesCollection,
} from "@/data/workflows/workflowsData.app";

/**
 * Ad-hoc Board filters (the thing the View Tab "combines with", per CONTEXT).
 *
 * The schema-driven `FilterItemSchema`/`ColumnConfig` model is the single
 * source of truth (the same model that drives Collections). Here we build a
 * task-specific `ColumnConfig` catalog and convert the active `FilterItem[]`
 * into `mcpListTasks` query args, where filtering actually executes
 * server-side (in-memory; see readTaskModel). Fields combine with AND;
 * within a field "is any of" is OR; surface scope + the View Tab's
 * taskStates are additional non-loosenable ANDs.
 */

const dtf = createColumnConfigHelper<TaskSummary>();

/** Assignee value standing in for "no assigned User" (maps to null server-side). */
export const UNASSIGNED_FILTER_VALUE = UNASSIGNED_COLUMN_ID;

type UserOption = { readonly id: string; readonly label: string };
type TeamOption = { readonly id: string; readonly name: string; readonly color?: string | null };
type WorkflowStatusOption = {
  readonly id: string;
  readonly name: string;
  readonly taskState: TaskState;
};

const TASK_STATE_VALUES: readonly TaskState[] = ["todo", "in_progress", "done", "canceled"];
const WORKFLOW_STATUS_GROUP_PREFIX = "workflow-status-group:";

function userOptions(users: readonly UserOption[]): readonly ColumnOption[] {
  return users.map((user) => ({
    value: user.id,
    label: user.label,
    icon: <UserAvatar name={user.label} size={18} userId={user.id} />,
  }));
}

function assigneeOptions(users: readonly UserOption[]): readonly ColumnOption[] {
  return [
    {
      value: UNASSIGNED_FILTER_VALUE,
      label: "Unassigned",
      icon: <CircleUserRound className="size-[18px] text-muted-foreground" strokeWidth={1.5} />,
    },
    ...userOptions(users),
  ];
}

function teamOptions(teams: readonly TeamOption[]): readonly ColumnOption[] {
  return teams.map((team) => ({
    value: team.id,
    label: team.name,
    icon: <TeamAvatar color={team.color} name={team.name} size={18} />,
  }));
}

function workflowStatusOptions(statuses: readonly WorkflowStatusOption[]): readonly ColumnOption[] {
  return groupWorkflowStatusesByIdentity(statuses).map((group) => ({
    value:
      group.ids.length === 1
        ? group.ids[0]
        : `${WORKFLOW_STATUS_GROUP_PREFIX}${group.ids.join(",")}`,
    label: group.name,
    icon: <WorkflowStatusIcon taskState={group.taskState} />,
  }));
}

function taskStateOptions(): readonly ColumnOption[] {
  return TASK_STATE_VALUES.map((taskState) => ({
    value: taskState,
    label: taskStateLabel(taskState),
    icon: <WorkflowStatusIcon taskState={taskState} />,
  }));
}

/**
 * The available filter fields for a Board surface (context-aware): team_board
 * hides Team (already pinned); my_work hides the field its active View Tab
 * already pins (Assigned -> Assignee, Created -> Creator); our_work shows all.
 * Workflow Status options are scoped by the caller to the surface's Workflow.
 */
export function buildTaskFilterFields(args: {
  readonly surface: ExecutionSurface;
  readonly tab?: TaskViewTab;
  readonly users: readonly UserOption[];
  readonly teams: readonly TeamOption[];
  readonly workflowStatuses: readonly WorkflowStatusOption[];
}): ReadonlyArray<ColumnConfig<TaskSummary>> {
  const fields: Array<ColumnConfig<TaskSummary>> = [];

  const hideAssignee = args.surface === "my_work" && args.tab === "assigned";
  const hideCreator = args.surface === "my_work" && args.tab === "created";

  if (!hideAssignee) {
    fields.push(
      dtf
        .option()
        .id("assignee")
        .accessor((task) => task.assignedUserId ?? UNASSIGNED_FILTER_VALUE)
        .displayName("Assignee")
        .options(assigneeOptions(args.users))
        .build(),
    );
  }

  if (!hideCreator) {
    // Creator has no field on TaskSummary client-side; filtering is
    // server-side. The accessor is unused for server filtering but ColumnConfig
    // requires one.
    fields.push(
      dtf
        .option()
        .id("creator")
        .accessor(() => "")
        .displayName("Creator")
        .options(userOptions(args.users))
        .build(),
    );
  }

  if (args.surface !== "team_board") {
    fields.push(
      dtf
        .option()
        .id("team")
        .accessor((task) => task.teamId)
        .displayName("Team")
        .options(teamOptions(args.teams))
        .build(),
    );
  }

  fields.push(
    dtf
      .option()
      .id("workflowStatus")
      .accessor((task) => task.workflowStatusId)
      .displayName("Status")
      .options(workflowStatusOptions(args.workflowStatuses))
      .build(),
    dtf
      .option()
      .id("taskState")
      .accessor((task) => task.taskState)
      .displayName("Status type")
      .options(taskStateOptions())
      .build(),
  );

  return fields;
}

/**
 * Loads the collections the Board already shows and assembles the per-surface
 * filter field catalog. Workflow Status options are scoped exactly like the
 * Board: a Team Board shows that Team's Workflow statuses; cross-team surfaces
 * show all active statuses.
 */
export function useTaskFilterFields(args: {
  readonly churchId: string | null;
  readonly surface: ExecutionSurface;
  readonly teamId?: string | null;
  readonly tab?: TaskViewTab;
}): ReadonlyArray<ColumnConfig<TaskSummary>> {
  const users = useChurchUsersCollection({ churchId: args.churchId });
  const teams = useTeamsCollection({ churchId: args.churchId });
  const workflows = useWorkflowsCollection({ churchId: args.churchId });
  const workflowStatuses = useWorkflowStatusesCollection({ churchId: args.churchId });

  return useMemo(() => {
    const userOptionItems: UserOption[] = users.usersCollection.map((user) => ({
      id: user.id,
      label: getUserDisplayName(user),
    }));
    const teamOptionItems: TeamOption[] = teams.teamsCollection.map((team) => ({
      id: team.id,
      name: team.name,
      color: (team as { readonly color?: string | null }).color ?? null,
    }));

    const teamWorkflow =
      args.surface === "team_board" && args.teamId
        ? workflows.workflowsCollection.find(
            (workflow) =>
              workflow.teamId === args.teamId &&
              (workflow as { readonly archivedAt?: string | null }).archivedAt == null,
          )
        : undefined;
    const activeStatuses = workflowStatuses.workflowStatusesCollection.filter(
      (status) => (status as { readonly archivedAt?: string | null }).archivedAt == null,
    );
    const scopedStatuses =
      args.surface === "team_board"
        ? teamWorkflow
          ? activeStatuses.filter((status) => status.workflowId === teamWorkflow.id)
          : []
        : activeStatuses;
    const statusOptionItems: WorkflowStatusOption[] = [...scopedStatuses]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((status) => ({ id: status.id, name: status.name, taskState: status.taskState }));

    return buildTaskFilterFields({
      surface: args.surface,
      tab: args.tab,
      users: userOptionItems,
      teams: teamOptionItems,
      workflowStatuses: statusOptionItems,
    });
  }, [
    users.usersCollection,
    teams.teamsCollection,
    workflows.workflowsCollection,
    workflowStatuses.workflowStatusesCollection,
    args.surface,
    args.teamId,
    args.tab,
  ]);
}

/** Map an Assignee/Creator filter value to its server value (Unassigned -> null). */
function toUserIdValue(value: string): string | null {
  return value === UNASSIGNED_FILTER_VALUE ? null : value;
}

function workflowStatusValues(values: readonly string[]): string[] {
  return values.flatMap((value) =>
    value.startsWith(WORKFLOW_STATUS_GROUP_PREFIX)
      ? value.slice(WORKFLOW_STATUS_GROUP_PREFIX.length).split(",").filter(Boolean)
      : [value],
  );
}

export function mapTaskFilterValuesForZero(
  filter: FilterItem,
): readonly (string | null)[] | undefined {
  if (filter.type !== "option" && filter.type !== "multiOption") return undefined;

  if (filter.columnId === "assignee" || filter.columnId === "creator") {
    return filter.values.map(toUserIdValue);
  }
  if (filter.columnId === "workflowStatus") return workflowStatusValues(filter.values);

  return undefined;
}
