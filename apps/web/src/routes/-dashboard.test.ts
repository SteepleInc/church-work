import { describe, expect, test } from "bun:test";

import {
  getDashboardPanelFromSearch,
  getDashboardSearchForExecutionFilters,
  getDashboardSearchForPanel,
  getMemberTeams,
  getUnavailableTeamBoardActions,
} from "./dashboard";

describe("dashboard execution route search", () => {
  test("lands on My Work when no execution panel is encoded", () => {
    expect(getDashboardPanelFromSearch({})).toBe("my_work");
  });

  test("encodes Team board navigation as route search state", () => {
    expect(getDashboardSearchForPanel({ kind: "team", teamId: "team-1" })).toEqual({
      work: "team",
      teamId: "team-1",
    });

    expect(getDashboardPanelFromSearch({ work: "team", teamId: "team-1" })).toEqual({
      kind: "team",
      teamId: "team-1",
    });
  });

  test("preserves temporary execution filters while switching execution routes", () => {
    expect(
      getDashboardSearchForPanel(
        { kind: "team", teamId: "team-1" },
        { work: "our_work", taskState: "in_progress", workflowStatusId: "status-1" },
      ),
    ).toEqual({
      work: "team",
      teamId: "team-1",
      taskState: "in_progress",
      workflowStatusId: "status-1",
    });

    expect(
      getDashboardSearchForPanel("our_work", {
        work: "team",
        teamId: "team-1",
        taskState: "done",
        workflowStatusId: "team-status",
      }),
    ).toEqual({
      work: "our_work",
      taskState: "done",
      workflowStatusId: "team-status",
    });
  });

  test("falls back to My Work for incomplete Team board search state", () => {
    expect(getDashboardPanelFromSearch({ work: "team" })).toBe("my_work");
  });

  test("encodes temporary execution filters as route search state", () => {
    expect(
      getDashboardSearchForExecutionFilters(
        { work: "our_work" },
        { taskState: "in_progress", workflowStatusId: "status-1" },
      ),
    ).toEqual({
      work: "our_work",
      taskState: "in_progress",
      workflowStatusId: "status-1",
    });

    expect(
      getDashboardSearchForExecutionFilters(
        { work: "our_work", taskState: "done", workflowStatusId: "status-1" },
        {},
      ),
    ).toEqual({ work: "our_work", taskState: undefined, workflowStatusId: undefined });
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
