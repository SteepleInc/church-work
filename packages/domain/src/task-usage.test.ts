import { describe, expect, test } from "bun:test";

import {
  isTaskCountedForUsage,
  isUserTaskCreationBlocked,
  shouldShowTaskUsage,
} from "./task-usage";

const now = new Date("2026-07-12T03:30:00Z");

describe("Free Plan Task Usage", () => {
  test.each([
    ["Week-less To Do", { taskState: "todo" }, true],
    ["Week-less In Progress", { taskState: "in_progress" }, false],
    ["past Week", { taskState: "done", cycleEndsAt: new Date("2026-07-11T04:00:00Z") }, false],
    [
      "current Church-local Week",
      { taskState: "done", cycleEndsAt: new Date("2026-07-13T04:00:00Z") },
      true,
    ],
    [
      "future Week",
      { taskState: "in_progress", cycleEndsAt: new Date("2026-07-20T04:00:00Z") },
      true,
    ],
    ["canceled", { taskState: "canceled", cycleEndsAt: new Date("2026-07-20T04:00:00Z") }, false],
    ["soft-deleted", { taskState: "todo", deletedAt: now }, false],
    [
      "deleted Week",
      { taskState: "todo", cycleEndsAt: new Date("2026-07-20T04:00:00Z"), cycleDeletedAt: now },
      false,
    ],
  ] as const)("counts %s correctly", (_name, task, expected) => {
    expect(isTaskCountedForUsage(task, now)).toBe(expected);
  });

  test.each([200, 201, 299, 300, 301])("applies thresholds at %i", (usage) => {
    expect(shouldShowTaskUsage({ usage, subscription: null })).toBe(usage > 200);
    expect(isUserTaskCreationBlocked({ usage, subscription: null })).toBe(usage >= 300);
  });

  test("Paid and payment-grace Churches remain unlimited", () => {
    expect(isUserTaskCreationBlocked({ usage: 500, subscription: { status: "active" } })).toBe(
      false,
    );
    expect(
      isUserTaskCreationBlocked({
        usage: 500,
        now,
        subscription: { status: "past_due", graceStartedAt: now },
      }),
    ).toBe(false);
  });
});
