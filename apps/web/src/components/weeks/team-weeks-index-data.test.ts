import { describe, expect, test } from "bun:test";

import {
  buildTeamWeekBurndown,
  buildProjectedWeekCycles,
  buildTeamWeeksIndexRows,
  buildTeamWeeksTimelineRows,
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

  test("orders timeline rows newest-first and assigns chronological ordinals", () => {
    const rows = buildTeamWeeksTimelineRows({
      cycles,
      tasks: [],
      teamId: "team-care",
      teamIdentifier: "care",
      today: "2026-06-10",
    });

    // Furthest-out Week sits on top (descending start date), like Linear.
    expect(rows.map((row) => [row.id, row.ordinal])).toEqual([
      ["future-empty", 3],
      ["current", 2],
      ["past", 1],
    ]);
  });

  test("projects future Weeks from date math when no Cycle rows exist", () => {
    const projected = buildProjectedWeekCycles({
      churchTimeZone: "America/New_York",
      cycles: [{ id: "current", startDate: "2026-06-08", endDate: "2026-06-14", name: null }],
      futureWeeks: 2,
      pastWeeks: 0,
      today: "2026-06-10",
    });

    expect(
      projected.map((cycle) => [cycle.id, cycle.startDate, cycle.endDate, cycle.projected]),
    ).toEqual([
      ["current", "2026-06-08", "2026-06-14", undefined],
      ["projected-week:2026-06-15", "2026-06-15", "2026-06-21", true],
      ["projected-week:2026-06-22", "2026-06-22", "2026-06-28", true],
    ]);
    expect(projected[1]?.targetCycle).toMatchObject({
      churchTimeZone: "America/New_York",
      startDate: "2026-06-15",
      endDate: "2026-06-21",
    });
  });

  test("ignores uncycled Tasks when counting Week rows", () => {
    const rows = buildTeamWeeksIndexRows({
      churchTimeZone: "UTC",
      cycles: [{ id: "current", startDate: "2026-06-08", endDate: "2026-06-14", name: null }],
      tasks: [
        { id: "planned", cycleId: "current", teamId: "team-care", taskState: "todo" },
        { id: "inbox", cycleId: null, teamId: "team-care", taskState: "todo" },
      ],
      teamId: "team-care",
      teamIdentifier: "care",
      today: "2026-06-10",
    });

    expect(rows[0]?.taskCount).toBe(1);
  });
});

describe("Week burndown series", () => {
  test("builds a 7-point series with flat scope/started/completed and a countdown ideal", () => {
    const burndown = buildTeamWeekBurndown({
      scope: 10,
      started: 6,
      completed: 3,
      startLabel: "Jun 8",
      endLabel: "Jun 14",
    });

    expect(burndown.points).toHaveLength(7);
    expect(burndown.startedPercentage).toBe(60);
    expect(burndown.completedPercentage).toBe(30);
    expect(burndown.points[0]?.ideal).toBe(10);
    expect(burndown.points[6]?.ideal).toBe(0);
    expect(burndown.axisLabels).toEqual(["Jun 8", "Jun 14"]);
  });

  test("treats an empty Week as zero progress without dividing by zero", () => {
    const burndown = buildTeamWeekBurndown({
      scope: 0,
      started: 0,
      completed: 0,
      startLabel: "Jun 8",
      endLabel: "Jun 14",
    });

    expect(burndown.startedPercentage).toBe(0);
    expect(burndown.completedPercentage).toBe(0);
  });
});
