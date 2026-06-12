import { describe, expect, test } from "bun:test";

import {
  decodeDashboardSearch,
  getDashboardSearchForExecutionFilters,
  getDashboardSearchForPanel,
  getMemberTeams,
  getUnavailableTeamBoardActions,
} from "./-dashboard-utils";

describe("dashboard execution route search", () => {
  test("keeps page identity out of dashboard search state", () => {
    expect(
      decodeDashboardSearch({
        work: "team",
        teamId: "team-1",
        taskState: "todo",
        workflowStatusId: "status-1",
      }),
    ).toEqual({
      taskState: "todo",
      workflowStatusId: "status-1",
    });
  });

  test("drops invalid temporary execution filters", () => {
    expect(
      decodeDashboardSearch({
        taskState: "blocked",
        workflowStatusId: "",
      }),
    ).toEqual({
      taskState: undefined,
      workflowStatusId: undefined,
    });
  });

  test("preserves temporary execution filters while switching execution pages", () => {
    expect(
      getDashboardSearchForPanel({ taskState: "in_progress", workflowStatusId: "status-1" }),
    ).toEqual({
      taskState: "in_progress",
      workflowStatusId: "status-1",
    });

    expect(getDashboardSearchForPanel({ taskState: "done" })).toEqual({
      taskState: "done",
    });
  });

  test("preserves details pane state while switching execution pages", () => {
    expect(
      getDashboardSearchForPanel({
        taskState: "todo",
        "details-pane": [{ _tag: "task", id: "task-1", tab: "details" }],
      }),
    ).toEqual({
      taskState: "todo",
      "details-pane": [{ _tag: "task", id: "task-1", tab: "details" }],
    });
  });

  test("encodes temporary execution filters as route search state", () => {
    expect(
      getDashboardSearchForExecutionFilters(
        {},
        { taskState: "in_progress", workflowStatusId: "status-1" },
      ),
    ).toEqual({
      taskState: "in_progress",
      workflowStatusId: "status-1",
    });

    expect(
      getDashboardSearchForExecutionFilters(
        { taskState: "done", workflowStatusId: "status-1" },
        {},
      ),
    ).toEqual({ taskState: undefined, workflowStatusId: undefined });
  });

  test("does not encode Team board identity while changing temporary execution filters", () => {
    expect(
      getDashboardSearchForExecutionFilters(
        { taskState: "todo" },
        { taskState: "done", workflowStatusId: "status-1" },
      ),
    ).toEqual({
      taskState: "done",
      workflowStatusId: "status-1",
    });
  });

  test("offers execution route recovery actions for unavailable Team boards", () => {
    expect(getUnavailableTeamBoardActions()).toEqual([
      { panel: "my_work", label: "Open My Work" },
      { panel: "our_work", label: "Open Our Work" },
    ]);
  });

  test("lists only current User Team Memberships in Team navigation", () => {
    const teams = [
      { id: "team-1", name: "Hospitality" },
      { id: "team-2", name: "Production" },
      { id: "team-3", name: "Care" },
    ];

    expect(
      getMemberTeams(
        teams,
        [
          { teamId: "team-1", userId: "current-user" },
          { teamId: "team-2", userId: "other-user" },
        ],
        "current-user",
      ),
    ).toEqual([{ id: "team-1", name: "Hospitality" }]);
  });
});
