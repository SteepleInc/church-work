import { describe, expect, test } from "bun:test";

import { matchPickerHotkey, statusOptions, toTaskIdentifier } from "./task-kanban-board";
import type { TaskBoardWorkflowStatus } from "./task-kanban-adapter";

type HotkeyEvent = Parameters<typeof matchPickerHotkey>[0];

function keyEvent(overrides: Partial<HotkeyEvent>): HotkeyEvent {
  return {
    key: "a",
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...overrides,
  };
}

describe("Task card identifier stub", () => {
  test("derives a short Linear-style identifier from the Task id", () => {
    expect(toTaskIdentifier("task_abcd1234")).toBe("TASK-1234");
    expect(toTaskIdentifier("k57-9f3b")).toBe("TASK-9F3B");
  });

  test("uppercases and pads from short ids without separators", () => {
    expect(toTaskIdentifier("ab")).toBe("TASK-AB");
  });
});

describe("Task card status selector options", () => {
  const statuses: readonly TaskBoardWorkflowStatus[] = [
    { id: "done", name: "Done", sortOrder: 3, taskState: "done" },
    { id: "todo", name: "To Do", sortOrder: 1, taskState: "todo" },
    { id: "doing", name: "Doing", sortOrder: 2, taskState: "in_progress" },
    { id: "old", name: "Archived", sortOrder: 4, taskState: "todo", archivedAt: "now" },
  ];

  test("lists active Workflow Statuses in sort order for the status picker", () => {
    expect(statusOptions(statuses).map((option) => option.value)).toEqual([
      "todo",
      "doing",
      "done",
    ]);
    expect(statusOptions(statuses).map((option) => option.label)).toEqual([
      "To Do",
      "Doing",
      "Done",
    ]);
  });

  test("excludes archived Workflow Statuses from the status picker", () => {
    expect(statusOptions(statuses).map((option) => option.value)).not.toContain("old");
  });

  test("renders a status icon for every option", () => {
    expect(statusOptions(statuses).every((option) => option.icon != null)).toBe(true);
  });
});

describe("Card picker hotkeys", () => {
  const status = { key: "s", openRef: { current: null } };
  const assignee = { key: "a", openRef: { current: null } };
  const size = { key: "e", shift: true, openRef: { current: null } };
  const hotkeys = [status, assignee, size];

  test("matches an unshifted key to its binding case-insensitively", () => {
    expect(matchPickerHotkey(keyEvent({ key: "S" }), hotkeys)).toBe(status);
    expect(matchPickerHotkey(keyEvent({ key: "a" }), hotkeys)).toBe(assignee);
  });

  test("requires Shift state to match the binding", () => {
    // "E" needs Shift; bare "e" should not match the shifted binding.
    expect(matchPickerHotkey(keyEvent({ key: "e" }), hotkeys)).toBeNull();
    expect(matchPickerHotkey(keyEvent({ key: "E", shiftKey: true }), hotkeys)).toBe(size);
    // An unshifted binding should not fire while Shift is held.
    expect(matchPickerHotkey(keyEvent({ key: "s", shiftKey: true }), hotkeys)).toBeNull();
  });

  test("ignores keys held with a meta/ctrl/alt modifier", () => {
    expect(matchPickerHotkey(keyEvent({ key: "s", metaKey: true }), hotkeys)).toBeNull();
    expect(matchPickerHotkey(keyEvent({ key: "s", ctrlKey: true }), hotkeys)).toBeNull();
    expect(matchPickerHotkey(keyEvent({ key: "s", altKey: true }), hotkeys)).toBeNull();
  });

  test("returns null when no binding matches", () => {
    expect(matchPickerHotkey(keyEvent({ key: "z" }), hotkeys)).toBeNull();
  });
});
