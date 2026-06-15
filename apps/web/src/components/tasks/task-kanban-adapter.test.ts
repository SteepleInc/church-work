import { describe, expect, test } from "bun:test";

import {
  buildTaskBoardColumns,
  buildTaskBoardGroupColumns,
  computeBoardMoves,
  groupTasksByWorkflowStatus,
  groupWorkflowStatusesByIdentity,
  isTaskBoardGroupingDraggable,
  moveTaskBetweenGroupColumns,
  workflowStatusGroupKey,
  type TaskBoardColumnMove,
  type TaskBoardTask,
} from "./task-kanban-adapter";

function boardTask(overrides: Partial<TaskBoardTask> & { readonly id: string }): TaskBoardTask {
  return {
    title: `Task ${overrides.id}`,
    identifier: `TST-${overrides.id}`,
    workflowId: "workflow-1",
    workflowStatusId: "todo",
    taskState: "todo",
    teamId: "team-1",
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

  test("groups same-identity Workflow Statuses across Teams' Workflows", () => {
    // Every Team owns its Workflow (ADR 0013): "To Do" repeats per Team with a
    // distinct id. Same (Task State, name) collapses; differing Task State does
    // not. Order follows first appearance.
    const groups = groupWorkflowStatusesByIdentity([
      { id: "todo-w1", name: "To Do", taskState: "todo" },
      { id: "doing-w1", name: "In Progress", taskState: "in_progress" },
      { id: "todo-w2", name: "To Do", taskState: "todo" },
      { id: "review-w2", name: "To Do", taskState: "in_progress" },
    ]);

    expect(groups).toEqual([
      {
        key: workflowStatusGroupKey("todo", "To Do"),
        name: "To Do",
        taskState: "todo",
        ids: ["todo-w1", "todo-w2"],
      },
      {
        key: workflowStatusGroupKey("in_progress", "In Progress"),
        name: "In Progress",
        taskState: "in_progress",
        ids: ["doing-w1"],
      },
      {
        key: workflowStatusGroupKey("in_progress", "To Do"),
        name: "To Do",
        taskState: "in_progress",
        ids: ["review-w2"],
      },
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

  test("uses the drop event destination when the preview layout still has stale task fields", () => {
    const moves = computeBoardMoves({
      columns: {
        todo: [],
        doing: [
          boardTask({
            id: "task-1",
            workflowStatusId: "todo",
            taskState: "todo",
            boardOrder: "a3",
          }),
        ],
      },
      activeTaskId: "task-1",
      destinationColumnId: "doing",
    });

    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ taskId: "task-1", workflowStatusId: "doing" });
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

describe("Board Column grouping", () => {
  const tasks: readonly TaskBoardTask[] = [
    {
      id: "task-1",
      identifier: "PRO-1",
      title: "Call volunteer",
      workflowId: "workflow-1",
      workflowStatusId: "todo",
      taskState: "todo",
      assignedUserId: "user-1",
      teamId: "team-1",
    },
    {
      id: "task-2",
      identifier: "KID-1",
      title: "Prepare slides",
      workflowId: "workflow-2",
      workflowStatusId: "doing",
      taskState: "in_progress",
      assignedUserId: null,
      teamId: "team-2",
    },
  ];
  const assignees = [
    { id: "user-1", label: "Ana" },
    { id: "user-2", label: "Ben" },
  ];
  const teams = [
    { id: "team-1", name: "Production" },
    { id: "team-2", name: "Kids" },
  ];

  test("groups by assignee with an Unassigned lane", () => {
    const columns = buildTaskBoardGroupColumns({
      grouping: "assignee",
      workflowStatuses: [],
      assignees,
      teams,
      tasks,
      showEmptyColumns: true,
    });

    expect(columns.map((column) => column.id)).toEqual(["unassigned", "user-1", "user-2"]);
    expect(columns.map((column) => column.title)).toEqual(["Unassigned", "Ana", "Ben"]);
  });

  test("groups by team with one lane per Team", () => {
    const columns = buildTaskBoardGroupColumns({
      grouping: "team",
      workflowStatuses: [],
      assignees,
      teams,
      tasks,
      showEmptyColumns: true,
    });

    expect(columns.map((column) => column.title)).toEqual(["Production", "Kids"]);
  });

  test("groups by Task State without a Canceled lane", () => {
    const columns = buildTaskBoardGroupColumns({
      grouping: "task_state",
      workflowStatuses: [],
      assignees,
      teams,
      tasks,
      showEmptyColumns: true,
    });

    expect(columns.map((column) => column.id)).toEqual(["todo", "in_progress", "done"]);
  });

  test("never renders a Canceled Board Column when grouping by Workflow Status", () => {
    const columns = buildTaskBoardGroupColumns({
      grouping: "workflow_status",
      workflowStatuses: [
        { id: "todo", name: "To Do", sortOrder: 1, taskState: "todo" },
        { id: "done", name: "Done", sortOrder: 2, taskState: "done" },
        { id: "canceled", name: "Canceled", sortOrder: 3, taskState: "canceled" },
      ],
      assignees,
      teams,
      tasks,
      showEmptyColumns: true,
    });

    expect(columns.map((column) => column.id)).toEqual(["todo", "done"]);
  });

  test("hides empty Board Columns when View Options say so", () => {
    const columns = buildTaskBoardGroupColumns({
      grouping: "assignee",
      workflowStatuses: [],
      assignees,
      teams,
      tasks,
      showEmptyColumns: false,
    });

    expect(columns.map((column) => column.id)).toEqual(["unassigned", "user-1"]);
  });

  test("drag is enabled for Workflow Status, Assignee, and Task State groupings", () => {
    expect(isTaskBoardGroupingDraggable("workflow_status")).toBe(true);
    expect(isTaskBoardGroupingDraggable("assignee")).toBe(true);
    expect(isTaskBoardGroupingDraggable("task_state")).toBe(true);
    expect(isTaskBoardGroupingDraggable("team")).toBe(false);
  });

  test("dragging between assignee lanes reassigns the Task", () => {
    const persistedMoves: TaskBoardColumnMove[] = [];

    const nextColumns = moveTaskBetweenGroupColumns({
      grouping: "assignee",
      columns: {
        "user-1": [
          {
            id: "task-1",
            identifier: "PRO-1",
            title: "Call volunteer",
            workflowId: "workflow-1",
            workflowStatusId: "todo",
            taskState: "todo",
            assignedUserId: "user-1",
            teamId: "team-1",
          },
        ],
        unassigned: [],
      },
      taskId: "task-1",
      destinationColumnId: "unassigned",
      destinationIndex: 0,
      persistMove: (move) => {
        persistedMoves.push(move);
      },
    });

    expect(persistedMoves).toEqual([{ taskId: "task-1", columnId: "unassigned" }]);
    expect(nextColumns.unassigned[0]).toEqual({
      id: "task-1",
      identifier: "PRO-1",
      title: "Call volunteer",
      workflowId: "workflow-1",
      workflowStatusId: "todo",
      taskState: "todo",
      assignedUserId: null,
      teamId: "team-1",
    });
  });
});
