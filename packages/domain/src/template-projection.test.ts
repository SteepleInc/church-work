import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type {
  TemplateScheduleContract,
  TemplateScheduleRule,
  TemplateTaskPlacement,
} from "./template-projection";
import { assertTemplateScheduleContract, mergeTemplateTaskProjection } from "./template-projection";

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
