import { describe, expect, test } from "bun:test";

import type { FilterItem } from "@/components/data-table-filter/core/types";
import {
  buildTaskFilterFields,
  taskFiltersToCollectionFilters,
  UNASSIGNED_FILTER_VALUE,
} from "@/components/tasks/task-filters";

const users = [
  { id: "user-1", label: "Ada" },
  { id: "user-2", label: "Linus" },
];
const teams = [
  { id: "team-1", name: "Production" },
  { id: "team-2", name: "Kids" },
];
const statuses = [
  { id: "status-1", name: "To Do", taskState: "todo" as const },
  { id: "status-2", name: "Done", taskState: "done" as const },
];

function fieldIds(fields: ReturnType<typeof buildTaskFilterFields>) {
  return fields.map((field) => field.id);
}

describe("task filter field catalog (per-surface)", () => {
  test("our_work shows all five backend-backed fields", () => {
    const fields = buildTaskFilterFields({
      surface: "our_work",
      tab: "all",
      users,
      teams,
      workflowStatuses: statuses,
    });
    expect(fieldIds(fields)).toEqual([
      "assignee",
      "creator",
      "team",
      "workflowStatus",
      "taskState",
    ]);
  });

  test("team_board hides Team (already pinned)", () => {
    const fields = buildTaskFilterFields({
      surface: "team_board",
      users,
      teams,
      workflowStatuses: statuses,
    });
    expect(fieldIds(fields)).not.toContain("team");
  });

  test("my_work Assigned tab hides Assignee; Created tab hides Creator", () => {
    const assigned = buildTaskFilterFields({
      surface: "my_work",
      tab: "assigned",
      users,
      teams,
      workflowStatuses: statuses,
    });
    expect(fieldIds(assigned)).not.toContain("assignee");
    expect(fieldIds(assigned)).toContain("creator");

    const created = buildTaskFilterFields({
      surface: "my_work",
      tab: "created",
      users,
      teams,
      workflowStatuses: statuses,
    });
    expect(fieldIds(created)).not.toContain("creator");
    expect(fieldIds(created)).toContain("assignee");
  });

  test("assignee options lead with Unassigned", () => {
    const fields = buildTaskFilterFields({
      surface: "our_work",
      users,
      teams,
      workflowStatuses: statuses,
    });
    const assignee = fields.find((field) => field.id === "assignee");
    expect(assignee?.options?.[0]?.value).toBe(UNASSIGNED_FILTER_VALUE);
  });
});

describe("taskFiltersToCollectionFilters", () => {
  test("include operators map to *In; exclude operators map to *NotIn", () => {
    const filters: FilterItem[] = [
      { columnId: "team", operator: "is any of", type: "option", values: ["team-1", "team-2"] },
      { columnId: "workflowStatus", operator: "is none of", type: "option", values: ["status-2"] },
    ];
    expect(taskFiltersToCollectionFilters(filters)).toEqual({
      teamIdIn: ["team-1", "team-2"],
      workflowStatusIdNotIn: ["status-2"],
    });
  });

  test("Unassigned value maps to null for assignee/creator", () => {
    const filters: FilterItem[] = [
      {
        columnId: "assignee",
        operator: "is any of",
        type: "option",
        values: [UNASSIGNED_FILTER_VALUE, "user-1"],
      },
    ];
    expect(taskFiltersToCollectionFilters(filters)).toEqual({
      assignedUserIdIn: [null, "user-1"],
    });
  });

  test("value-less filters never reach the query", () => {
    const filters: FilterItem[] = [
      { columnId: "team", operator: "is any of", type: "option", values: [] },
    ];
    expect(taskFiltersToCollectionFilters(filters)).toEqual({});
  });

  test("only valid task states pass through", () => {
    const filters: FilterItem[] = [
      {
        columnId: "taskState",
        operator: "is any of",
        type: "option",
        values: ["todo", "bogus", "done"],
      },
    ];
    expect(taskFiltersToCollectionFilters(filters)).toEqual({
      taskStateIn: ["todo", "done"],
    });
  });
});
