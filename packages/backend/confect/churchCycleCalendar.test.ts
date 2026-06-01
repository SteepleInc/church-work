import { describe, it } from "@effect/vitest";
import { expect } from "vitest";

import {
  buildCycleForInstant,
  buildCycleForLocalDate,
  cycleStartDateForLocalDate,
  deriveCycleStatus,
  localDateForInstant,
} from "../churchCycleCalendar";

describe("Church Cycle calendar", () => {
  it("calculates Monday-to-Sunday local dates for multiple Church Time Zones", () => {
    expect(cycleStartDateForLocalDate("2026-05-31")).toBe("2026-05-25");

    expect(
      buildCycleForInstant({
        instant: "2026-06-01T04:30:00.000Z",
        churchTimeZone: "America/New_York",
      }),
    ).toMatchObject({
      startDate: "2026-06-01",
      endDate: "2026-06-07",
      churchTimeZone: "America/New_York",
    });

    expect(
      buildCycleForInstant({
        instant: "2026-06-01T04:30:00.000Z",
        churchTimeZone: "America/Los_Angeles",
      }),
    ).toMatchObject({
      startDate: "2026-05-25",
      endDate: "2026-05-31",
      churchTimeZone: "America/Los_Angeles",
    });
  });

  it("derives UTC start and end instants from the Church Time Zone", () => {
    expect(
      buildCycleForLocalDate({
        localDate: "2026-06-03",
        churchTimeZone: "America/New_York",
      }),
    ).toEqual({
      startDate: "2026-06-01",
      endDate: "2026-06-07",
      startsAt: "2026-06-01T04:00:00.000Z",
      endsAt: "2026-06-08T04:00:00.000Z",
      churchTimeZone: "America/New_York",
    });

    expect(
      buildCycleForLocalDate({
        localDate: "2026-06-03",
        churchTimeZone: "Asia/Tokyo",
      }),
    ).toEqual({
      startDate: "2026-06-01",
      endDate: "2026-06-07",
      startsAt: "2026-05-31T15:00:00.000Z",
      endsAt: "2026-06-07T15:00:00.000Z",
      churchTimeZone: "Asia/Tokyo",
    });
  });

  it("handles daylight saving boundary weeks", () => {
    expect(
      buildCycleForLocalDate({
        localDate: "2026-03-10",
        churchTimeZone: "America/New_York",
      }),
    ).toEqual({
      startDate: "2026-03-09",
      endDate: "2026-03-15",
      startsAt: "2026-03-09T04:00:00.000Z",
      endsAt: "2026-03-16T04:00:00.000Z",
      churchTimeZone: "America/New_York",
    });

    expect(
      buildCycleForLocalDate({
        localDate: "2026-11-03",
        churchTimeZone: "America/New_York",
      }),
    ).toEqual({
      startDate: "2026-11-02",
      endDate: "2026-11-08",
      startsAt: "2026-11-02T05:00:00.000Z",
      endsAt: "2026-11-09T05:00:00.000Z",
      churchTimeZone: "America/New_York",
    });
  });

  it("derives Cycle status from stored UTC instants and current time", () => {
    const cycle = buildCycleForLocalDate({
      localDate: "2026-06-03",
      churchTimeZone: "America/New_York",
    });

    expect(deriveCycleStatus({ cycle, now: "2026-06-01T03:59:59.999Z" })).toBe("future");
    expect(deriveCycleStatus({ cycle, now: "2026-06-01T04:00:00.000Z" })).toBe("current");
    expect(deriveCycleStatus({ cycle, now: "2026-06-08T03:59:59.999Z" })).toBe("current");
    expect(deriveCycleStatus({ cycle, now: "2026-06-08T04:00:00.000Z" })).toBe("past");
  });

  it("keeps an existing Cycle local identity stable when Church Time Zone changes later", () => {
    const originalCycle = buildCycleForLocalDate({
      localDate: "2026-06-03",
      churchTimeZone: "America/New_York",
    });
    const futureCycleAfterTimeZoneChange = buildCycleForLocalDate({
      localDate: "2026-06-03",
      churchTimeZone: "America/Los_Angeles",
    });

    expect(originalCycle.startDate).toBe("2026-06-01");
    expect(originalCycle.endDate).toBe("2026-06-07");
    expect(originalCycle.startsAt).toBe("2026-06-01T04:00:00.000Z");
    expect(futureCycleAfterTimeZoneChange.startsAt).toBe("2026-06-01T07:00:00.000Z");
    expect(deriveCycleStatus({ cycle: originalCycle, now: "2026-06-01T04:30:00.000Z" })).toBe(
      "current",
    );
  });

  it("validates Church Time Zone and local date inputs through the public calendar interface", () => {
    expect(() =>
      buildCycleForLocalDate({ localDate: "2026-06-03", churchTimeZone: "Not/A_Zone" }),
    ).toThrow("Church Time Zone must be a valid IANA time zone.");

    expect(() =>
      buildCycleForLocalDate({ localDate: "2026-02-30", churchTimeZone: "America/New_York" }),
    ).toThrow("Local date must be a real calendar date.");

    expect(() =>
      localDateForInstant({ instant: "not-an-instant", churchTimeZone: "America/New_York" }),
    ).toThrow("Instant must be a valid ISO date-time.");
  });
});
