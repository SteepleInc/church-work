import { describe, expect, test } from "bun:test";

import {
  buildSubTaskTree,
  computeSubTaskCompletion,
  type SubTaskNode,
  type SubTaskNodeInput,
} from "@/features/details-pane/sub-task-tree";

const make = (
  over: Partial<SubTaskNodeInput> & Pick<SubTaskNodeInput, "id">,
): SubTaskNodeInput => ({
  parentTaskId: null,
  title: over.id,
  createdAt: 0,
  taskState: "todo",
  priority: null,
  assignedUserId: null,
  estimate: null,
  dueDate: null,
  workflowStatusSortOrder: 0,
  ...over,
});

const ids = (nodes: readonly SubTaskNode[]): string[] =>
  nodes.flatMap((node) => [node.task.id, ...ids(node.children)]);

describe("buildSubTaskTree", () => {
  const tasks = [
    make({ id: "parent" }),
    make({ id: "a", parentTaskId: "parent", priority: "low", createdAt: 1 }),
    make({ id: "b", parentTaskId: "parent", priority: "urgent", createdAt: 2 }),
    make({ id: "a1", parentTaskId: "a", createdAt: 3 }),
  ];

  test("nested off returns only direct children", () => {
    const tree = buildSubTaskTree({
      parentId: "parent",
      tasks,
      nested: false,
      ordering: "created",
      completedFilter: "all",
    });
    expect(ids(tree)).toEqual(["a", "b"]);
  });

  test("nested on returns descendants recursively", () => {
    const tree = buildSubTaskTree({
      parentId: "parent",
      tasks,
      nested: true,
      ordering: "created",
      completedFilter: "all",
    });
    expect(ids(tree)).toEqual(["a", "a1", "b"]);
  });

  test("priority ordering sorts urgent before low, no-priority last", () => {
    const tree = buildSubTaskTree({
      parentId: "parent",
      tasks: [
        make({ id: "parent" }),
        make({ id: "none", parentTaskId: "parent", priority: null, createdAt: 1 }),
        make({ id: "low", parentTaskId: "parent", priority: "low", createdAt: 2 }),
        make({ id: "urgent", parentTaskId: "parent", priority: "urgent", createdAt: 3 }),
      ],
      nested: false,
      ordering: "priority",
      completedFilter: "all",
    });
    expect(tree.map((node) => node.task.id)).toEqual(["urgent", "low", "none"]);
  });

  test("hide completed keeps a completed ancestor as context for visible children", () => {
    const tree = buildSubTaskTree({
      parentId: "parent",
      tasks: [
        make({ id: "parent" }),
        make({ id: "doneParent", parentTaskId: "parent", taskState: "done" }),
        make({ id: "activeChild", parentTaskId: "doneParent", taskState: "todo" }),
      ],
      nested: true,
      ordering: "created",
      completedFilter: "hide_completed",
    });
    expect(ids(tree)).toEqual(["doneParent", "activeChild"]);
    expect(tree[0]?.isContext).toBe(true);
  });

  test("hide completed drops a completed leaf entirely", () => {
    const tree = buildSubTaskTree({
      parentId: "parent",
      tasks: [
        make({ id: "parent" }),
        make({ id: "doneLeaf", parentTaskId: "parent", taskState: "done" }),
      ],
      nested: true,
      ordering: "created",
      completedFilter: "hide_completed",
    });
    expect(ids(tree)).toEqual([]);
  });
});

describe("computeSubTaskCompletion", () => {
  const tasks = [
    make({ id: "parent" }),
    make({ id: "a", parentTaskId: "parent", taskState: "done" }),
    make({ id: "b", parentTaskId: "parent", taskState: "todo" }),
    make({ id: "a1", parentTaskId: "a", taskState: "done" }),
  ];

  test("direct only when not nested", () => {
    expect(computeSubTaskCompletion({ parentId: "parent", tasks, nested: false })).toEqual({
      completed: 1,
      total: 2,
    });
  });

  test("recursive when nested", () => {
    expect(computeSubTaskCompletion({ parentId: "parent", tasks, nested: true })).toEqual({
      completed: 2,
      total: 3,
    });
  });
});
