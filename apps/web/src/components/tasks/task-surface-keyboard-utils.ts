/**
 * Pure decision logic for the Task surface keyboard layer (see
 * task-surface-keyboard.tsx). Kept free of React/DOM state so the whole
 * shortcut decision tree, the focus-cursor math, and the range-selection math
 * can be unit-tested directly.
 */

export type TaskShortcutField = "status" | "assignee" | "priority" | "labels" | "estimate";

/**
 * The high-level intent a keydown resolves to. The component performs the side
 * effect; this function only decides what should happen.
 *
 * - `none` — not a shortcut we own; let it through.
 * - `move` — move the focus cursor (and optionally extend the selection).
 * - `field` — open a per-Task field picker on the focused Task.
 * - the rest are zero-argument intents.
 */
export type TaskShortcutIntent =
  | { readonly kind: "none" }
  | { readonly kind: "open-help" }
  | { readonly kind: "toggle-layout" }
  | { readonly kind: "select-all" }
  | { readonly kind: "clear-selection" }
  | { readonly kind: "open-display-options" }
  | { readonly kind: "move"; readonly direction: 1 | -1; readonly extend: boolean }
  | { readonly kind: "open-task" }
  | { readonly kind: "toggle-select" }
  | { readonly kind: "field"; readonly field: TaskShortcutField };

// The subset of KeyboardEvent the resolver reads; lets tests pass plain objects.
export type ShortcutKeyEvent = Pick<
  KeyboardEvent,
  "key" | "shiftKey" | "metaKey" | "ctrlKey" | "altKey"
>;

// Bare keystroke -> field picker it opens (S status, A assignee, P priority, L
// labels, Shift+E estimate). Mirrors the previous hover-scoped bindings.
export function matchFieldKey(event: ShortcutKeyEvent): TaskShortcutField | null {
  if (event.altKey || event.metaKey || event.ctrlKey) return null;
  const key = event.key.toLowerCase();
  if (key === "e" && event.shiftKey) return "estimate";
  if (event.shiftKey) return null;
  if (key === "s") return "status";
  if (key === "a") return "assignee";
  if (key === "p") return "priority";
  if (key === "l") return "labels";
  return null;
}

/**
 * Resolve a keydown to its intent. `hasFocus` gates the per-Task actions
 * (open / select / field pickers) that require a highlighted Task. Editable
 * targets are filtered out by the caller before this runs.
 *
 * Note: Filter's `F` is intentionally absent — it is owned natively by the
 * reUI Filters menu.
 */
export function resolveSurfaceShortcut(
  event: ShortcutKeyEvent,
  hasFocus: boolean,
): TaskShortcutIntent {
  const key = event.key;
  const mod = event.metaKey || event.ctrlKey;

  // --- Modifier (Cmd/Ctrl) shortcuts ---
  if (mod) {
    if (key === "/" || key === "?") return { kind: "open-help" };
    if (key === "b" || key === "B") return { kind: "toggle-layout" };
    if (key === "a" || key === "A") return { kind: "select-all" };
    // Leave every other Cmd/Ctrl combo to the browser/app.
    return { kind: "none" };
  }

  if (key === "Escape") return { kind: "clear-selection" };

  if (!event.altKey && event.shiftKey && (key === "v" || key === "V")) {
    return { kind: "open-display-options" };
  }

  // Alt+Shift+Arrow is the Board's manual-reorder shortcut; not ours here.
  if (event.altKey) return { kind: "none" };

  // --- Navigation (works without a cursor; seeds one) ---
  if (key === "ArrowDown" || (key === "j" && !event.shiftKey)) {
    return { kind: "move", direction: 1, extend: event.shiftKey };
  }
  if (key === "ArrowUp" || (key === "k" && !event.shiftKey)) {
    return { kind: "move", direction: -1, extend: event.shiftKey };
  }
  if (event.shiftKey && key === "J") return { kind: "move", direction: 1, extend: true };
  if (event.shiftKey && key === "K") return { kind: "move", direction: -1, extend: true };

  // --- Per-Task actions (require a focused cursor) ---
  if (!hasFocus) return { kind: "none" };

  if (key === "Enter" || (key === "o" && !event.shiftKey)) return { kind: "open-task" };
  if (key === "x" || key === "X") return { kind: "toggle-select" };

  const field = matchFieldKey(event);
  if (field) return { kind: "field", field };

  return { kind: "none" };
}

/**
 * Index the focus cursor should move to. With no current cursor, Down seeds the
 * top and Up seeds the bottom; otherwise it steps one and clamps at the ends.
 * Returns -1 when there is nothing to focus.
 */
export function nextFocusIndex(
  order: readonly string[],
  currentId: string | null,
  direction: 1 | -1,
): number {
  if (order.length === 0) return -1;
  const currentIndex = currentId ? order.indexOf(currentId) : -1;
  if (currentIndex < 0) return direction === 1 ? 0 : order.length - 1;
  return Math.min(order.length - 1, Math.max(0, currentIndex + direction));
}

/**
 * The contiguous id range between the anchor and target (inclusive), in surface
 * order — Linear's Shift+Arrow range. Ids absent from `order` yield an empty
 * range.
 */
export function selectionRange(
  order: readonly string[],
  anchorId: string,
  targetId: string,
): readonly string[] {
  const anchorIndex = order.indexOf(anchorId);
  const targetIndex = order.indexOf(targetId);
  if (anchorIndex < 0 || targetIndex < 0) return [];
  const [lo, hi] =
    anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
  return order.slice(lo, hi + 1);
}
