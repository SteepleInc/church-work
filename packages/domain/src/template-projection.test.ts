import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type {
  TemplateScheduleContract,
  TemplateScheduleRule,
  TemplateTaskPlacement,
} from "./template-projection";
import { assertTemplateScheduleContract } from "./template-projection";

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
