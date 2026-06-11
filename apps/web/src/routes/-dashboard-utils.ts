import { parseDetailsPaneState } from "@/components/details-pane/details-pane-helpers";
import type { DetailsPaneParams } from "@/components/details-pane/details-pane-types";
import { FilterKeys } from "@/shared/global-state";
import { getFilterStateValue, type FilterStateValue } from "@/shared/hooks/useFilters";

export type DashboardSearch = {
  readonly taskState?: "todo" | "in_progress" | "done" | "canceled";
  readonly workflowStatusId?: string;
  readonly "details-pane"?: DetailsPaneParams;
  readonly [FilterKeys.Orgs]?: FilterStateValue;
  readonly [FilterKeys.Users]?: FilterStateValue;
};

type TaskExecutionFilters = {
  readonly taskState?: DashboardSearch["taskState"];
  readonly workflowStatusId?: string;
};

type DashboardTeamSummary = {
  readonly id: string;
};

type DashboardTeamMembershipSummary = {
  readonly teamId: string;
  readonly userId: string;
};

function getSearchFilterState(search: Record<string, unknown>, filterKey: FilterKeys) {
  const value = getFilterStateValue(search, filterKey);

  return value.filters?.length || value.sorting?.length ? value : undefined;
}

export function validateDashboardSearch(search: Record<string, unknown>): DashboardSearch {
  const taskState = search.taskState;
  const workflowStatusId = search.workflowStatusId;
  const detailsPaneState = parseDetailsPaneState(search);

  return {
    taskState:
      taskState === "todo" ||
      taskState === "in_progress" ||
      taskState === "done" ||
      taskState === "canceled"
        ? taskState
        : undefined,
    workflowStatusId:
      typeof workflowStatusId === "string" && workflowStatusId.length > 0
        ? workflowStatusId
        : undefined,
    "details-pane": detailsPaneState.length > 0 ? detailsPaneState : undefined,
    [FilterKeys.Orgs]: getSearchFilterState(search, FilterKeys.Orgs),
    [FilterKeys.Users]: getSearchFilterState(search, FilterKeys.Users),
  };
}

export function getUnavailableTeamBoardActions() {
  return [
    { panel: "my_work" as const, label: "Open My Work" },
    { panel: "our_work" as const, label: "Open Our Work" },
  ];
}

function getDashboardFilterSearch(search: DashboardSearch): DashboardSearch {
  return {
    ...(search.taskState ? { taskState: search.taskState } : {}),
    ...(search.workflowStatusId ? { workflowStatusId: search.workflowStatusId } : {}),
    ...(search["details-pane"] && search["details-pane"].length > 0
      ? { "details-pane": search["details-pane"] }
      : {}),
  };
}

export function getDashboardSearchForPanel(currentSearch: DashboardSearch = {}): DashboardSearch {
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
