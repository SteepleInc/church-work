import { describe, expect, test } from "bun:test";

import type { FilterItem } from "@/components/data-table-filter/core/types";
import {
  buildTaskFilterFields,
  mapTaskFilterValuesForZero,
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
const repeatedStatuses = [
  { id: "status-1", name: "To Do", taskState: "todo" as const },
  { id: "status-2", name: "To Do", taskState: "todo" as const },
  { id: "status-3", name: "In Progress", taskState: "in_progress" as const },
];

function fieldIds(fields: ReturnType<typeof buildTaskFilterFields>) {
  return fields.map((field) => field.id);
}

const cycles = [
  { id: "cycle-1", name: "Jun 15 – 21" },
  { id: "cycle-2", name: "Jun 22 – 28" },
];
const templates = [
  { id: "template-1", name: "Sunday Service" },
  { id: "template-2", name: "Guest Follow-up" },
];
const labels = [
  { id: "label-1", name: "Music", color: "blue" },
  { id: "label-2", name: "Tech", color: "emerald" },
];

describe("task filter field catalog (per-surface)", () => {
  test("our_work leads with the Status group then the people/scope fields", () => {
    const fields = buildTaskFilterFields({
      surface: "our_work",
      tab: "all",
      users,
      teams,
      workflowStatuses: statuses,
    });
    expect(fieldIds(fields)).toEqual(["workflowStatus", "priority", "assignee", "creator", "team"]);
  });

  test("Week, Label, and Template fields appear when their collections are non-empty", () => {
    const fields = buildTaskFilterFields({
      surface: "our_work",
      tab: "all",
      users,
      teams,
      workflowStatuses: statuses,
      cycles,
      templates,
      labels,
    });
    expect(fieldIds(fields)).toContain("cycle");
    expect(fieldIds(fields)).toContain("label");
    expect(fieldIds(fields)).toContain("template");
    expect(fields.find((field) => field.id === "cycle")?.displayName).toBe("Week");
  });

  test("Week, Label, and Template fields are omitted when their collections are empty", () => {
    const fields = buildTaskFilterFields({
      surface: "our_work",
      tab: "all",
      users,
      teams,
      workflowStatuses: statuses,
    });
    expect(fieldIds(fields)).not.toContain("cycle");
    expect(fieldIds(fields)).not.toContain("label");
    expect(fieldIds(fields)).not.toContain("template");
  });

  test("every field carries a leading type icon (Linear-style menu rows)", () => {
    const fields = buildTaskFilterFields({
      surface: "our_work",
      tab: "all",
      users,
      teams,
      workflowStatuses: statuses,
      cycles,
      templates,
      labels,
    });
    expect(fields.every((field) => field.icon !== undefined)).toBe(true);
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

  test("status options group repeated workflow statuses", () => {
    const fields = buildTaskFilterFields({
      surface: "our_work",
      users,
      teams,
      workflowStatuses: repeatedStatuses,
    });
    const status = fields.find((field) => field.id === "workflowStatus");
    expect(status?.options?.map((option) => option.label)).toEqual(["To Do", "In Progress"]);
  });
});

describe("mapTaskFilterValuesForZero", () => {
  test("Unassigned value maps to null for assignee/creator", () => {
    const filter: FilterItem = {
      columnId: "assignee",
      operator: "is any of",
      type: "option",
      values: [UNASSIGNED_FILTER_VALUE, "user-1"],
    };

    expect(mapTaskFilterValuesForZero(filter)).toEqual([null, "user-1"]);
  });

  test("generic filters keep their original values", () => {
    const filter: FilterItem = {
      columnId: "taskState",
      operator: "is any of",
      type: "option",
      values: ["todo", "done"],
    };

    expect(mapTaskFilterValuesForZero(filter)).toBeUndefined();
  });

  test("grouped workflow status values expand to all status ids", () => {
    const fields = buildTaskFilterFields({
      surface: "our_work",
      users,
      teams,
      workflowStatuses: repeatedStatuses,
    });
    const status = fields.find((field) => field.id === "workflowStatus");
    const groupedToDoValue = status?.options?.find((option) => option.label === "To Do")?.value;

    expect(groupedToDoValue).toBeDefined();
    expect(
      mapTaskFilterValuesForZero({
        columnId: "workflowStatus",
        operator: "is any of",
        type: "option",
        values: [groupedToDoValue ?? ""],
      }),
    ).toEqual(["status-1", "status-2"]);
  });
});
