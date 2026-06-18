import { describe, expect, test } from "bun:test";

import { getWeekDisplayName } from "./cyclesData.app";

const now = new Date(2026, 5, 18);

describe("Week display names", () => {
  test("uses a friendly date range when a Week has no custom name", () => {
    expect(
      getWeekDisplayName({ endDate: "2026-04-05", name: null, startDate: "2026-03-30" }, now),
    ).toBe("Mar 30 – Apr 5");
  });

  test("collapses the month when the Week stays within one month", () => {
    expect(
      getWeekDisplayName({ endDate: "2026-06-21", name: null, startDate: "2026-06-15" }, now),
    ).toBe("Jun 15 – 21");
  });

  test("shows the year when the Week falls outside the current year", () => {
    expect(
      getWeekDisplayName({ endDate: "2027-01-03", name: null, startDate: "2026-12-28" }, now),
    ).toBe("Dec 28, 2026 – Jan 3, 2027");
  });

  test("uses the custom Church-wide Week name when present", () => {
    expect(
      getWeekDisplayName(
        {
          endDate: "2026-04-05",
          name: "Easter follow-up Week",
          startDate: "2026-03-30",
        },
        now,
      ),
    ).toBe("Easter follow-up Week");
  });
});
