import { describe, expect, test } from "bun:test";

import {
  matchFieldKey,
  nextFocusIndex,
  resolveSurfaceShortcut,
  selectionRange,
  type ShortcutKeyEvent,
} from "./task-surface-keyboard-utils";

function keyEvent(overrides: Partial<ShortcutKeyEvent>): ShortcutKeyEvent {
  return {
    key: "a",
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...overrides,
  };
}

describe("matchFieldKey", () => {
  test("maps bare letters to their field pickers", () => {
    expect(matchFieldKey(keyEvent({ key: "s" }))).toBe("status");
    expect(matchFieldKey(keyEvent({ key: "a" }))).toBe("assignee");
    expect(matchFieldKey(keyEvent({ key: "p" }))).toBe("priority");
    expect(matchFieldKey(keyEvent({ key: "l" }))).toBe("labels");
  });

  test("is case-insensitive only via Shift-less letters, but Shift+E is estimate", () => {
    expect(matchFieldKey(keyEvent({ key: "S" }))).toBe("status");
    expect(matchFieldKey(keyEvent({ key: "E", shiftKey: true }))).toBe("estimate");
    // bare e is not a field (estimate requires Shift).
    expect(matchFieldKey(keyEvent({ key: "e" }))).toBeNull();
    // Shift on a non-estimate letter disqualifies it.
    expect(matchFieldKey(keyEvent({ key: "s", shiftKey: true }))).toBeNull();
  });

  test("ignores keys held with a modifier", () => {
    expect(matchFieldKey(keyEvent({ key: "s", metaKey: true }))).toBeNull();
    expect(matchFieldKey(keyEvent({ key: "s", ctrlKey: true }))).toBeNull();
    expect(matchFieldKey(keyEvent({ key: "s", altKey: true }))).toBeNull();
  });

  test("returns null for unmapped keys", () => {
    expect(matchFieldKey(keyEvent({ key: "z" }))).toBeNull();
  });
});

describe("resolveSurfaceShortcut", () => {
  test("Cmd/Ctrl shortcuts: help, layout, select-all", () => {
    expect(resolveSurfaceShortcut(keyEvent({ key: "/", metaKey: true }), false)).toEqual({
      kind: "open-help",
    });
    expect(resolveSurfaceShortcut(keyEvent({ key: "?", ctrlKey: true }), false)).toEqual({
      kind: "open-help",
    });
    expect(resolveSurfaceShortcut(keyEvent({ key: "b", metaKey: true }), false)).toEqual({
      kind: "toggle-layout",
    });
    expect(resolveSurfaceShortcut(keyEvent({ key: "a", ctrlKey: true }), false)).toEqual({
      kind: "select-all",
    });
  });

  test("leaves other Cmd/Ctrl combos alone", () => {
    expect(resolveSurfaceShortcut(keyEvent({ key: "k", metaKey: true }), true)).toEqual({
      kind: "none",
    });
    expect(resolveSurfaceShortcut(keyEvent({ key: "c", metaKey: true }), true)).toEqual({
      kind: "none",
    });
  });

  test("Escape clears selection; Shift+V opens display options", () => {
    expect(resolveSurfaceShortcut(keyEvent({ key: "Escape" }), false)).toEqual({
      kind: "clear-selection",
    });
    expect(resolveSurfaceShortcut(keyEvent({ key: "V", shiftKey: true }), false)).toEqual({
      kind: "open-display-options",
    });
  });

  test("navigation works without a cursor and carries the extend flag", () => {
    expect(resolveSurfaceShortcut(keyEvent({ key: "j" }), false)).toEqual({
      kind: "move",
      direction: 1,
      extend: false,
    });
    expect(resolveSurfaceShortcut(keyEvent({ key: "ArrowUp" }), false)).toEqual({
      kind: "move",
      direction: -1,
      extend: false,
    });
    expect(resolveSurfaceShortcut(keyEvent({ key: "ArrowDown", shiftKey: true }), true)).toEqual({
      kind: "move",
      direction: 1,
      extend: true,
    });
    expect(resolveSurfaceShortcut(keyEvent({ key: "J", shiftKey: true }), true)).toEqual({
      kind: "move",
      direction: 1,
      extend: true,
    });
  });

  test("Alt+Shift+Arrow is left to the Board's reorder handler", () => {
    expect(
      resolveSurfaceShortcut(keyEvent({ key: "ArrowDown", altKey: true, shiftKey: true }), true),
    ).toEqual({ kind: "none" });
  });

  test("per-Task actions require a focused cursor", () => {
    // Without focus they are no-ops...
    expect(resolveSurfaceShortcut(keyEvent({ key: "Enter" }), false)).toEqual({ kind: "none" });
    expect(resolveSurfaceShortcut(keyEvent({ key: "x" }), false)).toEqual({ kind: "none" });
    expect(resolveSurfaceShortcut(keyEvent({ key: "s" }), false)).toEqual({ kind: "none" });

    // ...and resolve once a Task is highlighted.
    expect(resolveSurfaceShortcut(keyEvent({ key: "Enter" }), true)).toEqual({ kind: "open-task" });
    expect(resolveSurfaceShortcut(keyEvent({ key: "o" }), true)).toEqual({ kind: "open-task" });
    expect(resolveSurfaceShortcut(keyEvent({ key: "x" }), true)).toEqual({ kind: "toggle-select" });
    expect(resolveSurfaceShortcut(keyEvent({ key: "s" }), true)).toEqual({
      kind: "field",
      field: "status",
    });
  });

  test("F is not handled here (owned by the native Filters menu)", () => {
    expect(resolveSurfaceShortcut(keyEvent({ key: "f" }), true)).toEqual({ kind: "none" });
  });
});

describe("nextFocusIndex", () => {
  const order = ["a", "b", "c"];

  test("seeds the top going down and the bottom going up when there is no cursor", () => {
    expect(nextFocusIndex(order, null, 1)).toBe(0);
    expect(nextFocusIndex(order, null, -1)).toBe(2);
  });

  test("steps one and clamps at the ends", () => {
    expect(nextFocusIndex(order, "a", 1)).toBe(1);
    expect(nextFocusIndex(order, "c", 1)).toBe(2); // clamp at bottom
    expect(nextFocusIndex(order, "a", -1)).toBe(0); // clamp at top
  });

  test("returns -1 for an empty surface", () => {
    expect(nextFocusIndex([], "a", 1)).toBe(-1);
  });
});

describe("selectionRange", () => {
  const order = ["a", "b", "c", "d"];

  test("returns the inclusive range in surface order regardless of direction", () => {
    expect(selectionRange(order, "b", "d")).toEqual(["b", "c", "d"]);
    expect(selectionRange(order, "d", "b")).toEqual(["b", "c", "d"]);
  });

  test("a single-item range is just that item", () => {
    expect(selectionRange(order, "c", "c")).toEqual(["c"]);
  });

  test("returns empty when an endpoint is not in the order", () => {
    expect(selectionRange(order, "z", "b")).toEqual([]);
    expect(selectionRange(order, "b", "z")).toEqual([]);
  });
});
