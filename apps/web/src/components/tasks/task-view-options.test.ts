import { describe, expect, test } from "bun:test";
import { Schema } from "effect";

import {
  ChurchWorkSearchSchema,
  DEFAULT_TASK_VIEW_OPTIONS,
  getDefaultTaskViewTab,
  getTaskViewTabs,
  MyWorkSearchSchema,
  resolveTaskViewOptions,
  resolveTaskViewTab,
  toTaskViewSearchValue,
} from "./task-view-options";

describe("View Options", () => {
  test("absent URL state resolves to the Saved View defaults", () => {
    expect(resolveTaskViewOptions(undefined)).toEqual(DEFAULT_TASK_VIEW_OPTIONS);
    expect(resolveTaskViewOptions({})).toEqual(DEFAULT_TASK_VIEW_OPTIONS);
  });

  test("partial URL state overrides only the fields it carries", () => {
    expect(resolveTaskViewOptions({ grouping: "assignee", showSubtasks: false })).toEqual({
      ...DEFAULT_TASK_VIEW_OPTIONS,
      grouping: "assignee",
      showSubtasks: false,
    });
  });

  test("default-valued View Options produce a clean URL", () => {
    expect(toTaskViewSearchValue(DEFAULT_TASK_VIEW_OPTIONS)).toBeUndefined();
  });

  test("only non-default View Options are written to the URL", () => {
    expect(
      toTaskViewSearchValue({
        ...DEFAULT_TASK_VIEW_OPTIONS,
        ordering: "due_date",
        showEmptyColumns: false,
      }),
    ).toEqual({ ordering: "due_date", showEmptyColumns: false });
  });

  test("View Options round-trip through the URL value", () => {
    const view = {
      ...DEFAULT_TASK_VIEW_OPTIONS,
      grouping: "team" as const,
      displayProperties: ["status", "id"] as const,
    };

    expect(resolveTaskViewOptions(toTaskViewSearchValue(view))).toEqual(view);
  });
});

describe("View Tabs", () => {
  test("My Work offers Assigned and Created; church surfaces offer All, Active, and Done", () => {
    expect(getTaskViewTabs("my_work").map((tab) => tab.value)).toEqual(["assigned", "created"]);
    expect(getTaskViewTabs("our_work").map((tab) => tab.value)).toEqual(["all", "active", "done"]);
    expect(getTaskViewTabs("team_board").map((tab) => tab.value)).toEqual([
      "all",
      "active",
      "done",
    ]);
  });

  test("defaults to Assigned on My Work and Active elsewhere", () => {
    expect(getDefaultTaskViewTab("my_work")).toBe("assigned");
    expect(getDefaultTaskViewTab("our_work")).toBe("active");
    expect(getDefaultTaskViewTab("team_board")).toBe("active");
  });

  test("a tab from another surface falls back to the default", () => {
    expect(resolveTaskViewTab("my_work", "active")).toBe("assigned");
    expect(resolveTaskViewTab("team_board", "created")).toBe("active");
    expect(resolveTaskViewTab("our_work", "done")).toBe("done");
  });
});

describe("task route search schemas", () => {
  const decodeMyWork = Schema.decodeUnknownSync(MyWorkSearchSchema);
  const decodeChurchWork = Schema.decodeUnknownSync(ChurchWorkSearchSchema);

  test("decodes valid tab and view state", () => {
    expect(decodeMyWork({ tab: "created", view: { grouping: "assignee" } })).toEqual({
      tab: "created",
      view: { grouping: "assignee" },
    });
    expect(decodeChurchWork({ tab: "done" })).toEqual({ tab: "done" });
  });

  test("malformed shared-link state degrades to defaults instead of erroring", () => {
    expect(decodeMyWork({ tab: "bogus", view: { grouping: "nope" } })).toEqual({
      tab: undefined,
      view: undefined,
    });
    // A My Work tab is not valid on church surfaces (retained params across
    // surface switches must not leak).
    expect(decodeChurchWork({ tab: "assigned" })).toEqual({ tab: undefined });
  });
});
