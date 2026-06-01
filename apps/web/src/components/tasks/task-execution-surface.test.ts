import { describe, expect, test } from "bun:test";

import {
  getTaskCreationDefaults,
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

  test("builds trimmed Task title update fields only for changed titles", () => {
    expect(getTaskTitleUpdateFields("Call volunteer", " Call leader ")).toEqual({
      title: "Call leader",
    });
    expect(getTaskTitleUpdateFields("Call volunteer", " Call volunteer ")).toBeNull();
    expect(getTaskTitleUpdateFields("Call volunteer", "   ")).toBeNull();
  });
});
