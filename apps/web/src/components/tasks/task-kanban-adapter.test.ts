import { describe, expect, test } from "bun:test";

import {
  buildTaskBoardColumns,
  buildTaskBoardGroupColumns,
  groupTasksByWorkflowStatus,
  isTaskBoardGroupingDraggable,
  moveTaskBetweenBoardColumns,
  moveTaskBetweenGroupColumns,
  type TaskBoardColumnMove,
  type TaskBoardMove,
  type TaskBoardTask,
} from "./task-kanban-adapter";

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

    expect(
      groupTasksByWorkflowStatus(columns, [
        {
          id: "task-1",
          title: "Call volunteer",
          workflowStatusId: "doing",
          taskState: "in_progress",
        },
        { id: "task-2", title: "Prepare slides", workflowStatusId: "todo", taskState: "todo" },
        { id: "task-3", title: "Hidden old status", workflowStatusId: "old", taskState: "todo" },
      ]),
    ).toEqual({
      todo: [
        { id: "task-2", title: "Prepare slides", workflowStatusId: "todo", taskState: "todo" },
      ],
      doing: [
        {
          id: "task-1",
          title: "Call volunteer",
          workflowStatusId: "doing",
          taskState: "in_progress",
        },
      ],
    });
  });

  test("preserves card assignee and due date when grouping Tasks into columns", () => {
    const columns = buildTaskBoardColumns([
      { id: "todo", name: "To Do", sortOrder: 1, taskState: "todo" },
    ]);

    expect(
      groupTasksByWorkflowStatus(columns, [
        {
          id: "task-1",
          title: "Prepare slides",
          workflowStatusId: "todo",
          taskState: "todo",
          assignedUserId: "user-1",
          dueDate: "2026-06-30",
        },
      ]),
    ).toEqual({
      todo: [
        {
          id: "task-1",
          title: "Prepare slides",
          workflowStatusId: "todo",
          taskState: "todo",
          assignedUserId: "user-1",
          dueDate: "2026-06-30",
        },
      ],
    });
  });

  test("keeps the card assignee when a Task is dragged to another column", () => {
    const nextColumns = moveTaskBetweenBoardColumns({
      columns: {
        todo: [
          {
            id: "task-1",
            title: "Call volunteer",
            workflowStatusId: "todo",
            taskState: "todo",
            assignedUserId: "user-1",
          },
        ],
        doing: [],
      },
      taskId: "task-1",
      destinationWorkflowStatusId: "doing",
      destinationIndex: 0,
      persistMove: () => {},
    });

    expect(nextColumns.doing[0]).toEqual({
      id: "task-1",
      title: "Call volunteer",
      workflowStatusId: "doing",
      taskState: "todo",
      assignedUserId: "user-1",
    });
  });

  test("dragging a Task between columns persists the destination Workflow Status", () => {
    const persistedMoves: TaskBoardMove[] = [];

    const nextColumns = moveTaskBetweenBoardColumns({
      columns: {
        todo: [
          { id: "task-1", title: "Call volunteer", workflowStatusId: "todo", taskState: "todo" },
        ],
        doing: [],
      },
      taskId: "task-1",
      destinationWorkflowStatusId: "doing",
      destinationIndex: 0,
      persistMove: (move) => {
        persistedMoves.push(move);
      },
    });

    expect(persistedMoves).toEqual([{ taskId: "task-1", workflowStatusId: "doing" }]);
    expect(nextColumns).toEqual({
      todo: [],
      doing: [
        { id: "task-1", title: "Call volunteer", workflowStatusId: "doing", taskState: "todo" },
      ],
    });
  });
});

describe("Board Column grouping", () => {
  const tasks: readonly TaskBoardTask[] = [
    {
      id: "task-1",
      title: "Call volunteer",
      workflowStatusId: "todo",
      taskState: "todo",
      assignedUserId: "user-1",
      teamId: "team-1",
    },
    {
      id: "task-2",
      title: "Prepare slides",
      workflowStatusId: "doing",
      taskState: "in_progress",
      assignedUserId: null,
      teamId: null,
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

  test("groups by team with a No Team lane", () => {
    const columns = buildTaskBoardGroupColumns({
      grouping: "team",
      workflowStatuses: [],
      assignees,
      teams,
      tasks,
      showEmptyColumns: true,
    });

    expect(columns.map((column) => column.title)).toEqual(["No Team", "Production", "Kids"]);
  });

  test("groups by Task State with the canonical lanes", () => {
    const columns = buildTaskBoardGroupColumns({
      grouping: "task_state",
      workflowStatuses: [],
      assignees,
      teams,
      tasks,
      showEmptyColumns: true,
    });

    expect(columns.map((column) => column.id)).toEqual(["todo", "in_progress", "done", "canceled"]);
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

  test("drag is enabled only for Workflow Status and Assignee groupings", () => {
    expect(isTaskBoardGroupingDraggable("workflow_status")).toBe(true);
    expect(isTaskBoardGroupingDraggable("assignee")).toBe(true);
    expect(isTaskBoardGroupingDraggable("task_state")).toBe(false);
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
            title: "Call volunteer",
            workflowStatusId: "todo",
            taskState: "todo",
            assignedUserId: "user-1",
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
      title: "Call volunteer",
      workflowStatusId: "todo",
      taskState: "todo",
      assignedUserId: null,
    });
  });
});
