import { describe, expect, test } from "bun:test";

import type { ShortcutKeyEvent } from "@/components/tasks/task-surface-keyboard-utils";
import { resolveSubTaskHoverShortcut } from "@/features/details-pane/sub-task-row-shortcuts";

const event = (
  over: Partial<ShortcutKeyEvent> & Pick<ShortcutKeyEvent, "key">,
): ShortcutKeyEvent => ({
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...over,
});

describe("resolveSubTaskHoverShortcut", () => {
  test("maps bare field keys to their pickers", () => {
    expect(resolveSubTaskHoverShortcut(event({ key: "s" }))).toEqual({
      kind: "field",
      field: "status",
    });
    expect(resolveSubTaskHoverShortcut(event({ key: "a" }))).toEqual({
      kind: "field",
      field: "assignee",
    });
    expect(resolveSubTaskHoverShortcut(event({ key: "p" }))).toEqual({
      kind: "field",
      field: "priority",
    });
    expect(resolveSubTaskHoverShortcut(event({ key: "l" }))).toEqual({
      kind: "field",
      field: "labels",
    });
  });

  test("Shift+E maps to estimate", () => {
    expect(resolveSubTaskHoverShortcut(event({ key: "e", shiftKey: true }))).toEqual({
      kind: "field",
      field: "estimate",
    });
  });

  test("Enter and O open the row", () => {
    expect(resolveSubTaskHoverShortcut(event({ key: "Enter" }))).toEqual({ kind: "open" });
    expect(resolveSubTaskHoverShortcut(event({ key: "o" }))).toEqual({ kind: "open" });
    expect(resolveSubTaskHoverShortcut(event({ key: "O" }))).toEqual({ kind: "open" });
  });

  test("Shift+O does not open (avoids clobbering other combos)", () => {
    expect(resolveSubTaskHoverShortcut(event({ key: "O", shiftKey: true }))).toEqual({
      kind: "none",
    });
  });

  test("modifier combos are left to the browser/app", () => {
    expect(resolveSubTaskHoverShortcut(event({ key: "s", metaKey: true }))).toEqual({
      kind: "none",
    });
    expect(resolveSubTaskHoverShortcut(event({ key: "Enter", ctrlKey: true }))).toEqual({
      kind: "none",
    });
    expect(resolveSubTaskHoverShortcut(event({ key: "s", altKey: true }))).toEqual({
      kind: "none",
    });
  });

  test("unmapped keys resolve to none", () => {
    expect(resolveSubTaskHoverShortcut(event({ key: "z" }))).toEqual({ kind: "none" });
  });
});
