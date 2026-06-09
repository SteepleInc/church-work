import { describe, expect, test } from "bun:test";

import {
  buildTaskBoardColumns,
  groupTasksByWorkflowStatus,
  moveTaskBetweenBoardColumns,
  type TaskBoardMove,
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
