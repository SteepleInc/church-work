import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";

import { isEditableTarget } from "./task-kanban-board-utils";

/**
 * Shared keyboard-cursor layer for the Task surfaces (Board + List).
 *
 * Linear drives every per-issue action off a single highlighted/"focused"
 * issue cursor: `J`/`K` (or arrows) move it, `X` selects it, the field
 * shortcuts (`S`/`A`/`P`/`L`/`Shift+E`) act on it, and `Enter` opens it. Our
 * Board cards and List rows previously bound those shortcuts to hover, which
 * meant they only worked under the mouse and there was no keyboard navigation.
 *
 * This provider owns:
 * - the flat, top-to-bottom ordered list of task ids currently rendered (each
 *   surface reports its order via {@link useRegisterSurfaceOrder});
 * - the focused task id (the cursor) and the multi-select set;
 * - a registry of per-task imperative openers (status/assignee/priority/labels/
 *   estimate) and the "open details" action, registered by each card/row via
 *   {@link useRegisterTaskShortcuts};
 * - the single global `keydown` handler that interprets all of the above.
 *
 * Both surfaces read {@link useTaskSurfaceKeyboard} to highlight the focused
 * row and reflect selection.
 */

export type TaskShortcutField = "status" | "assignee" | "priority" | "labels" | "estimate";

type TaskShortcutHandlers = {
  readonly open?: () => void;
  readonly openParent?: () => void;
  readonly pickers: Partial<Record<TaskShortcutField, MutableRefObject<(() => void) | null>>>;
};

type TaskSurfaceKeyboardContextValue = {
  readonly focusedTaskId: string | null;
  readonly selectedTaskIds: ReadonlySet<string>;
  readonly setFocusedTaskId: (taskId: string | null) => void;
  readonly toggleSelected: (taskId: string) => void;
  readonly setSelection: (taskIds: ReadonlySet<string>) => void;
  readonly clearSelection: () => void;
  readonly registerOrder: (order: readonly string[]) => () => void;
  readonly registerTask: (taskId: string, handlers: TaskShortcutHandlers) => () => void;
};

const TaskSurfaceKeyboardContext = createContext<TaskSurfaceKeyboardContextValue | null>(null);

const EMPTY_SELECTION: ReadonlySet<string> = new Set();

/**
 * Surface-level callbacks the keyboard layer needs but that live on the
 * orchestrator (view options, layout, help overlay). Passed to the provider so
 * the global handler can fire them. The Filter `F` shortcut is owned natively
 * by the reUI Filters menu, so it is intentionally not handled here.
 */
export type TaskSurfaceKeyboardActions = {
  readonly onToggleLayout?: () => void;
  readonly onOpenDisplayOptions?: () => void;
  // Returns the ids to select for Cmd/Ctrl+A (every non-canceled Task shown).
  readonly getSelectAllIds?: () => readonly string[];
  readonly onOpenShortcutsHelp?: () => void;
};

export function TaskSurfaceKeyboardProvider({
  actions,
  children,
}: {
  readonly actions: TaskSurfaceKeyboardActions;
  readonly children: ReactNode;
}) {
  const [focusedTaskId, setFocusedTaskIdState] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<ReadonlySet<string>>(EMPTY_SELECTION);

  // Surfaces register their flat order; the latest registration wins (only one
  // surface — Board or List — is mounted at a time).
  const orderRef = useRef<readonly string[]>([]);
  const handlersRef = useRef<Map<string, TaskShortcutHandlers>>(new Map());
  const focusedTaskIdRef = useRef<string | null>(null);
  const selectedRef = useRef<ReadonlySet<string>>(EMPTY_SELECTION);
  const anchorRef = useRef<string | null>(null);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const setFocusedTaskId = useCallback((taskId: string | null) => {
    focusedTaskIdRef.current = taskId;
    setFocusedTaskIdState(taskId);
  }, []);

  const setSelection = useCallback((taskIds: ReadonlySet<string>) => {
    selectedRef.current = taskIds;
    setSelectedTaskIds(taskIds);
  }, []);

  const clearSelection = useCallback(() => {
    selectedRef.current = EMPTY_SELECTION;
    anchorRef.current = null;
    setSelectedTaskIds(EMPTY_SELECTION);
  }, []);

  const toggleSelected = useCallback((taskId: string) => {
    setSelectedTaskIds((selection) => {
      const next = new Set(selection);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      selectedRef.current = next;
      return next;
    });
    anchorRef.current = taskId;
  }, []);

  const registerOrder = useCallback((order: readonly string[]) => {
    orderRef.current = order;
    // Drop a stale cursor that no longer exists in the rendered surface.
    if (focusedTaskIdRef.current && !order.includes(focusedTaskIdRef.current)) {
      focusedTaskIdRef.current = null;
      setFocusedTaskIdState(null);
    }
    return () => {
      if (orderRef.current === order) orderRef.current = [];
    };
  }, []);

  const registerTask = useCallback((taskId: string, handlers: TaskShortcutHandlers) => {
    handlersRef.current.set(taskId, handlers);
    return () => {
      if (handlersRef.current.get(taskId) === handlers) handlersRef.current.delete(taskId);
    };
  }, []);

  const moveFocus = useCallback(
    (direction: 1 | -1, extendSelection: boolean) => {
      const order = orderRef.current;
      if (order.length === 0) return;
      const current = focusedTaskIdRef.current;
      const currentIndex = current ? order.indexOf(current) : -1;
      const nextIndex =
        currentIndex < 0
          ? direction === 1
            ? 0
            : order.length - 1
          : Math.min(order.length - 1, Math.max(0, currentIndex + direction));
      const nextId = order[nextIndex];
      if (!nextId) return;

      if (extendSelection) {
        // Linear's Shift+Arrow grows a contiguous range from the anchor.
        if (anchorRef.current === null) anchorRef.current = current ?? nextId;
        const anchorIndex = order.indexOf(anchorRef.current);
        const [lo, hi] =
          anchorIndex <= nextIndex ? [anchorIndex, nextIndex] : [nextIndex, anchorIndex];
        setSelection(new Set(order.slice(lo, hi + 1)));
      }
      setFocusedTaskId(nextId);
    },
    [setFocusedTaskId, setSelection],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat && event.key !== "ArrowDown" && event.key !== "ArrowUp") {
        // Allow held arrows to repeat navigation, but not letter shortcuts.
      }
      if (isEditableTarget(event.target)) return;

      const key = event.key;
      const mod = event.metaKey || event.ctrlKey;

      // --- Surface-level shortcuts (no cursor required) --------------------
      if (mod && (key === "/" || key === "?")) {
        event.preventDefault();
        actionsRef.current.onOpenShortcutsHelp?.();
        return;
      }
      if (mod && (key === "b" || key === "B")) {
        // Linear: Cmd/Ctrl+B toggles Board/List layout.
        event.preventDefault();
        actionsRef.current.onToggleLayout?.();
        return;
      }
      if (mod && (key === "a" || key === "A")) {
        const getSelectAllIds = actionsRef.current.getSelectAllIds;
        if (getSelectAllIds) {
          event.preventDefault();
          setSelection(new Set(getSelectAllIds()));
          anchorRef.current = orderRef.current[0] ?? null;
        }
        return;
      }
      if (mod) return; // leave other Cmd/Ctrl combos to the browser/app.

      if (key === "Escape") {
        if (selectedRef.current.size > 0) {
          event.preventDefault();
          clearSelection();
        }
        return;
      }

      if (!event.altKey && (key === "v" || key === "V") && event.shiftKey) {
        event.preventDefault();
        actionsRef.current.onOpenDisplayOptions?.();
        return;
      }

      // --- Navigation -----------------------------------------------------
      // Alt+Shift+Arrow is the manual-reorder shortcut, handled by the Board;
      // leave it alone here.
      if (event.altKey) return;
      if (key === "ArrowDown" || (key === "j" && !event.shiftKey)) {
        event.preventDefault();
        moveFocus(1, event.shiftKey);
        return;
      }
      if (key === "ArrowUp" || (key === "k" && !event.shiftKey)) {
        event.preventDefault();
        moveFocus(-1, event.shiftKey);
        return;
      }
      if (event.shiftKey && key === "J") {
        event.preventDefault();
        moveFocus(1, true);
        return;
      }
      if (event.shiftKey && key === "K") {
        event.preventDefault();
        moveFocus(-1, true);
        return;
      }

      // --- Per-task actions (require a focused cursor) ---------------------
      const focusedId = focusedTaskIdRef.current;
      if (!focusedId) return;
      const handlers = handlersRef.current.get(focusedId);
      if (!handlers) return;

      // Open parent issue: Cmd+Shift+Up is handled above (mod). Plain `o` then
      // `i` is the Linear chord, but we keep the simpler Enter/`o` to open.
      if (key === "Enter" || (key === "o" && !event.shiftKey && !event.altKey)) {
        if (handlers.open) {
          event.preventDefault();
          handlers.open();
        }
        return;
      }

      if (key === "x" || key === "X") {
        event.preventDefault();
        toggleSelected(focusedId);
        return;
      }

      const pickerKey = matchFieldKey(event);
      if (pickerKey) {
        const opener = handlers.pickers[pickerKey]?.current;
        if (opener) {
          event.preventDefault();
          opener();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [clearSelection, moveFocus, toggleSelected]);

  const value = useMemo<TaskSurfaceKeyboardContextValue>(
    () => ({
      focusedTaskId,
      selectedTaskIds,
      setFocusedTaskId,
      toggleSelected,
      setSelection,
      clearSelection,
      registerOrder,
      registerTask,
    }),
    [
      focusedTaskId,
      selectedTaskIds,
      setFocusedTaskId,
      toggleSelected,
      setSelection,
      clearSelection,
      registerOrder,
      registerTask,
    ],
  );

  return (
    <TaskSurfaceKeyboardContext.Provider value={value}>
      {children}
    </TaskSurfaceKeyboardContext.Provider>
  );
}

// Maps a bare keystroke to the card field it opens (mirrors the previous
// hover-scoped bindings: S status, A assignee, P priority, L labels, Shift+E
// estimate).
function matchFieldKey(
  event: Pick<KeyboardEvent, "key" | "shiftKey" | "altKey">,
): TaskShortcutField | null {
  if (event.altKey) return null;
  const key = event.key.toLowerCase();
  if (key === "e" && event.shiftKey) return "estimate";
  if (event.shiftKey) return null;
  if (key === "s") return "status";
  if (key === "a") return "assignee";
  if (key === "p") return "priority";
  if (key === "l") return "labels";
  return null;
}

export function useTaskSurfaceKeyboard(): TaskSurfaceKeyboardContextValue | null {
  return useContext(TaskSurfaceKeyboardContext);
}

/**
 * Reports a surface's flat, ordered task ids to the keyboard layer so `J`/`K`
 * navigation walks them top-to-bottom across every group/column.
 */
export function useRegisterSurfaceOrder(order: readonly string[]): void {
  const keyboard = useTaskSurfaceKeyboard();
  const signature = order.join(",");
  useEffect(() => {
    if (!keyboard) return;
    // `signature` (not `order`) is the dependency: it captures order changes
    // without re-registering on every render that produces an equal array.
    return keyboard.registerOrder(order);
  }, [keyboard, signature, order]);
}

/**
 * Registers a single card/row's imperative openers with the keyboard layer and
 * returns its live focus/selection flags so the card can render the cursor
 * highlight and selection state.
 */
export function useRegisterTaskShortcuts(
  taskId: string,
  handlers: TaskShortcutHandlers,
): { readonly isFocused: boolean; readonly isSelected: boolean } {
  const keyboard = useTaskSurfaceKeyboard();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!keyboard) return;
    // Register a stable wrapper so the registry entry never goes stale even as
    // the openers' refs update across renders.
    return keyboard.registerTask(taskId, {
      open: () => handlersRef.current.open?.(),
      openParent: () => handlersRef.current.openParent?.(),
      pickers: handlersRef.current.pickers,
    });
  }, [keyboard, taskId]);

  return {
    isFocused: keyboard?.focusedTaskId === taskId,
    isSelected: keyboard?.selectedTaskIds.has(taskId) ?? false,
  };
}
