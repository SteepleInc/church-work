import { atom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useMemo } from "react";

/**
 * Number of rich-text editors that currently hold focus. A counter (not a
 * boolean) so overlapping focus/blur — e.g. focus moving between two editors,
 * or a portaled combobox briefly stealing focus — never leaves the flag stuck.
 *
 * Global single-key shortcuts (e.g. "/" for search, "c" for create) read this
 * to stay out of the way while the user is typing. This is more reliable than
 * each handler inspecting `event.target`, because libraries like
 * `@tanstack/hotkeys` may `preventDefault()` on match *before* a target guard
 * in the callback runs — which would otherwise swallow the keystroke.
 */
export const editorFocusCountAtom = atom(0);

/** True while any rich-text editor is focused. */
export const isEditorFocusedAtom = atom((get) => get(editorFocusCountAtom) > 0);

/**
 * Focus/blur handlers for a rich-text editor that keep
 * {@link editorFocusCountAtom} in sync. Spread the returned handlers onto the
 * editor (they compose with any caller-provided `onFocus`/`onBlur`).
 */
export function useEditorFocusTracking() {
  const setCount = useSetAtom(editorFocusCountAtom);

  const onFocus = useCallback(() => {
    setCount((count) => count + 1);
  }, [setCount]);

  const onBlur = useCallback(() => {
    setCount((count) => Math.max(0, count - 1));
  }, [setCount]);

  return useMemo(() => ({ onFocus, onBlur }), [onFocus, onBlur]);
}

/** Read whether a rich-text editor currently owns focus. */
export function useIsEditorFocused(): boolean {
  return useAtomValue(isEditorFocusedAtom);
}
