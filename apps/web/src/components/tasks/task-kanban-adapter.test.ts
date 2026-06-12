import { describe, expect, test } from "bun:test";

import {
  buildTaskBoardColumns,
  computeBoardMoves,
  groupTasksByWorkflowStatus,
  type TaskBoardTask,
} from "./task-kanban-adapter";

function boardTask(overrides: Partial<TaskBoardTask> & { readonly id: string }): TaskBoardTask {
  return {
    title: `Task ${overrides.id}`,
    workflowStatusId: "todo",
    taskState: "todo",
    ...overrides,
  };
}

describe("Task Kanban adapter", () => {
  test("derives active non-canceled columns from Workflow Statuses", () => {
    const columns = buildTaskBoardColumns([
      { id: "done", name: "Done", sortOrder: 3, taskState: "done" },
      { id: "canceled", name: "Canceled", sortOrder: 4, taskState: "canceled" },
      { id: "todo", name: "To Do", sortOrder: 1, taskState: "todo" },
      {
        id: "archived",
        name: "Archived",
        sortOrder: 2,
        taskState: "in_progress",
        archivedAt: "now",
      },
    ]);

    expect(columns).toEqual([
      { id: "todo", title: "To Do", taskState: "todo" },
      { id: "done", title: "Done", taskState: "done" },
    ]);
  });

  test("renders Task cards in their persisted Workflow Status columns", () => {
    const columns = buildTaskBoardColumns([
      { id: "todo", name: "To Do", sortOrder: 1, taskState: "todo" },
      { id: "doing", name: "Doing", sortOrder: 2, taskState: "in_progress" },
    ]);

    const grouped = groupTasksByWorkflowStatus(columns, [
      boardTask({ id: "task-1", workflowStatusId: "doing", taskState: "in_progress" }),
      boardTask({ id: "task-2", workflowStatusId: "todo" }),
      boardTask({ id: "task-3", workflowStatusId: "old" }),
    ]);

    expect(grouped.todo.map((task) => task.id)).toEqual(["task-2"]);
    expect(grouped.doing.map((task) => task.id)).toEqual(["task-1"]);
  });

  test("orders cards within a column by their Board Order keys", () => {
    const columns = buildTaskBoardColumns([
      { id: "todo", name: "To Do", sortOrder: 1, taskState: "todo" },
    ]);

    const grouped = groupTasksByWorkflowStatus(columns, [
      boardTask({ id: "task-middle", boardOrder: "a1" }),
      boardTask({ id: "task-last-unkeyed", createdAt: 2 }),
      boardTask({ id: "task-first", boardOrder: "a0" }),
      boardTask({ id: "task-older-unkeyed", createdAt: 1 }),
    ]);

    expect(grouped.todo.map((task) => task.id)).toEqual([
      "task-first",
      "task-middle",
      "task-older-unkeyed",
      "task-last-unkeyed",
    ]);
  });

  test("preserves card assignee and due date when grouping Tasks into columns", () => {
    const columns = buildTaskBoardColumns([
      { id: "todo", name: "To Do", sortOrder: 1, taskState: "todo" },
    ]);

    const task = boardTask({
      id: "task-1",
      assignedUserId: "user-1",
      dueDate: "2026-06-30",
    });

    expect(groupTasksByWorkflowStatus(columns, [task])).toEqual({ todo: [task] });
  });

  test("a dropped card persists its destination column and a key between its neighbors", () => {
    // Preview layout at drop time: task-1 already sits between task-2 and
    // task-3 in the "doing" column (dnd-kit live-sorts during the drag).
    const moves = computeBoardMoves({
      columns: {
        todo: [],
        doing: [
          boardTask({ id: "task-2", workflowStatusId: "doing", boardOrder: "a0" }),
          boardTask({ id: "task-1", workflowStatusId: "todo", boardOrder: "a3" }),
          boardTask({ id: "task-3", workflowStatusId: "doing", boardOrder: "a1" }),
        ],
      },
      activeTaskId: "task-1",
    });

    expect(moves).toHaveLength(1);
    expect(moves[0].taskId).toBe("task-1");
    expect(moves[0].workflowStatusId).toBe("doing");
    expect(moves[0].boardOrder > "a0").toBe(true);
    expect(moves[0].boardOrder < "a1").toBe(true);
  });

  test("a card dropped at the end of a column appends after the last key", () => {
    const moves = computeBoardMoves({
      columns: {
        todo: [
          boardTask({ id: "task-2", boardOrder: "a0" }),
          boardTask({ id: "task-1", boardOrder: "Zz" }),
        ],
      },
      activeTaskId: "task-1",
    });

    expect(moves).toHaveLength(1);
    expect(moves[0].boardOrder > "a0").toBe(true);
  });

  test("dragging a selected card moves the whole selection in visual order", () => {
    // task-1 (selected, dragged) was dropped into "doing"; task-4 (selected)
    // is still in "todo". Both should land contiguously at task-1's slot.
    const moves = computeBoardMoves({
      columns: {
        todo: [boardTask({ id: "task-4", boardOrder: "a9" })],
        doing: [
          boardTask({ id: "task-2", workflowStatusId: "doing", boardOrder: "a0" }),
          boardTask({ id: "task-1", boardOrder: "a5" }),
          boardTask({ id: "task-3", workflowStatusId: "doing", boardOrder: "a1" }),
        ],
      },
      activeTaskId: "task-1",
      selectedTaskIds: new Set(["task-1", "task-4"]),
    });

    expect(moves.map((move) => move.taskId)).toEqual(["task-4", "task-1"]);
    expect(moves.every((move) => move.workflowStatusId === "doing")).toBe(true);
    const [firstKey, secondKey] = moves.map((move) => move.boardOrder);
    expect(firstKey > "a0").toBe(true);
    expect(firstKey < secondKey).toBe(true);
    expect(secondKey < "a1").toBe(true);
  });

  test("group drags skip canceled Tasks", () => {
    const moves = computeBoardMoves({
      columns: {
        todo: [
          boardTask({ id: "task-1", boardOrder: "a0" }),
          boardTask({ id: "task-canceled", taskState: "canceled", boardOrder: "a1" }),
        ],
      },
      activeTaskId: "task-1",
      selectedTaskIds: new Set(["task-1", "task-canceled"]),
    });

    expect(moves.map((move) => move.taskId)).toEqual(["task-1"]);
  });

  test("returns no moves when the dragged Task is not on the board", () => {
    expect(
      computeBoardMoves({
        columns: { todo: [] },
        activeTaskId: "missing",
      }),
    ).toEqual([]);
  });
});
