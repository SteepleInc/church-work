import { describe, expect, test } from "bun:test";

import {
  describeActivity,
  formatActivityTime,
  type ActivityResolvers,
} from "./task-activity-feed-utils";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatActivityTime", () => {
  const now = new Date("2026-06-20T12:00:00.000Z").getTime();

  test("renders compact units like the Linear feed", () => {
    expect(formatActivityTime(now - 10 * 1000, now)).toBe("just now");
    expect(formatActivityTime(now - 5 * MINUTE, now)).toBe("5m ago");
    expect(formatActivityTime(now - 2 * HOUR, now)).toBe("2h ago");
    expect(formatActivityTime(now - 3 * DAY, now)).toBe("3d ago");
    expect(formatActivityTime(now - 10 * 7 * DAY, now)).toBe("10w ago");
    expect(formatActivityTime(now - 60 * DAY, now)).toBe("9w ago");
    expect(formatActivityTime(now - 100 * DAY, now)).toBe("3mo ago");
    expect(formatActivityTime(now - 2 * 365 * DAY, now)).toBe("2y ago");
  });

  test("never renders a future or zero unit", () => {
    expect(formatActivityTime(now + 5000, now)).toBe("just now");
    expect(formatActivityTime(now - 46 * 1000, now)).toBe("1m ago");
  });
});

const resolvers: ActivityResolvers = {
  label: (id) => (id === "label_worship" ? "Worship" : null),
  status: (id) => (id === "status_in_progress" ? "In Progress" : null),
  team: (id) => (id === "team_kids" ? "Kids" : null),
  user: (id) => (id === "user_ankit" ? "Ankit Varshney" : null),
};

describe("describeActivity", () => {
  test("renders task lifecycle lines", () => {
    expect(describeActivity("task.created", {}, resolvers)?.text).toBe("created this task");
    expect(describeActivity("task.completed", {}, resolvers)?.text).toBe("completed this task");
    expect(describeActivity("task.canceled", {}, resolvers)?.text).toBe("canceled this task");
    expect(describeActivity("task.reopened", {}, resolvers)?.text).toBe("reopened this task");
  });

  test("prefers live status names with from/to", () => {
    const line = describeActivity(
      "task.status_changed",
      {
        from: { id: "status_todo", label: "To Do" },
        to: { id: "status_in_progress", label: "Stale Name" },
      },
      resolvers,
    );
    // `to` resolves live to "In Progress" (snapshot "Stale Name" is overridden);
    // `from` falls back to its snapshot since it no longer resolves.
    expect(line?.text).toBe("moved this from To Do to In Progress");
    expect(line?.glyph).toBe("status");
  });

  test("falls back to the snapshot label when the record is gone", () => {
    const line = describeActivity(
      "task.status_changed",
      {
        from: { id: "status_gone", label: "Backlog" },
        to: { id: "status_also_gone", label: "Done" },
      },
      resolvers,
    );
    expect(line?.text).toBe("moved this from Backlog to Done");
  });

  test("renders assignee changes", () => {
    expect(
      describeActivity(
        "task.assignee_changed",
        { from: null, to: { id: "user_ankit", label: "Ankit Varshney" } },
        resolvers,
      )?.text,
    ).toBe("assigned this to Ankit Varshney");
    expect(
      describeActivity(
        "task.assignee_changed",
        { from: { id: "user_ankit", label: "Ankit Varshney" }, to: null },
        resolvers,
      )?.text,
    ).toBe("removed the assignee");
  });

  test("renders team, priority, estimate, due date, and title", () => {
    expect(
      describeActivity("task.team_changed", { to: { id: "team_kids", label: "Kids" } }, resolvers)
        ?.text,
    ).toBe("moved this to the Kids team");
    expect(
      describeActivity("task.priority_changed", { to: { value: "high", label: "high" } }, resolvers)
        ?.text,
    ).toBe("set the priority to High");
    expect(
      describeActivity("task.estimate_changed", { to: { value: "m", label: "m" } }, resolvers)
        ?.text,
    ).toBe("set the estimate to M");
    expect(
      describeActivity("task.due_date_changed", { to: { value: "2026-06-20" } }, resolvers)?.text,
    ).toBe("set the due date to 2026-06-20");
    expect(
      describeActivity("task.title_changed", { to: { value: "New title" } }, resolvers)?.text,
    ).toBe('renamed this task to "New title"');
  });

  test("renders label add/remove", () => {
    expect(
      describeActivity(
        "task.labels_changed",
        { added: [{ id: "label_worship", label: "Worship" }], removed: [] },
        resolvers,
      )?.text,
    ).toBe("added the Worship label");
    expect(
      describeActivity(
        "task.labels_changed",
        { added: [], removed: [{ id: "label_worship", label: "Worship" }] },
        resolvers,
      )?.text,
    ).toBe("removed the Worship label");
  });

  test("does not surface internal or unknown events", () => {
    expect(describeActivity("task.updated", { updated_fields: ["board_order"] }, resolvers)).toBe(
      null,
    );
    expect(describeActivity("team.created", {}, resolvers)).toBe(null);
  });
});
