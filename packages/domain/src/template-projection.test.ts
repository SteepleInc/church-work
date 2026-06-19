import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { TemplateScheduleRule, TemplateTaskPlacement } from "./template-projection";

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
});
