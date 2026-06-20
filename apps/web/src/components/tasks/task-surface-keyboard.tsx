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
import {
  nextFocusIndex,
  resolveSurfaceShortcut,
  selectionRange,
  type TaskShortcutField,
} from "./task-surface-keyboard-utils";

export type { TaskShortcutField } from "./task-surface-keyboard-utils";

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

type TaskShortcutHandlers = {
  readonly open?: () => void;
  readonly openParent?: () => void;
  readonly pickers: Partial<Record<TaskShortcutField, MutableRefObject<(() => void) | null>>>;
};

type TaskSurfaceKeyboardContextValue = {
  readonly focusedTaskId: string | null;
  readonly selectedTaskIds: ReadonlySet<string>;
  readonly setFocusedTaskId: (taskId: string | null) => void;
  /**
   * Moves the cursor onto the hovered card. Like Linear, hovering a card makes
   * its per-issue shortcuts (`S`/`A`/`P`/`L`/`Shift+E`, `Enter`, `X`) live.
   * Unlike `J`/`K`, hover must not scroll the surface, so this records that the
   * latest focus change came from the pointer (see {@link focusFromKeyboard}).
   */
  readonly setHoveredTaskId: (taskId: string | null) => void;
  /**
   * Whether the current focus was set by keyboard navigation (`J`/`K`/arrows)
   * rather than the pointer. Cards gate `scrollIntoView` on this so hovering
   * never yanks the surface under the mouse.
   */
  readonly focusFromKeyboard: boolean;
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
  readonly onTogglePanel?: () => void;
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
  // Tracks whether the cursor was last moved by keyboard nav vs. the pointer so
  // cards only auto-scroll for keyboard moves, never for hover.
  const [focusFromKeyboard, setFocusFromKeyboard] = useState(true);

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
    setFocusFromKeyboard(true);
    setFocusedTaskIdState(taskId);
  }, []);

  const setHoveredTaskId = useCallback((taskId: string | null) => {
    // Leaving a card (null) doesn't drop the cursor — Linear keeps the last
    // hovered card "armed" so you can move the mouse off it and still hit a
    // shortcut. Only entering a card moves the cursor.
    if (taskId === null) return;
    if (focusedTaskIdRef.current === taskId) return;
    focusedTaskIdRef.current = taskId;
    setFocusFromKeyboard(false);
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
      const current = focusedTaskIdRef.current;
      const nextIndex = nextFocusIndex(order, current, direction);
      const nextId = nextIndex >= 0 ? order[nextIndex] : undefined;
      if (!nextId) return;

      if (extendSelection) {
        // Linear's Shift+Arrow grows a contiguous range from the anchor.
        if (anchorRef.current === null) anchorRef.current = current ?? nextId;
        setSelection(new Set(selectionRange(order, anchorRef.current, nextId)));
      }
      setFocusedTaskId(nextId);
    },
    [setFocusedTaskId, setSelection],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      const focusedId = focusedTaskIdRef.current;
      const intent = resolveSurfaceShortcut(event, focusedId !== null);

      switch (intent.kind) {
        case "none":
          return;
        case "open-help":
          event.preventDefault();
          actionsRef.current.onOpenShortcutsHelp?.();
          return;
        case "toggle-layout":
          event.preventDefault();
          actionsRef.current.onToggleLayout?.();
          return;
        case "toggle-panel":
          event.preventDefault();
          actionsRef.current.onTogglePanel?.();
          return;
        case "select-all": {
          const getSelectAllIds = actionsRef.current.getSelectAllIds;
          if (!getSelectAllIds) return;
          event.preventDefault();
          setSelection(new Set(getSelectAllIds()));
          anchorRef.current = orderRef.current[0] ?? null;
          return;
        }
        case "clear-selection":
          if (selectedRef.current.size > 0) {
            event.preventDefault();
            clearSelection();
          }
          return;
        case "open-display-options":
          event.preventDefault();
          actionsRef.current.onOpenDisplayOptions?.();
          return;
        case "move":
          event.preventDefault();
          moveFocus(intent.direction, intent.extend);
          return;
        case "open-task": {
          const handlers = focusedId ? handlersRef.current.get(focusedId) : undefined;
          if (handlers?.open) {
            event.preventDefault();
            handlers.open();
          }
          return;
        }
        case "toggle-select":
          if (!focusedId) return;
          event.preventDefault();
          toggleSelected(focusedId);
          return;
        case "field": {
          const handlers = focusedId ? handlersRef.current.get(focusedId) : undefined;
          const opener = handlers?.pickers[intent.field]?.current;
          if (opener) {
            event.preventDefault();
            opener();
          }
          return;
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [clearSelection, moveFocus, toggleSelected, setSelection]);

  const value = useMemo<TaskSurfaceKeyboardContextValue>(
    () => ({
      focusedTaskId,
      selectedTaskIds,
      setFocusedTaskId,
      setHoveredTaskId,
      focusFromKeyboard,
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
      setHoveredTaskId,
      focusFromKeyboard,
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
): {
  readonly isFocused: boolean;
  readonly isSelected: boolean;
  /** True when this card's focus came from keyboard nav (safe to scroll into view). */
  readonly isKeyboardFocused: boolean;
  /** Arm this card's shortcuts on pointer enter (Linear-style hover focus). */
  readonly onHover: () => void;
} {
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

  const setHoveredTaskId = keyboard?.setHoveredTaskId;
  const onHover = useCallback(() => {
    setHoveredTaskId?.(taskId);
  }, [setHoveredTaskId, taskId]);

  const isFocused = keyboard?.focusedTaskId === taskId;
  return {
    isFocused,
    isSelected: keyboard?.selectedTaskIds.has(taskId) ?? false,
    isKeyboardFocused: isFocused && (keyboard?.focusFromKeyboard ?? false),
    onHover,
  };
}
