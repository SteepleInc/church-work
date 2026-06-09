import { describe, expect, test } from "bun:test";

import {
  applyTaskTransition,
  applyTaskUpdate,
  workflowStatusStateLookup,
  type OptimisticTask,
} from "./tasksOptimistic";

const baseTask: OptimisticTask = {
  id: "task-1",
  assignedUserId: null,
  teamId: null,
  workflowStatusId: "status-todo",
  taskState: "todo",
  dueDate: "2026-01-01",
  cycleId: "cycle-1",
  parentTaskId: null,
};

const lookup = workflowStatusStateLookup([
  { id: "status-todo", taskState: "todo" },
  { id: "status-doing", taskState: "in_progress" },
  { id: "status-done", taskState: "done" },
]);

describe("applyTaskUpdate", () => {
  test("moves Task to a new Workflow Status and derives its Task state", () => {
    const next = applyTaskUpdate(baseTask, { workflowStatusId: "status-done" }, lookup);

    expect(next.workflowStatusId).toBe("status-done");
    expect(next.taskState).toBe("done");
  });

  test("keeps prior Task state when the new Workflow Status is unknown", () => {
    const next = applyTaskUpdate(baseTask, { workflowStatusId: "status-missing" }, lookup);

    expect(next.workflowStatusId).toBe("status-missing");
    expect(next.taskState).toBe("todo");
  });

  test("applies assignee changes without touching Workflow Status", () => {
    const next = applyTaskUpdate(baseTask, { assignedUserId: "user-9" }, lookup);

    expect(next.assignedUserId).toBe("user-9");
    expect(next.workflowStatusId).toBe("status-todo");
    expect(next.taskState).toBe("todo");
  });

  test("supports clearing the assignee to null", () => {
    const assigned = { ...baseTask, assignedUserId: "user-9" };
    const next = applyTaskUpdate(assigned, { assignedUserId: null }, lookup);

    expect(next.assignedUserId).toBeNull();
  });

  test("does not mutate the input Task", () => {
    applyTaskUpdate(baseTask, { workflowStatusId: "status-done" }, lookup);

    expect(baseTask.workflowStatusId).toBe("status-todo");
    expect(baseTask.taskState).toBe("todo");
  });

  test("ignores fields that are absent from the update", () => {
    const next = applyTaskUpdate(baseTask, {}, lookup);

    expect(next).toEqual(baseTask);
  });
});

describe("applyTaskTransition", () => {
  test("completing a Task marks it done", () => {
    expect(applyTaskTransition(baseTask, "complete").taskState).toBe("done");
  });

  test("cancelling a Task marks it canceled", () => {
    expect(applyTaskTransition(baseTask, "cancel").taskState).toBe("canceled");
  });

  test("reopening a Task returns it to todo", () => {
    const done: OptimisticTask = { ...baseTask, taskState: "done" };
    expect(applyTaskTransition(done, "reopen").taskState).toBe("todo");
  });

  test("returns the same reference when the state is unchanged", () => {
    expect(applyTaskTransition(baseTask, "reopen")).toBe(baseTask);
  });
});

describe("workflowStatusStateLookup", () => {
  test("resolves known statuses and returns undefined for unknown ones", () => {
    expect(lookup("status-doing")).toBe("in_progress");
    expect(lookup("status-missing")).toBeUndefined();
  });
});
