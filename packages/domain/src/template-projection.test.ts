import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type {
  PeriodTemplatePlacementShape,
  TemplateScheduleContract,
  TemplateScheduleRule,
  TemplateTaskPlacement,
} from "./template-projection";
import {
  assertTemplateScheduleContract,
  buildPeriodPlacementFrame,
  defaultTemplateScheduleForPlacementShape,
  mergeTemplateTaskProjection,
  resolvePeriodPlacementDueDate,
} from "./template-projection";

describe("Template Schedule contracts", () => {
  test("represent v1 schedule kinds and Template Task placement", () => {
    const rules = [
      { kind: "weekly", weekdays: [6] },
      { kind: "keyDate", keyDateId: "keydate_easter", repeat: "none" },
      { kind: "keyDate", keyDateId: "keydate_christmas", repeat: "yearly" },
      { kind: "monthly", repeat: "monthly" },
      { kind: "quarterly", repeat: "quarterly" },
      { kind: "yearly", repeat: "none" },
      { kind: "yearly", repeat: "yearly" },
    ] satisfies readonly TemplateScheduleRule[];
    const placement = {
      cycleOffsetFromEnd: -2,
      weekday: 2,
    } satisfies TemplateTaskPlacement;

    assert.deepEqual(
      rules.map((rule) => rule.kind),
      ["weekly", "keyDate", "keyDate", "monthly", "quarterly", "yearly", "yearly"],
    );
    assert.deepEqual(placement, { cycleOffsetFromEnd: -2, weekday: 2 });
  });

  test("bind schedule kind, recurrence, and rule contracts", () => {
    const schedules = [
      {
        kind: "weekly",
        recurrence: "repeating",
        rule: { kind: "weekly", weekdays: [6] },
      },
      {
        kind: "keyDate",
        recurrence: "oneOff",
        rule: { kind: "keyDate", keyDateId: "keydate_easter", repeat: "none" },
      },
      {
        kind: "keyDate",
        recurrence: "repeating",
        rule: { kind: "keyDate", keyDateId: "keydate_christmas", repeat: "yearly" },
      },
      {
        kind: "monthly",
        recurrence: "repeating",
        rule: { kind: "monthly", repeat: "monthly" },
      },
      {
        kind: "quarterly",
        recurrence: "repeating",
        rule: { kind: "quarterly", repeat: "quarterly" },
      },
      {
        kind: "yearly",
        recurrence: "oneOff",
        rule: { kind: "yearly", repeat: "none" },
      },
      {
        kind: "yearly",
        recurrence: "repeating",
        rule: { kind: "yearly", repeat: "yearly" },
      },
    ] satisfies readonly TemplateScheduleContract[];

    assert.deepEqual(
      schedules.map(({ kind, recurrence, rule }) => [kind, recurrence, rule.kind]),
      [
        ["weekly", "repeating", "weekly"],
        ["keyDate", "oneOff", "keyDate"],
        ["keyDate", "repeating", "keyDate"],
        ["monthly", "repeating", "monthly"],
        ["quarterly", "repeating", "quarterly"],
        ["yearly", "oneOff", "yearly"],
        ["yearly", "repeating", "yearly"],
      ],
    );
  });

  test("reject mismatched schedule source contracts", () => {
    assert.doesNotThrow(() =>
      assertTemplateScheduleContract({
        kind: "weekly",
        recurrence: "repeating",
        rule: { kind: "weekly", weekdays: [6] },
      }),
    );

    assert.throws(
      () =>
        assertTemplateScheduleContract({
          kind: "weekly",
          recurrence: "repeating",
          rule: { kind: "monthly", repeat: "monthly" },
        }),
      /kind must match/u,
    );
    assert.throws(
      () =>
        assertTemplateScheduleContract({
          kind: "yearly",
          recurrence: "oneOff",
          rule: { kind: "yearly", repeat: "yearly" },
        }),
      /must not repeat/u,
    );
  });
});

describe("period Template Placement Shapes", () => {
  test("build normalized monthly, quarterly, and yearly Cycle frames", () => {
    const cases = [
      ["monthly", "2026-02-01", 5],
      ["quarterly", "2026-04-01", 13],
      ["yearly", "2026-01-01", 52],
    ] satisfies readonly [PeriodTemplatePlacementShape, string, number][];

    for (const [shape, periodStartLocalDate, expectedCycles] of cases) {
      const frame = buildPeriodPlacementFrame({ periodStartLocalDate, shape });

      assert.equal(frame.cycles.length, expectedCycles);
      assert.equal(frame.endCycleStartLocalDate, frame.cycles.at(-1)?.startLocalDate);
      assert.ok(frame.cycles.some((cycle) => cycle.days.some((day) => day.isPeriodBoundary)));
    }
  });

  test("keeps boundary-crossing Cycles visible while assigning ownership by majority days", () => {
    const frame = buildPeriodPlacementFrame({
      periodStartLocalDate: "2026-02-01",
      shape: "monthly",
    });

    assert.equal(frame.periodKey, "2026-02");
    assert.deepEqual(
      frame.cycles.map((cycle) => [
        cycle.startLocalDate,
        cycle.ownedPeriodKey,
        cycle.isInFocusPeriod,
      ]),
      [
        ["2026-01-26", "2026-01", false],
        ["2026-02-02", "2026-02", true],
        ["2026-02-09", "2026-02", true],
        ["2026-02-16", "2026-02", true],
        ["2026-02-23", "2026-02", true],
      ],
    );
    assert.deepEqual(
      frame.cycles[0]?.days.map((day) => [day.localDate, day.periodKey, day.isPeriodBoundary]),
      [
        ["2026-01-26", "2026-01", false],
        ["2026-01-27", "2026-01", false],
        ["2026-01-28", "2026-01", false],
        ["2026-01-29", "2026-01", false],
        ["2026-01-30", "2026-01", false],
        ["2026-01-31", "2026-01", false],
        ["2026-02-01", "2026-02", true],
      ],
    );
    assert.equal(frame.cycles[4]?.days.at(5)?.isPeriodBoundary, true);
  });

  test("normalizes variable month shapes from the real boundary Cycle", () => {
    const january = buildPeriodPlacementFrame({
      periodStartLocalDate: "2026-01-01",
      shape: "monthly",
    });
    const february = buildPeriodPlacementFrame({
      periodStartLocalDate: "2026-02-01",
      shape: "monthly",
    });

    assert.deepEqual(
      january.cycles.map((cycle) => cycle.startLocalDate),
      ["2025-12-29", "2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26"],
    );
    assert.deepEqual(
      february.cycles.map((cycle) => cycle.startLocalDate),
      ["2026-01-26", "2026-02-02", "2026-02-09", "2026-02-16", "2026-02-23"],
    );
    assert.equal(january.cycles.length, february.cycles.length);
  });

  test("maps period placements to real Cycle due dates", () => {
    const frame = buildPeriodPlacementFrame({
      periodStartLocalDate: "2026-04-01",
      shape: "quarterly",
    });

    assert.equal(
      resolvePeriodPlacementDueDate({
        endCycleStartLocalDate: frame.endCycleStartLocalDate,
        placement: { cycleOffsetFromEnd: -12, weekday: 1 },
      }),
      "2026-03-31",
    );
    assert.equal(
      resolvePeriodPlacementDueDate({
        endCycleStartLocalDate: frame.endCycleStartLocalDate,
        placement: { cycleOffsetFromEnd: 0, weekday: 0 },
      }),
      "2026-06-22",
    );
  });

  test("defaults monthly and quarterly to repeating and yearly to nearest one-off", () => {
    assert.deepEqual(defaultTemplateScheduleForPlacementShape("monthly"), {
      recurrence: "repeating",
      rule: { kind: "monthly", repeat: "monthly" },
    });
    assert.deepEqual(defaultTemplateScheduleForPlacementShape("quarterly"), {
      recurrence: "repeating",
      rule: { kind: "quarterly", repeat: "quarterly" },
    });
    assert.deepEqual(defaultTemplateScheduleForPlacementShape("yearly"), {
      recurrence: "oneOff",
      rule: { kind: "yearly", repeat: "none" },
    });
    assert.deepEqual(defaultTemplateScheduleForPlacementShape("yearly", { repeatYearly: true }), {
      recurrence: "repeating",
      rule: { kind: "yearly", repeat: "yearly" },
    });
  });
});

describe("Cycle Adjustment projection merge", () => {
  test("merges task-like planning fields into a projected Template Task", () => {
    const merged = mergeTemplateTaskProjection(
      {
        assignedUserId: "user_old",
        description: "Original notes",
        dueDate: "2026-06-10",
        estimate: "m",
        labelIds: ["label_old"],
        parentTemplateTaskId: null,
        teamId: "team_worship",
        templateTaskId: "templatetask_plan",
        templateTaskKey: "plan",
        title: "Plan setlist",
      },
      {
        lifecycle: "active",
        overrides: [
          { field: "title", value: "Plan updated setlist" },
          { field: "description", value: "Adjusted notes" },
          { field: "assignedUserId", value: "user_new" },
          { field: "teamId", value: "team_production" },
          { field: "dueDate", value: "2026-06-11" },
          { field: "labelIds", value: ["label_shared"] },
          { field: "estimate", value: "l" },
        ],
      },
    );

    assert.deepEqual(merged.effectiveTask, {
      assignedUserId: "user_new",
      description: "Adjusted notes",
      dueDate: "2026-06-11",
      estimate: "l",
      labelIds: ["label_shared"],
      parentTemplateTaskId: null,
      teamId: "team_production",
      templateTaskId: "templatetask_plan",
      templateTaskKey: "plan",
      title: "Plan updated setlist",
    });
  });
});
