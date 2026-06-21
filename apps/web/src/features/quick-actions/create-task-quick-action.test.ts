import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./create-task-quick-action.tsx", import.meta.url)).text();

describe("create task quick action", () => {
  test("reads the parent reference from the prefill state", () => {
    expect(source).toContain("readonly parentTaskLabel?:");
    expect(source).toContain("readonly identifier: string");
    expect(source).toContain("readonly title: string");
  });

  test("frames the dialog as a Subtask when opened from a comment with a parent", () => {
    // Title flips from "New Task" to "New Subtask" and the action button matches.
    expect(source).toContain('state?.parentTaskLabel ? "New Subtask" : "New Task"');
    expect(source).toContain('state?.parentTaskLabel ? "Create Subtask" : "Create Task"');
    // The parent breadcrumb pill mirrors the Details Pane lineage (Identifier + title).
    expect(source).toContain("<ParentTaskPill");
    expect(source).toContain("parentTaskLabel.identifier");
    expect(source).toContain("parentTaskLabel.title");
  });
});
