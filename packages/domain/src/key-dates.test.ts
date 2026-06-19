import { describe, expect, test } from "vitest";

import {
  STARTER_KEY_DATES,
  calculateKeyDateOccurrence,
  isValidFixedYearlyDate,
  isValidLocalDate,
} from "./key-dates";

describe("Key Date occurrence calculation", () => {
  test("calculates built-in church and US holiday presets", () => {
    expect(calculateKeyDateOccurrence({ kind: "computedYearly", rule: "easter" }, 2026)).toBe(
      "2026-04-05",
    );
    expect(
      calculateKeyDateOccurrence({ kind: "computedYearly", rule: "ash_wednesday" }, 2026),
    ).toBe("2026-02-18");
    expect(calculateKeyDateOccurrence({ kind: "computedYearly", rule: "good_friday" }, 2026)).toBe(
      "2026-04-03",
    );
    expect(calculateKeyDateOccurrence({ kind: "computedYearly", rule: "palm_sunday" }, 2026)).toBe(
      "2026-03-29",
    );
    expect(calculateKeyDateOccurrence({ kind: "computedYearly", rule: "pentecost" }, 2026)).toBe(
      "2026-05-24",
    );
    expect(calculateKeyDateOccurrence({ kind: "computedYearly", rule: "mothers_day" }, 2026)).toBe(
      "2026-05-10",
    );
    expect(calculateKeyDateOccurrence({ kind: "computedYearly", rule: "fathers_day" }, 2026)).toBe(
      "2026-06-21",
    );
    expect(calculateKeyDateOccurrence({ kind: "computedYearly", rule: "thanksgiving" }, 2026)).toBe(
      "2026-11-26",
    );
  });

  test("supports fixed annual and one-off dates without materialized rows", () => {
    expect(calculateKeyDateOccurrence({ kind: "fixedYearly", month: 12, day: 25 }, 2027)).toBe(
      "2027-12-25",
    );
    expect(calculateKeyDateOccurrence({ kind: "oneTime", localDate: "2027-07-04" }, 2027)).toBe(
      "2027-07-04",
    );
    expect(
      calculateKeyDateOccurrence({ kind: "oneTime", localDate: "2027-07-04" }, 2028),
    ).toBeNull();
  });

  test("validates local date schedules before occurrence calculation", () => {
    expect(isValidLocalDate("2027-07-04")).toBe(true);
    expect(isValidLocalDate("2027-02-29")).toBe(false);
    expect(isValidFixedYearlyDate(2, 29)).toBe(true);
    expect(isValidFixedYearlyDate(2, 30)).toBe(false);
    expect(calculateKeyDateOccurrence({ kind: "fixedYearly", month: 2, day: 29 }, 2028)).toBe(
      "2028-02-29",
    );
    expect(calculateKeyDateOccurrence({ kind: "fixedYearly", month: 2, day: 29 }, 2027)).toBeNull();
    expect(calculateKeyDateOccurrence({ kind: "fixedYearly", month: 2, day: 30 }, 2027)).toBeNull();
  });

  test("defines US-centric Starter Key Dates", () => {
    expect(STARTER_KEY_DATES.map((date) => date.key)).toEqual([
      "easter",
      "good-friday",
      "palm-sunday",
      "ash-wednesday",
      "pentecost",
      "mothers-day",
      "fathers-day",
      "thanksgiving",
      "christmas",
    ]);
  });
});
