import { createContext, useContext, useEffect, useRef, type MutableRefObject } from "react";

import { isEditableTarget } from "@/components/tasks/task-kanban-board-utils";
import {
  matchFieldKey,
  type ShortcutKeyEvent,
  type TaskShortcutField,
} from "@/components/tasks/task-surface-keyboard-utils";

/** What a hovered-row keystroke resolves to. The hook performs the effect. */
export type SubTaskHoverIntent =
  | { readonly kind: "none" }
  | { readonly kind: "open" }
  | { readonly kind: "field"; readonly field: TaskShortcutField };

/**
 * Pure decision logic for the hovered sub-task row: `Enter`/`O` opens it and
 * `S`/`A`/`P`/`L`/`Shift+E` open its field picker. Modifier combos
 * (Cmd/Ctrl/Alt) are left for the browser/app. Kept DOM-free for unit tests.
 */
export function resolveSubTaskHoverShortcut(event: ShortcutKeyEvent): SubTaskHoverIntent {
  if (event.metaKey || event.ctrlKey || event.altKey) return { kind: "none" };
  const key = event.key;
  if ((key === "Enter" || key === "o" || key === "O") && !event.shiftKey) return { kind: "open" };
  const field = matchFieldKey(event);
  return field ? { kind: "field", field } : { kind: "none" };
}

/**
 * Lightweight, self-contained hover-keyboard layer for the sub-task rows in the
 * Task details pane.
 *
 * The Board/List surfaces use {@link TaskSurfaceKeyboardProvider}, which owns a
 * full keyboard cursor (`J`/`K` navigation, multi-select, select-all, layout
 * toggles, and a global `keydown` handler). Mounting that inside the pane —
 * which renders *over* a live surface — would fight that surface's handler and
 * pull in navigation/selection behaviour the pane doesn't want.
 *
 * Instead this layer mirrors only Linear's hover-armed field shortcuts: hover a
 * sub-task row and `S`/`A`/`P`/`L`/`Shift+E` open that row's field picker while
 * `Enter`/`O` opens the sub-task. Like Linear, leaving a row keeps it "armed"
 * so the pointer can drift off before the keystroke lands; only entering a new
 * row moves the cursor.
 */

export type SubTaskRowHandlers = {
  readonly open?: () => void;
  readonly pickers: Partial<Record<TaskShortcutField, MutableRefObject<(() => void) | null>>>;
};

// Module-scoped signal: is a sub-task row currently armed? The Task details
// pane binds the same `S`/`P`/`A`/`L`/`⇧E` keys to the *parent* Task while open
// (capture phase). When the pointer is over a sub-task row, that row must win
// those keys instead — the pane handler reads this to defer. Module scope (not
// context) keeps the pane decoupled from the section's provider.
let armedSubTaskRowCount = 0;

/** True while the pointer is hovering a sub-task row (its shortcuts are armed). */
export function isSubTaskRowArmed(): boolean {
  return armedSubTaskRowCount > 0;
}

type SubTaskHoverContextValue = {
  /** Arm a row's shortcuts when the pointer enters it. */
  readonly setHovered: (taskId: string) => void;
  /** Disarm whichever row is armed (pointer left the rows region). */
  readonly clearHovered: () => void;
  /** Register a row's imperative openers; returns an unregister cleanup. */
  readonly register: (taskId: string, handlers: SubTaskRowHandlers) => () => void;
};

const SubTaskHoverContext = createContext<SubTaskHoverContextValue | null>(null);

/**
 * Owns the single `keydown` listener and the hovered-row registry. Returns the
 * context value to provide to {@link SubTaskHoverContext} so rows can register
 * and arm themselves.
 */
export function useSubTaskHoverShortcuts(): SubTaskHoverContextValue {
  const hoveredRef = useRef<string | null>(null);
  const handlersRef = useRef<Map<string, SubTaskRowHandlers>>(new Map());

  const value = useRef<SubTaskHoverContextValue>({
    setHovered: (taskId) => {
      // First arm bumps the global count so the pane defers; re-arming a
      // different row keeps it at one.
      if (hoveredRef.current === null) armedSubTaskRowCount += 1;
      hoveredRef.current = taskId;
    },
    clearHovered: () => {
      if (hoveredRef.current !== null) armedSubTaskRowCount = Math.max(0, armedSubTaskRowCount - 1);
      hoveredRef.current = null;
    },
    register: (taskId, handlers) => {
      handlersRef.current.set(taskId, handlers);
      return () => {
        if (handlersRef.current.get(taskId) === handlers) handlersRef.current.delete(taskId);
      };
    },
  });

  // Safety net: if the section unmounts while a row is armed, release the count.
  useEffect(() => {
    return () => {
      if (hoveredRef.current !== null) {
        armedSubTaskRowCount = Math.max(0, armedSubTaskRowCount - 1);
        hoveredRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      const hoveredId = hoveredRef.current;
      if (!hoveredId) return;
      const handlers = handlersRef.current.get(hoveredId);
      if (!handlers) return;

      const intent = resolveSubTaskHoverShortcut(event);
      if (intent.kind === "none") return;
      if (intent.kind === "open") {
        if (!handlers.open) return;
        event.preventDefault();
        // Pre-empt the pane's capture-phase handler, which binds the same keys
        // to the parent Task while open.
        event.stopImmediatePropagation();
        handlers.open();
        return;
      }
      const opener = handlers.pickers[intent.field]?.current;
      if (!opener) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      opener();
    };

    // Capture phase so this runs in the same phase as the pane's handler; the
    // armed-row count plus stopImmediatePropagation ensure the row wins.
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return value.current;
}

export const SubTaskHoverProvider = SubTaskHoverContext.Provider;

/**
 * Registers a row's imperative openers and returns an `onHover` handler the row
 * binds to `onMouseEnter`. No-ops when rendered outside a provider.
 */
export function useRegisterSubTaskRow(
  taskId: string,
  handlers: SubTaskRowHandlers,
): { readonly onHover: () => void } {
  const context = useContext(SubTaskHoverContext);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!context) return;
    // Register a stable wrapper so the entry survives opener-ref churn.
    return context.register(taskId, {
      open: () => handlersRef.current.open?.(),
      pickers: handlersRef.current.pickers,
    });
  }, [context, taskId]);

  return {
    onHover: () => context?.setHovered(taskId),
  };
}
