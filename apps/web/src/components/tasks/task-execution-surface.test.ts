import { describe, expect, test } from "bun:test";

import {
  getTaskCreationDefaults,
  getExecutionWorkflowId,
  getTaskExecutionReadArgs,
  getTaskParentContext,
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
        cycleId: "cycle-1",
      }),
    ).toEqual({
      churchId: "church-1",
      actorUserId: "user-1",
      teamId: "team-1",
      cycleId: "cycle-1",
    });
  });

  test("does not broaden execution reads when no current Cycle is available", () => {
    expect(
      getTaskExecutionReadArgs({
        churchId: "church-1",
        currentUserId: "user-1",
        surface: "my_work",
        cycleId: null,
      }),
    ).toBeNull();
  });

  test("resolves visible Subtask parent context for board cards", () => {
    const parentTask = {
      id: "parent-task",
      title: "Prepare service",
      teamId: null,
      assignedUserId: null,
      cycleId: "cycle-1",
      dueDate: "2026-06-03",
      parentTaskId: null,
      workflowStatusId: "todo",
      taskState: "todo" as const,
    };
    const childTask = {
      id: "child-task",
      title: "Print handouts",
      teamId: null,
      assignedUserId: "user-1",
      cycleId: "cycle-1",
      dueDate: "2026-06-03",
      parentTaskId: parentTask.id,
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
});
