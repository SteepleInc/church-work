import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AssigneeAvatar,
  formatCreatedAt,
  getPriorityMeta,
  getSizeMeta,
  partitionAssignees,
  priorityRows,
  sizeValues,
  statusRows,
  PRIORITY_OPTIONS,
  SIZE_OPTIONS,
  WorkflowStatusIcon,
  type AssigneeOption,
  type CardSelectOption,
  type TaskPriority,
  type TaskSize,
} from "./task-card-fields";
import type { TaskBoardTaskState } from "./task-kanban-adapter";

describe("Task card priority field (stub)", () => {
  test("offers the Linear priority levels in display order", () => {
    expect(PRIORITY_OPTIONS.map((option) => option.value)).toEqual([
      "no_priority",
      "urgent",
      "high",
      "medium",
      "low",
    ]);
    expect(PRIORITY_OPTIONS.map((option) => option.label)).toEqual([
      "No priority",
      "Urgent",
      "High",
      "Medium",
      "Low",
    ]);
  });

  test("resolves metadata for each priority and falls back to No priority", () => {
    expect(getPriorityMeta("urgent").label).toBe("Urgent");
    expect(getPriorityMeta("medium").label).toBe("Medium");
    expect(getPriorityMeta("nonsense" as TaskPriority).value).toBe("no_priority");
  });

  test("highlights Urgent with the warning accent color", () => {
    expect(getPriorityMeta("urgent").className).toBe("text-orange-500");
    expect(getPriorityMeta("high").className).toBeUndefined();
  });

  test("pairs each priority with its digit shortcut in display order", () => {
    expect(priorityRows()).toEqual([
      { value: "no_priority", shortcut: "0" },
      { value: "urgent", shortcut: "1" },
      { value: "high", shortcut: "2" },
      { value: "medium", shortcut: "3" },
      { value: "low", shortcut: "4" },
    ]);
  });
});

describe("Task card size field (stub)", () => {
  test("offers the Linear estimate sizes in display order", () => {
    expect(SIZE_OPTIONS.map((option) => option.value)).toEqual([
      "no_estimate",
      "xs",
      "s",
      "m",
      "l",
      "xl",
    ]);
  });

  test("resolves a short badge label for sized estimates and none for no estimate", () => {
    expect(getSizeMeta("m").short).toBe("M");
    expect(getSizeMeta("xl").short).toBe("XL");
    expect(getSizeMeta("no_estimate").short).toBeNull();
    expect(getSizeMeta("nonsense" as TaskSize).value).toBe("no_estimate");
  });

  test("lists the estimate values in display order for the picker", () => {
    expect(sizeValues()).toEqual(["no_estimate", "xs", "s", "m", "l", "xl"]);
  });
});

describe("Workflow status icon", () => {
  test("uses a distinct accent color per task state", () => {
    const colorFor = (taskState: TaskBoardTaskState) =>
      renderToStaticMarkup(<WorkflowStatusIcon taskState={taskState} />);

    expect(colorFor("todo")).toContain("text-muted-foreground");
    expect(colorFor("in_progress")).toContain("text-amber-500");
    expect(colorFor("done")).toContain("text-emerald-500");
    expect(colorFor("canceled")).toContain("text-muted-foreground");
  });
});

describe("Assignee avatar", () => {
  test("renders an unassigned placeholder when no assignee is selected", () => {
    const html = renderToStaticMarkup(<AssigneeAvatar assignee={null} />);

    expect(html).toContain("text-muted-foreground");
    expect(html).not.toContain('data-slot="avatar"');
  });

  test("renders a user avatar when an assignee is selected", () => {
    const html = renderToStaticMarkup(
      <AssigneeAvatar assignee={{ id: "user-1", label: "Ada Lovelace" }} />,
    );

    expect(html).toContain('data-slot="avatar"');
  });
});

describe("partitionAssignees", () => {
  const options: readonly AssigneeOption[] = [
    { id: "u-me", label: "Izak" },
    { id: "u-team1", label: "Team One" },
    { id: "u-team2", label: "Team Two" },
    { id: "u-other", label: "Other Person" },
  ];

  test("pins the current user above team and other members", () => {
    const partition = partitionAssignees({
      options,
      currentUserId: "u-me",
      teamMemberIds: new Set(["u-me", "u-team1", "u-team2"]),
    });

    expect(partition.pinned?.userId).toBe("u-me");
    expect(partition.teamMembers.map((row) => row.userId)).toEqual(["u-team1", "u-team2"]);
    expect(partition.otherMembers.map((row) => row.userId)).toEqual(["u-other"]);
  });

  test("assigns sequential shortcuts: 0 for No assignee, then display order", () => {
    const partition = partitionAssignees({
      options,
      currentUserId: "u-me",
      teamMemberIds: new Set(["u-team1", "u-team2"]),
    });

    expect(partition.noAssignee.shortcut).toBe("0");
    expect(partition.pinned?.shortcut).toBe("1");
    expect(partition.teamMembers.map((row) => row.shortcut)).toEqual(["2", "3"]);
    expect(partition.otherMembers.map((row) => row.shortcut)).toEqual(["4"]);
  });

  test("leaves pinned null when the current user is not in the options", () => {
    const partition = partitionAssignees({
      options,
      currentUserId: "u-absent",
      teamMemberIds: new Set(),
    });

    expect(partition.pinned).toBeNull();
    expect(partition.teamMembers).toEqual([]);
    expect(partition.otherMembers.map((row) => row.userId)).toEqual([
      "u-me",
      "u-team1",
      "u-team2",
      "u-other",
    ]);
  });

  test("stops assigning digit shortcuts past the tenth row", () => {
    const many: readonly AssigneeOption[] = Array.from({ length: 12 }, (_, index) => ({
      id: `u-${index}`,
      label: `User ${index}`,
    }));

    const partition = partitionAssignees({
      options: many,
      currentUserId: null,
      teamMemberIds: new Set(),
    });

    // Rows 1-9 get a digit; the 10th selectable person (index 9) and beyond do not.
    expect(partition.otherMembers[8]?.shortcut).toBe("9");
    expect(partition.otherMembers[9]?.shortcut).toBeNull();
    expect(partition.otherMembers[10]?.shortcut).toBeNull();
  });
});

describe("statusRows", () => {
  const options: readonly CardSelectOption<string>[] = Array.from({ length: 12 }, (_, index) => ({
    value: `s-${index}`,
    label: `Status ${index}`,
  }));

  test("numbers the first nine statuses 1-9 and the tenth 0", () => {
    const rows = statusRows(options);

    expect(rows.slice(0, 9).map((row) => row.shortcut)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
    ]);
    expect(rows[9]?.shortcut).toBe("0");
  });

  test("leaves statuses past the tenth without a shortcut", () => {
    const rows = statusRows(options);

    expect(rows[10]?.shortcut).toBeNull();
    expect(rows[11]?.shortcut).toBeNull();
  });

  test("preserves each option's value, label, and icon in display order", () => {
    const rows = statusRows([
      { value: "todo", label: "Backlog", icon: <span>icon</span> },
      { value: "doing", label: "In Progress" },
    ]);

    expect(rows.map((row) => row.value)).toEqual(["todo", "doing"]);
    expect(rows.map((row) => row.label)).toEqual(["Backlog", "In Progress"]);
    expect(rows[0]?.icon).toBeDefined();
    expect(rows[1]?.icon).toBeUndefined();
  });
});

describe("formatCreatedAt", () => {
  const now = new Date("2026-06-09T12:00:00Z");

  test("omits the year when the task was created in the current year", () => {
    const createdAt = new Date("2026-02-25T09:00:00Z").getTime();
    expect(formatCreatedAt(createdAt, now)).toBe("Feb 25");
  });

  test("includes the year when the task was created in a different year", () => {
    const createdAt = new Date("2025-12-31T09:00:00Z").getTime();
    expect(formatCreatedAt(createdAt, now)).toBe("Dec 31, 2025");
  });

  test("returns null for missing or invalid timestamps", () => {
    expect(formatCreatedAt(null, now)).toBeNull();
    expect(formatCreatedAt(undefined, now)).toBeNull();
    expect(formatCreatedAt(Number.NaN, now)).toBeNull();
  });
});
