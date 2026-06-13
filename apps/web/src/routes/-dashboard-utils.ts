import { Schema } from "effect";
import { normalizeTeamIdentifier } from "@church-task/domain/Team";

import { FilterStateValueSchema } from "@/components/data-table-filter/core/types";
import { DetailsPaneParams } from "@/components/details-pane/details-pane-types";
import type { TaskViewSearch } from "@/components/tasks/task-view-options";
import { FilterKeys } from "@/shared/global-state";
import { lenientSearchField } from "@/shared/lenient-search";

export const DashboardSearchSchema = Schema.Struct({
  taskState: lenientSearchField(Schema.Literal("todo", "in_progress", "done", "canceled")),
  workflowStatusId: lenientSearchField(Schema.NonEmptyString),
  "details-pane": lenientSearchField(DetailsPaneParams),
  [FilterKeys.Orgs]: lenientSearchField(FilterStateValueSchema),
  [FilterKeys.Users]: lenientSearchField(FilterStateValueSchema),
  [FilterKeys.Tasks]: lenientSearchField(FilterStateValueSchema),
});

/**
 * The `_org` layout search. Task routes layer `tab`/`view` on top of this via
 * their own route schemas (`MyWorkSearchSchema` / `ChurchWorkSearchSchema`).
 */
export type DashboardPanelSearch = typeof DashboardSearchSchema.Type;
export type DashboardSearch = DashboardPanelSearch & TaskViewSearch;

export const validateDashboardSearch = Schema.standardSchemaV1(DashboardSearchSchema);

export const decodeDashboardSearch = Schema.decodeUnknownSync(DashboardSearchSchema);

type TaskExecutionFilters = {
  readonly taskState?: DashboardSearch["taskState"];
  readonly workflowStatusId?: string;
};

type DashboardTeamSummary = {
  readonly id: string;
  readonly identifier: string;
  readonly previousIdentifiers?: readonly string[];
};

type DashboardTeamMembershipSummary = {
  readonly teamId: string;
  readonly userId: string;
};

export function getUnavailableTeamBoardActions() {
  return [
    { panel: "my_work" as const, label: "Open My Work" },
    { panel: "our_work" as const, label: "Open Our Work" },
  ];
}

function getDashboardFilterSearch(search: DashboardSearch): DashboardPanelSearch {
  return {
    ...(search.taskState ? { taskState: search.taskState } : {}),
    ...(search.workflowStatusId ? { workflowStatusId: search.workflowStatusId } : {}),
    ...(search["details-pane"] && search["details-pane"].length > 0
      ? { "details-pane": search["details-pane"] }
      : {}),
  };
}

/**
 * The search carried when switching between task surfaces. View Tabs and View
 * Options are intentionally dropped: they belong to the surface they were set
 * on (the team route retains them across `$teamId` switches separately).
 */
export function getDashboardSearchForPanel(
  currentSearch: DashboardSearch = {},
): DashboardPanelSearch {
  return getDashboardFilterSearch(currentSearch);
}

export function getDashboardSearchForExecutionFilters(
  search: DashboardSearch,
  filters: TaskExecutionFilters,
): DashboardSearch {
  return {
    ...getDashboardFilterSearch(search),
    taskState: filters.taskState,
    workflowStatusId: filters.workflowStatusId,
  };
}

export function getMemberTeams<Team extends DashboardTeamSummary>(
  teams: readonly Team[],
  memberships: readonly DashboardTeamMembershipSummary[],
  currentUserId: string | null,
): Team[] {
  const currentUserTeamIds = new Set(
    memberships
      .filter((membership) => membership.userId === currentUserId)
      .map((membership) => membership.teamId),
  );

  return teams.filter((team) => currentUserTeamIds.has(team.id));
}

export function resolveTeamByRouteIdentifier<Team extends DashboardTeamSummary>(
  teams: readonly Team[],
  routeIdentifier: string,
): Team | null {
  const identifier = normalizeTeamIdentifier(routeIdentifier);

  return (
    teams.find((team) => normalizeTeamIdentifier(team.identifier) === identifier) ??
    teams.find((team) =>
      (team.previousIdentifiers ?? []).some(
        (previousIdentifier) => normalizeTeamIdentifier(previousIdentifier) === identifier,
      ),
    ) ??
    null
  );
}
