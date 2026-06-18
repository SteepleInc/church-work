import { describe, expect, test } from "bun:test";

import {
  buildTeamWeeksIndexRows,
  getTeamWeekRelativeLabel,
  groupTeamWeeksIndexRows,
} from "./team-weeks-index-data";

describe("Team Weeks index data", () => {
  const cycles = [
    { id: "past", startDate: "2026-06-01", endDate: "2026-06-07", name: null },
    { id: "current", startDate: "2026-06-08", endDate: "2026-06-14", name: "Serve Week" },
    { id: "future-empty", startDate: "2026-06-15", endDate: "2026-06-21", name: null },
  ] as const;

  test("lists generated Weeks even when the selected Team has zero Tasks", () => {
    const rows = buildTeamWeeksIndexRows({
      cycles,
      tasks: [
        { id: "task-1", cycleId: "current", teamId: "team-care", taskState: "done" },
        { id: "task-other-team", cycleId: "future-empty", teamId: "team-kids", taskState: "todo" },
      ],
      teamId: "team-care",
      teamIdentifier: "care",
      today: "2026-06-10",
    });

    expect(rows.map((row) => [row.id, row.status, row.taskCount, row.href])).toEqual([
      ["current", "current", 1, "/team/care/weeks/current"],
      ["future-empty", "upcoming", 0, "/team/care/weeks/future-empty"],
      ["past", "completed", 0, "/team/care/weeks/past"],
    ]);
  });

  test("derives completion percentage from a Team's scoped Tasks", () => {
    const rows = buildTeamWeeksIndexRows({
      cycles: [{ id: "current", startDate: "2026-06-08", endDate: "2026-06-14", name: null }],
      tasks: [
        { id: "a", cycleId: "current", teamId: "team-care", taskState: "done" },
        { id: "b", cycleId: "current", teamId: "team-care", taskState: "in_progress" },
        { id: "c", cycleId: "current", teamId: "team-care", taskState: "todo" },
        { id: "d", cycleId: "current", teamId: "team-care", taskState: "canceled" },
      ],
      teamId: "team-care",
      teamIdentifier: "care",
      today: "2026-06-10",
    });

    expect(rows[0]).toMatchObject({
      taskCount: 3,
      startedCount: 2,
      completedCount: 1,
      completedPercentage: 33,
    });
  });

  test("labels the immediate planning horizon relative to today", () => {
    expect(
      getTeamWeekRelativeLabel({ startDate: "2026-06-08", endDate: "2026-06-14" }, "2026-06-10"),
    ).toBe("This week");
    expect(
      getTeamWeekRelativeLabel({ startDate: "2026-06-15", endDate: "2026-06-21" }, "2026-06-10"),
    ).toBe("Next week");
    expect(
      getTeamWeekRelativeLabel({ startDate: "2026-06-01", endDate: "2026-06-07" }, "2026-06-10"),
    ).toBe("Last week");
    // A Week more than seven days out gets no relative cue.
    expect(
      getTeamWeekRelativeLabel({ startDate: "2026-06-22", endDate: "2026-06-28" }, "2026-06-10"),
    ).toBeNull();
  });

  test("groups rows into existing-status sections in lifecycle order", () => {
    const rows = buildTeamWeeksIndexRows({
      cycles,
      tasks: [],
      teamId: "team-care",
      teamIdentifier: "care",
      today: "2026-06-10",
    });
    const sections = groupTeamWeeksIndexRows(rows);

    expect(sections.map((section) => [section.status, section.rows.length])).toEqual([
      ["current", 1],
      ["upcoming", 1],
      ["completed", 1],
    ]);
  });
});
