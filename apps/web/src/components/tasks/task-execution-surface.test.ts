import { describe, expect, test } from "bun:test";

import {
  buildTeamMemberIndex,
  getDefaultCreateTaskTeamId,
  getTaskCreationDefaults,
  getExecutionBoardGrouping,
  getTaskExecutionFilters,
  getTaskExecutionReadArgs,
  getTaskGroupAddPreset,
  getTaskParentContext,
  getTaskTabFilters,
  resolveExecutionCycleScope,
  selectCurrentExecutionCycle,
} from "./task-execution-surface-utils";

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

  test("resolves Team Week shortcuts while leaving Team Tasks unscoped", () => {
    const cycles = [
      { id: "previous", startDate: "2026-05-25", endDate: "2026-05-31" },
      { id: "current", startDate: "2026-06-01", endDate: "2026-06-07" },
      { id: "upcoming", startDate: "2026-06-08", endDate: "2026-06-14" },
    ];

    expect(
      resolveExecutionCycleScope({
        surface: "team_board",
        week: undefined,
        cycles,
        today: "2026-06-03",
      }),
    ).toBeNull();
    expect(
      resolveExecutionCycleScope({
        surface: "team_board",
        week: "current",
        cycles,
        today: "2026-06-03",
      })?.id,
    ).toBe("current");
    expect(
      resolveExecutionCycleScope({
        surface: "team_board",
        week: "upcoming",
        cycles,
        today: "2026-06-03",
      })?.id,
    ).toBe("upcoming");
  });

  test("resolves Team Week detail boards by explicit Week id", () => {
    const cycles = [
      { id: "previous", startDate: "2026-05-25", endDate: "2026-05-31" },
      { id: "current", startDate: "2026-06-01", endDate: "2026-06-07" },
    ];

    expect(
      resolveExecutionCycleScope({
        surface: "team_board",
        weekCycleId: "previous",
        cycles,
        today: "2026-06-03",
      })?.id,
    ).toBe("previous");
  });

  test("resolves Team Week detail boards by chronological Week number (oldest = 1)", () => {
    const cycles = [
      { id: "current", startDate: "2026-06-01", endDate: "2026-06-07" },
      { id: "previous", startDate: "2026-05-25", endDate: "2026-05-31" },
      { id: "next", startDate: "2026-06-08", endDate: "2026-06-14" },
    ];

    expect(
      resolveExecutionCycleScope({
        surface: "team_board",
        weekNumber: 1,
        cycles,
        today: "2026-06-03",
      })?.id,
    ).toBe("previous");
    expect(
      resolveExecutionCycleScope({
        surface: "team_board",
        weekNumber: 3,
        cycles,
        today: "2026-06-03",
      })?.id,
    ).toBe("next");
    // Out-of-range Week numbers resolve to no Week rather than throwing.
    expect(
      resolveExecutionCycleScope({
        surface: "team_board",
        weekNumber: 99,
        cycles,
        today: "2026-06-03",
      }),
    ).toBeNull();
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

  describe("default create-task Team chain (ADR 0013)", () => {
    const teams = [
      { id: "team-b", sortOrder: 2 },
      { id: "team-a", sortOrder: 1 },
      { id: "team-c", sortOrder: 3 },
    ];

    test("a surface preset wins over everything", () => {
      expect(
        getDefaultCreateTaskTeamId({
          presetTeamId: "team-c",
          lastUsedTeamId: "team-b",
          currentUserId: "user-1",
          teams,
          memberships: [{ teamId: "team-a", userId: "user-1" }],
        }),
      ).toBe("team-c");
    });

    test("falls back to the last-used Team when no preset", () => {
      expect(
        getDefaultCreateTaskTeamId({
          lastUsedTeamId: "team-b",
          currentUserId: "user-1",
          teams,
          memberships: [{ teamId: "team-a", userId: "user-1" }],
        }),
      ).toBe("team-b");
    });

    test("ignores stale presets and last-used Teams that no longer exist", () => {
      expect(
        getDefaultCreateTaskTeamId({
          presetTeamId: "team-gone",
          lastUsedTeamId: "team-also-gone",
          currentUserId: "user-1",
          teams,
          memberships: [{ teamId: "team-b", userId: "user-1" }],
        }),
      ).toBe("team-b");
    });

    test("falls back to the user's first Team Membership by Team order", () => {
      expect(
        getDefaultCreateTaskTeamId({
          currentUserId: "user-1",
          teams,
          memberships: [
            { teamId: "team-c", userId: "user-1" },
            { teamId: "team-b", userId: "user-1" },
            { teamId: "team-a", userId: "user-2" },
          ],
        }),
      ).toBe("team-b");
    });

    test("falls back to the Church's first Team when the user has no memberships", () => {
      expect(
        getDefaultCreateTaskTeamId({
          currentUserId: "user-1",
          teams,
          memberships: [],
        }),
      ).toBe("team-a");
    });

    test("returns null only when the Church has no Teams", () => {
      expect(
        getDefaultCreateTaskTeamId({
          currentUserId: "user-1",
          teams: [],
          memberships: [],
        }),
      ).toBeNull();
    });
  });

  test("groups cross-team boards by Task State and Team Boards by Workflow Status (ADR 0013)", () => {
    expect(getExecutionBoardGrouping("my_work", "workflow_status")).toBe("task_state");
    expect(getExecutionBoardGrouping("our_work", "workflow_status")).toBe("task_state");
    expect(getExecutionBoardGrouping("team_board", "workflow_status")).toBe("workflow_status");
    // Non-status groupings are untouched everywhere.
    expect(getExecutionBoardGrouping("my_work", "assignee")).toBe("assignee");
    expect(getExecutionBoardGrouping("team_board", "team")).toBe("team");
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
        cycleId: "cycle-1",
      }),
    ).toEqual({
      churchId: "church-1",
      actorUserId: "user-1",
      teamId: "team-1",
      cycleId: "cycle-1",
    });
  });

  test("does not require a current Cycle before reading Tasks", () => {
    expect(
      getTaskExecutionReadArgs({
        churchId: "church-1",
        currentUserId: "user-1",
        surface: "my_work",
        cycleId: null,
      }),
    ).toEqual({
      churchId: "church-1",
      actorUserId: "user-1",
      surface: "my_work",
    });
  });

  test("resolves visible Subtask parent context for board cards", () => {
    const parentTask = {
      id: "parent-task",
      identifier: "PRO-1",
      title: "Prepare service",
      teamId: "team-1",
      assignedUserId: null,
      cycleId: "cycle-1",
      dueDate: "2026-06-03",
      createdAt: 0,
      parentTaskId: null,
      workflowId: "workflow-1",
      workflowStatusId: "todo",
      taskState: "todo" as const,
    };
    const childTask = {
      id: "child-task",
      identifier: "PRO-2",
      title: "Print handouts",
      teamId: "team-1",
      assignedUserId: "user-1",
      cycleId: "cycle-1",
      dueDate: "2026-06-03",
      createdAt: 0,
      parentTaskId: parentTask.id,
      workflowId: "workflow-1",
      workflowStatusId: "todo",
      taskState: "todo" as const,
    };

    expect(getTaskParentContext(childTask, [parentTask, childTask])).toEqual({
      id: parentTask.id,
      title: parentTask.title,
    });
    expect(getTaskParentContext(childTask, [childTask])).toBeNull();
    expect(getTaskParentContext(parentTask, [parentTask, childTask])).toBeNull();
  });

  test("compiles View Tabs into server-side filters", () => {
    expect(getTaskTabFilters({ surface: "my_work", tab: undefined, currentUserId: "u-1" })).toEqual(
      { surface: "my_work" },
    );
    expect(
      getTaskTabFilters({ surface: "my_work", tab: "assigned", currentUserId: "u-1" }),
    ).toEqual({ surface: "my_work" });
    expect(getTaskTabFilters({ surface: "my_work", tab: "created", currentUserId: "u-1" })).toEqual(
      { createdByUserId: "u-1" },
    );

    // Active is the default Our Work / Team tab.
    expect(
      getTaskTabFilters({ surface: "our_work", tab: undefined, currentUserId: "u-1" }),
    ).toEqual({ surface: "our_work", taskStates: ["todo", "in_progress"] });
    expect(getTaskTabFilters({ surface: "our_work", tab: "all", currentUserId: "u-1" })).toEqual({
      surface: "our_work",
    });
    expect(getTaskTabFilters({ surface: "team_board", tab: "done", currentUserId: "u-1" })).toEqual(
      { taskStates: ["done", "canceled"] },
    );
  });

  test("ignores a View Tab that belongs to a different surface", () => {
    expect(
      getTaskTabFilters({ surface: "team_board", tab: "created", currentUserId: "u-1" }),
    ).toEqual({ taskStates: ["todo", "in_progress"] });
  });

  test("compiles View Options that are filters/ordering into the query args", () => {
    expect(
      getTaskExecutionFilters({
        surface: "team_board",
        teamId: "team-1",
        cycleId: "cycle-1",
        currentUserId: "u-1",
        tab: "all",
        showSubtasks: false,
        ordering: "due_date",
      }),
    ).toEqual({
      teamId: "team-1",
      cycleId: "cycle-1",
      excludeSubtasks: true,
      orderBy: "due_date",
    });

    // Defaults add nothing beyond the tab and Cycle scope.
    expect(
      getTaskExecutionFilters({
        surface: "my_work",
        cycleId: "cycle-1",
        currentUserId: "u-1",
        tab: "assigned",
        showSubtasks: true,
        ordering: "created",
      }),
    ).toEqual({ surface: "my_work", cycleId: "cycle-1" });

    expect(
      getTaskExecutionFilters({
        surface: "our_work",
        cycleId: null,
        currentUserId: "u-1",
        tab: "all",
        showSubtasks: true,
        ordering: "created",
      }),
    ).toEqual({ surface: "our_work" });
  });

  test("indexes team members by team id for the assignee picker", () => {
    const index = buildTeamMemberIndex([
      { teamId: "team-a", userId: "u-1" },
      { teamId: "team-a", userId: "u-2" },
      { teamId: "team-b", userId: "u-3" },
    ]);

    expect([...(index.get("team-a") ?? [])]).toEqual(["u-1", "u-2"]);
    expect([...(index.get("team-b") ?? [])]).toEqual(["u-3"]);
    expect(index.get("team-missing")).toBeUndefined();
  });

  // The List group header and the Board column share this "+" preset (the
  // grouped field for that group is pre-filled in the create dialog).
  describe("group header add-task preset", () => {
    const defaults = { assignedUserId: "u-1", teamId: "team-1" };
    const preset = (grouping: string, columnId: string) =>
      getTaskGroupAddPreset({
        grouping,
        columnId,
        defaults,
        unassignedColumnId: "unassigned",
      });

    test("Workflow Status grouping presets the dropped status and keeps surface defaults", () => {
      expect(preset("workflow_status", "status-2")).toEqual({
        assignTo: "u-1",
        teamId: "team-1",
        workflowStatusId: "status-2",
      });
    });

    test("Assignee grouping presets the column's user as the assignee", () => {
      expect(preset("assignee", "u-9")).toEqual({ assignTo: "u-9", teamId: "team-1" });
    });

    test("Assignee grouping's Unassigned column clears the assignee", () => {
      expect(preset("assignee", "unassigned")).toEqual({ assignTo: null, teamId: "team-1" });
    });

    test("Team grouping presets the column's Team", () => {
      expect(preset("team", "team-9")).toEqual({ assignTo: "u-1", teamId: "team-9" });
    });

    test("Task State grouping has no create-dialog field and falls back to defaults", () => {
      expect(preset("task_state", "in_progress")).toEqual({ assignTo: "u-1", teamId: "team-1" });
    });

    test("Estimate grouping has no create-dialog field and falls back to defaults", () => {
      expect(preset("estimate", "m")).toEqual({ assignTo: "u-1", teamId: "team-1" });
    });
  });
});
