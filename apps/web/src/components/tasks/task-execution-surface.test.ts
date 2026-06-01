import { describe, expect, test } from "bun:test";

import {
  formatTaskActivity,
  getMyWorkEmptyStateActions,
  getTaskCreationDefaults,
  getExecutionWorkflowId,
  getTaskExecutionReadArgs,
  getTaskTeamUpdateFields,
  getTaskTitleUpdateFields,
  selectCurrentExecutionCycle,
} from "./task-execution-surface";

describe("Task execution surface", () => {
  test("selects the Cycle containing today for execution-window reads", () => {
    expect(
      selectCurrentExecutionCycle(
        [
          { id: "next", startDate: "2026-06-08", endDate: "2026-06-14" },
          { id: "current", startDate: "2026-06-01", endDate: "2026-06-07" },
        ],
        "2026-06-03",
      ),
    ).toEqual({ id: "current", startDate: "2026-06-01", endDate: "2026-06-07" });
  });

  test("defaults My Work Task creation to the current User", () => {
    expect(getTaskCreationDefaults({ surface: "my_work", currentUserId: "user-1" })).toEqual({
      assignedUserId: "user-1",
      teamId: null,
    });
  });

  test("does not force assignment when creating from Our Work", () => {
    expect(getTaskCreationDefaults({ surface: "our_work", currentUserId: "user-1" })).toEqual({
      assignedUserId: null,
      teamId: null,
    });
  });

  test("defaults Team board Task creation to the selected Team", () => {
    expect(
      getTaskCreationDefaults({
        surface: "team_board",
        currentUserId: "user-1",
        teamId: "team-1",
      }),
    ).toEqual({
      assignedUserId: null,
      teamId: "team-1",
    });
  });

  test("selects the effective Workflow for fixed execution surfaces", () => {
    expect(
      getExecutionWorkflowId({
        surface: "my_work",
        churchDefaultWorkflowId: "church-workflow",
        teamDefaultWorkflowId: "team-workflow",
      }),
    ).toBe("church-workflow");
    expect(
      getExecutionWorkflowId({
        surface: "our_work",
        churchDefaultWorkflowId: "church-workflow",
        teamDefaultWorkflowId: "team-workflow",
      }),
    ).toBe("church-workflow");
    expect(
      getExecutionWorkflowId({
        surface: "team_board",
        churchDefaultWorkflowId: "church-workflow",
        teamDefaultWorkflowId: "team-workflow",
      }),
    ).toBe("team-workflow");
  });

  test("builds the web execution read contract used to reflect backend Task changes", () => {
    expect(
      getTaskExecutionReadArgs({
        churchId: "church-1",
        currentUserId: "user-1",
        surface: "my_work",
        cycleId: "cycle-1",
      }),
    ).toEqual({
      churchId: "church-1",
      actorUserId: "user-1",
      surface: "my_work",
      cycleId: "cycle-1",
    });

    expect(
      getTaskExecutionReadArgs({
        churchId: "church-1",
        currentUserId: "user-1",
        surface: "our_work",
        cycleId: "cycle-1",
      }),
    ).toEqual({
      churchId: "church-1",
      actorUserId: "user-1",
      surface: "our_work",
      cycleId: "cycle-1",
    });

    expect(
      getTaskExecutionReadArgs({
        churchId: "church-1",
        currentUserId: "user-1",
        surface: "team_board",
        teamId: "team-1",
      }),
    ).toEqual({
      churchId: "church-1",
      actorUserId: "user-1",
      teamId: "team-1",
    });
  });

  test("builds actionable My Work empty-state navigation targets", () => {
    expect(
      getMyWorkEmptyStateActions([
        { id: "team-1", name: "Hospitality" },
        { id: "team-2", name: "Production" },
      ]),
    ).toEqual([
      { kind: "our_work", label: "Open Our Work" },
      { kind: "team_board", teamId: "team-1", label: "Hospitality" },
      { kind: "team_board", teamId: "team-2", label: "Production" },
    ]);
  });

  test("builds trimmed Task title update fields only for changed titles", () => {
    expect(getTaskTitleUpdateFields("Call volunteer", " Call leader ")).toEqual({
      title: "Call leader",
    });
    expect(getTaskTitleUpdateFields("Call volunteer", " Call volunteer ")).toBeNull();
    expect(getTaskTitleUpdateFields("Call volunteer", "   ")).toBeNull();
  });

  test("builds Team update fields for Team assignment, changes, and unassignment", () => {
    expect(getTaskTeamUpdateFields(null, "team-1")).toEqual({ teamId: "team-1" });
    expect(getTaskTeamUpdateFields("team-1", "team-2")).toEqual({ teamId: "team-2" });
    expect(getTaskTeamUpdateFields("team-1", "")).toEqual({ teamId: null });
    expect(getTaskTeamUpdateFields("team-1", "team-1")).toBeNull();
    expect(getTaskTeamUpdateFields(null, "")).toBeNull();
  });

  test("formats recent Task Activity for the execution surface", () => {
    expect(
      formatTaskActivity({
        id: "activity-1",
        eventType: "task.status_moved",
        actorType: "user",
        actorId: "user-1",
        occurredAt: "2026-06-01T12:00:00.000Z",
      }),
    ).toBe("status moved by User user-1");

    expect(
      formatTaskActivity({
        id: "activity-2",
        eventType: "task.completed",
        actorType: "system",
        actorId: null,
        occurredAt: "2026-06-01T12:01:00.000Z",
      }),
    ).toBe("completed by System");
  });
});
