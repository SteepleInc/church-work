import { describe, expect, test } from "bun:test";

import { buildInsightsData, insightsToCsv, type InsightsBucketMeta } from "./task-insights-data";
import type { TaskBoardTask, TaskBoardWorkflowStatus } from "./task-kanban-adapter";
import {
  DEFAULT_INSIGHTS_STATE,
  resolveInsightsState,
  toInsightsSearchValue,
} from "./task-insights-options";

const workflowStatuses: readonly TaskBoardWorkflowStatus[] = [
  { id: "todo", name: "To Do", sortOrder: 0, taskState: "todo" },
  { id: "doing", name: "In Progress", sortOrder: 1, taskState: "in_progress" },
  { id: "done", name: "Done", sortOrder: 2, taskState: "done" },
];

const meta: InsightsBucketMeta = {
  workflowStatuses,
  assignees: [
    { id: "u1", label: "Alice" },
    { id: "u2", label: "Bob" },
  ],
  teams: [
    { id: "t1", name: "Worship" },
    { id: "t2", name: "Kids" },
  ],
};

function task(partial: Partial<TaskBoardTask> & { readonly id: string }): TaskBoardTask {
  return {
    identifier: partial.id.toUpperCase(),
    title: partial.id,
    workflowId: "w1",
    workflowStatusId: "todo",
    taskState: "todo",
    teamId: "t1",
    ...partial,
  };
}

describe("Insights State", () => {
  test("absent URL state resolves to defaults", () => {
    expect(resolveInsightsState(undefined)).toEqual(DEFAULT_INSIGHTS_STATE);
    expect(resolveInsightsState({})).toEqual(DEFAULT_INSIGHTS_STATE);
  });

  test("a Segment equal to the Slice falls back to none", () => {
    expect(resolveInsightsState({ slice: "team", segment: "team" }).segment).toBe("none");
  });

  test("default-valued Insights State produces a clean URL", () => {
    expect(toInsightsSearchValue(DEFAULT_INSIGHTS_STATE)).toBeUndefined();
  });

  test("non-default fields survive the URL round-trip", () => {
    const next = { ...DEFAULT_INSIGHTS_STATE, open: true, slice: "team" as const };
    expect(toInsightsSearchValue(next)).toEqual({ open: true, slice: "team" });
  });
});

describe("Insights counting", () => {
  const tasks: readonly TaskBoardTask[] = [
    task({ id: "a", workflowStatusId: "todo", taskState: "todo", teamId: "t1" }),
    task({ id: "b", workflowStatusId: "todo", taskState: "todo", teamId: "t2" }),
    task({ id: "c", workflowStatusId: "doing", taskState: "in_progress", teamId: "t1" }),
  ];

  test("counts tasks per Slice bucket with no Segment", () => {
    const data = buildInsightsData({ slice: "workflow_status", segment: "none", tasks, meta });
    expect(data.total).toBe(3);
    expect(data.series).toEqual([]);
    const todo = data.slices.find((slice) => slice.label === "To Do");
    expect(todo?.total).toBe(2);
    expect(data.slices.find((slice) => slice.label === "In Progress")?.total).toBe(1);
    expect(data.slices.find((slice) => slice.label === "Done")?.total).toBe(0);
  });

  test("cross-tabs Slice by Segment with per-bar percentages", () => {
    const data = buildInsightsData({ slice: "workflow_status", segment: "team", tasks, meta });
    expect(data.series.map((entry) => entry.id)).toEqual(["t1", "t2"]);
    const todo = data.slices.find((slice) => slice.label === "To Do");
    expect(todo?.total).toBe(2);
    expect(todo?.segments.find((seg) => seg.id === "t1")?.count).toBe(1);
    expect(todo?.segments.find((seg) => seg.id === "t1")?.percentage).toBeCloseTo(50);
    expect(todo?.segments.find((seg) => seg.id === "t2")?.percentage).toBeCloseTo(50);
  });

  test("merges same-named Workflow Statuses across Teams' Workflows", () => {
    // Every Team owns its Workflow (ADR 0013): "To Do" exists once per Team with
    // a distinct id. Insights collapses them into a single bucket by name.
    const perTeamStatuses: readonly TaskBoardWorkflowStatus[] = [
      { id: "todo-w1", workflowId: "w1", name: "To Do", sortOrder: 0, taskState: "todo" },
      {
        id: "doing-w1",
        workflowId: "w1",
        name: "In Progress",
        sortOrder: 1,
        taskState: "in_progress",
      },
      { id: "todo-w2", workflowId: "w2", name: "To Do", sortOrder: 0, taskState: "todo" },
      {
        id: "doing-w2",
        workflowId: "w2",
        name: "In Progress",
        sortOrder: 1,
        taskState: "in_progress",
      },
    ];
    const perTeamTasks: readonly TaskBoardTask[] = [
      task({
        id: "a",
        workflowId: "w1",
        workflowStatusId: "todo-w1",
        taskState: "todo",
        teamId: "t1",
      }),
      task({
        id: "b",
        workflowId: "w2",
        workflowStatusId: "todo-w2",
        taskState: "todo",
        teamId: "t2",
      }),
      task({
        id: "c",
        workflowId: "w2",
        workflowStatusId: "doing-w2",
        taskState: "in_progress",
        teamId: "t2",
      }),
    ];
    const data = buildInsightsData({
      slice: "workflow_status",
      segment: "none",
      tasks: perTeamTasks,
      meta: { ...meta, workflowStatuses: perTeamStatuses },
    });

    expect(data.slices.filter((slice) => slice.label === "To Do")).toHaveLength(1);
    expect(data.slices.filter((slice) => slice.label === "In Progress")).toHaveLength(1);
    expect(data.slices.find((slice) => slice.label === "To Do")?.total).toBe(2);
    expect(data.slices.find((slice) => slice.label === "In Progress")?.total).toBe(1);
  });

  test("canceled tasks never form a Slice bucket", () => {
    const withCanceled: readonly TaskBoardTask[] = [
      ...tasks,
      task({ id: "x", taskState: "canceled", workflowStatusId: "todo" }),
    ];
    const data = buildInsightsData({
      slice: "task_state",
      segment: "none",
      tasks: withCanceled,
      meta,
    });
    expect(data.slices.some((slice) => slice.id === "canceled")).toBe(false);
  });

  test("an empty Slice bucket shows zero segment counts and zero percentages", () => {
    const data = buildInsightsData({ slice: "workflow_status", segment: "team", tasks, meta });
    const done = data.slices.find((slice) => slice.label === "Done");
    expect(done?.total).toBe(0);
    expect(done?.segments.every((segment) => segment.count === 0)).toBe(true);
    expect(done?.segments.every((segment) => segment.percentage === 0)).toBe(true);
  });

  test("an empty task set yields zero totals across all Slice buckets", () => {
    const data = buildInsightsData({ slice: "workflow_status", segment: "none", tasks: [], meta });
    expect(data.total).toBe(0);
    expect(data.slices.every((slice) => slice.total === 0)).toBe(true);
  });
});

describe("Insights CSV", () => {
  const tasks: readonly TaskBoardTask[] = [
    task({ id: "a", workflowStatusId: "todo", teamId: "t1" }),
    task({ id: "b", workflowStatusId: "todo", teamId: "t2" }),
    task({ id: "c", workflowStatusId: "doing", taskState: "in_progress", teamId: "t1" }),
  ];

  test("serializes the cross-tab with a header, count, and a column per Segment", () => {
    const data = buildInsightsData({ slice: "workflow_status", segment: "team", tasks, meta });
    const csv = insightsToCsv(data, "Workflow Status");
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Workflow Status,Task count,Worship,Kids");
    expect(lines).toContain("To Do,2,1,1");
    expect(lines).toContain("In Progress,1,1,0");
  });

  test("omits Segment columns when there is no Segment", () => {
    const data = buildInsightsData({ slice: "workflow_status", segment: "none", tasks, meta });
    const csv = insightsToCsv(data, "Workflow Status");
    expect(csv.split("\n")[0]).toBe("Workflow Status,Task count");
  });

  test("quotes cells containing commas", () => {
    const csv = insightsToCsv(
      buildInsightsData({
        slice: "team",
        segment: "none",
        tasks: [task({ id: "a", teamId: "t3" })],
        meta: { ...meta, teams: [{ id: "t3", name: "Kids, Youth" }] },
      }),
      "Team",
    );
    expect(csv).toContain('"Kids, Youth",1');
  });
});
