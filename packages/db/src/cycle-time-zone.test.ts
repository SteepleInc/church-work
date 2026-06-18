import { localMidnightToUtcInstant } from "@church-task/domain";
import { describe, expect, test } from "vitest";

import { buildCycleTimeZoneAdjustments } from "./cycle-time-zone";

const cycle = (id: string, startDate: string, churchTimeZone = "America/New_York") => ({
  id,
  church_time_zone: churchTimeZone,
  end_date: addDays(startDate, 6),
  ends_at: localMidnightToUtcInstant(addDays(startDate, 7), churchTimeZone),
  start_date: startDate,
  starts_at: localMidnightToUtcInstant(startDate, churchTimeZone),
});

const addDays = (localDate: string, days: number) => {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

describe("buildCycleTimeZoneAdjustments", () => {
  test("preserves past cycles, keeps current start, and recalculates current end plus future boundaries", () => {
    const now = new Date("2026-06-17T12:00:00.000Z");
    const past = cycle("past", "2026-06-08");
    const current = cycle("current", "2026-06-15");
    const future = cycle("future", "2026-06-22");

    const adjustments = buildCycleTimeZoneAdjustments({
      cycles: [past, current, future],
      newChurchTimeZone: "America/Los_Angeles",
      now,
    });

    expect(adjustments).toEqual([
      {
        church_time_zone: "America/Los_Angeles",
        end_date: "2026-06-21",
        ends_at: localMidnightToUtcInstant("2026-06-22", "America/Los_Angeles"),
        id: "current",
        start_date: "2026-06-15",
        starts_at: current.starts_at,
      },
      {
        church_time_zone: "America/Los_Angeles",
        end_date: "2026-06-28",
        ends_at: localMidnightToUtcInstant("2026-06-29", "America/Los_Angeles"),
        id: "future",
        start_date: "2026-06-22",
        starts_at: localMidnightToUtcInstant("2026-06-22", "America/Los_Angeles"),
      },
    ]);
  });

  test("does not produce updates when cycles already match the church time zone", () => {
    const now = new Date("2026-06-17T12:00:00.000Z");
    const current = cycle("current", "2026-06-15", "America/Los_Angeles");
    const future = cycle("future", "2026-06-22", "America/Los_Angeles");

    const adjustments = buildCycleTimeZoneAdjustments({
      cycles: [current, future],
      newChurchTimeZone: "America/Los_Angeles",
      now,
    });

    expect(adjustments).toEqual([]);
  });

  test("does not rewrite cycles when there is no active current cycle", () => {
    const adjustments = buildCycleTimeZoneAdjustments({
      cycles: [cycle("future", "2026-06-22")],
      newChurchTimeZone: "America/Los_Angeles",
      now: new Date("2026-06-17T12:00:00.000Z"),
    });

    expect(adjustments).toEqual([]);
  });

  test("keeps materialized future cycle identity stable so tasks remain assigned", () => {
    const future = cycle("future-cycle-id", "2026-06-22");

    const [adjustment] = buildCycleTimeZoneAdjustments({
      cycles: [cycle("current", "2026-06-15"), future],
      newChurchTimeZone: "America/Los_Angeles",
      now: new Date("2026-06-17T12:00:00.000Z"),
    }).filter((candidate) => candidate.id === future.id);

    expect(adjustment).toEqual({
      church_time_zone: "America/Los_Angeles",
      end_date: "2026-06-28",
      ends_at: localMidnightToUtcInstant("2026-06-29", "America/Los_Angeles"),
      id: future.id,
      start_date: future.start_date,
      starts_at: localMidnightToUtcInstant(future.start_date, "America/Los_Angeles"),
    });
  });

  test("limits timezone changes to cycle rows so task assignment and due date can remain stable", () => {
    const futureTask = {
      cycle_id: "future-cycle-id",
      due_date: "2026-07-04",
      id: "task-with-due-date-outside-shifted-cycle",
    };

    const adjustments = buildCycleTimeZoneAdjustments({
      cycles: [cycle("current", "2026-06-15"), cycle(futureTask.cycle_id, "2026-06-22")],
      newChurchTimeZone: "America/Los_Angeles",
      now: new Date("2026-06-17T12:00:00.000Z"),
    });

    expect(adjustments.map((adjustment) => adjustment.id)).toContain(futureTask.cycle_id);
    expect(Object.keys(adjustments[0] ?? {}).sort()).toEqual([
      "church_time_zone",
      "end_date",
      "ends_at",
      "id",
      "start_date",
      "starts_at",
    ]);
    expect(futureTask).toEqual({
      cycle_id: "future-cycle-id",
      due_date: "2026-07-04",
      id: "task-with-due-date-outside-shifted-cycle",
    });
  });
});
