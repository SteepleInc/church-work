"use client";

import * as React from "react";

import type { PlateEditor } from "platejs/react";
import type { Value } from "platejs";

import { Plate, usePlateEditor } from "platejs/react";

import { DescriptionKit } from "@/components/editor/plugins/description-kit";
import { Editor, EditorContainer } from "@/components/ui/editor";
import { useEditorFocusTracking } from "@/lib/editor-focus";
import { cn } from "@/lib/utils";

// True when the collapsed caret sits on the first *visual* line of the editor —
// the point past which ArrowUp has nowhere to go and should escape upward to the
// title. Slate models blocks, not wrapped lines, so we measure the caret's
// client rect against the editor's content top (within one line-height). We
// first require the caret to be in the very first block; that alone is enough
// for a single-line block, and the rect check handles a soft-wrapped first
// paragraph (only its top wrapped line escapes).
function isCaretOnFirstLine(editor: PlateEditor, contentEditable: HTMLElement): boolean {
  const focus = editor.selection?.focus;
  if (!focus || focus.path[0] !== 0) return false;

  const domSelection = contentEditable.ownerDocument.getSelection();
  if (!domSelection || domSelection.rangeCount === 0) return false;

  const caretRect = domSelection.getRangeAt(0).getClientRects()[0];
  const editorRect = contentEditable.getBoundingClientRect();
  if (!caretRect) {
    // No rect (e.g. an empty first line): the caret is necessarily on line one.
    return true;
  }

  // A line-height's worth of slack: the caret is on the first line when its top
  // is within one line of the editor content's top.
  const lineHeight =
    caretRect.height ||
    Number.parseFloat(
      contentEditable.ownerDocument.defaultView?.getComputedStyle(contentEditable).lineHeight ??
        "20",
    );
  return caretRect.top - editorRect.top <= lineHeight * 0.75;
}

export type DescriptionEditorHandle = {
  /** Focus the editor with the caret at the very start of the document. */
  focusStart: () => void;
};

export type DescriptionEditorProps = {
  /** Initial Plate value. Only read on mount; updates are uncontrolled. */
  value: Value;
  onChange?: (value: Value) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Render the same nodes (mentions, code, lists) without editing affordances. */
  readOnly?: boolean;
  /** Focus the editor on mount (e.g. an inline reply/edit composer). */
  autoFocus?: boolean;
  className?: string;
  /**
   * Extra classes for the contentEditable itself (inside the scroll/clip box).
   * Use this — not `className` — for horizontal padding, so inline affordances
   * like the `@` chip's focus ring aren't clipped by the container's edge.
   */
  contentClassName?: string;
  /** Forwarded to the underlying contentEditable for focus management. */
  editorRef?: React.RefObject<HTMLDivElement | null>;
  /**
   * Receives an imperative handle for cross-field focus. `focusStart` places the
   * caret at the very top of the document — used when a field above (e.g. the
   * Task title) hands focus down via ArrowDown, so the seam reads as one
   * surface. The native contentEditable `.focus()` restores the *last* caret,
   * which is wrong when entering from above.
   */
  focusHandleRef?: React.RefObject<DescriptionEditorHandle | null>;
  /** Accessible name for the contentEditable (e.g. "Edit comment"). */
  ariaLabel?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  /**
   * Fires when ArrowUp (or ArrowLeft) is pressed while the caret sits at the
   * very start of the document, so a parent can hand focus to a field above
   * (e.g. the Task title). Returning nothing is fine; the default caret move is
   * prevented when this fires. The editor stays put if the caret is anywhere
   * else, so multi-line navigation inside the description is untouched.
   */
  onEscapeStart?: () => void;
  /** Fires when the contentEditable gains focus. */
  onFocus?: React.FocusEventHandler<HTMLDivElement>;
  /** Fires when the contentEditable loses focus (commit-on-blur pattern). */
  onBlur?: React.FocusEventHandler<HTMLDivElement>;
};

/**
 * Linear-style description editor: chromeless rich text with markdown
 * shortcuts, a `/` slash menu, and `@` mentions. Drop-in replacement for a
 * `<textarea>` that exchanges Plate JSON (`Value`) instead of a string.
 */
export function DescriptionEditor({
  value,
  onChange,
  placeholder = "Add description...",
  disabled,
  readOnly,
  autoFocus,
  className,
  contentClassName,
  editorRef,
  focusHandleRef,
  ariaLabel,
  onKeyDown,
  onEscapeStart,
  onFocus,
  onBlur,
}: DescriptionEditorProps) {
  const editor = usePlateEditor({
    plugins: DescriptionKit,
    readOnly,
    // Slate identifies nodes by object identity, so two editors must never be
    // initialized from the same `value` objects (e.g. the shared empty-document
    // constant). Mounting them with shared nodes corrupts the node→path map and
    // crashes with "Unable to find the path for Slate node". `usePlateEditor`
    // reads `value` only once, so a one-time deep clone on mount is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    value: React.useMemo(() => structuredClone(value), []),
  });

  // Suppress global single-key shortcuts (e.g. "/" search) while this editor is
  // focused, so trigger characters reach the editor instead of being consumed.
  const focusTracking = useEditorFocusTracking();

  React.useImperativeHandle(
    focusHandleRef,
    () => ({
      focusStart: () => editor.tf.focus({ edge: "startEditor" }),
    }),
    [editor],
  );

  const handleFocus: React.FocusEventHandler<HTMLDivElement> = (event) => {
    focusTracking.onFocus();
    onFocus?.(event);
  };

  const handleBlur: React.FocusEventHandler<HTMLDivElement> = (event) => {
    focusTracking.onBlur();
    onBlur?.(event);
  };

  // Linear-style seam: the title and description read as one surface even though
  // they are two editors. When the caret reaches the top of the description,
  // ArrowUp/ArrowLeft escape upward to the title instead of staying put. We only
  // intercept when there is nowhere left to go inside the editor, so ordinary
  // navigation between description lines is never hijacked:
  //   - ArrowLeft escapes only from the document's exact start point.
  //   - ArrowUp escapes from the first *visual* line (matching Linear, where
  //     "up" from the top line always lands in the title — even when the caret
  //     is mid-line). "First visual line" is measured from the caret's client
  //     rect, since Slate has no notion of wrapped lines.
  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !onEscapeStart) return;
    if (event.key !== "ArrowUp" && event.key !== "ArrowLeft") return;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;

    const { selection } = editor;
    if (!selection || !editor.api.isCollapsed()) return;

    if (event.key === "ArrowLeft") {
      if (!editor.api.isStart(selection.focus, [])) return;
    } else if (!isCaretOnFirstLine(editor, event.currentTarget)) {
      return;
    }

    event.preventDefault();
    onEscapeStart();
  };

  return (
    <Plate editor={editor} onChange={({ value }) => onChange?.(value)}>
      <EditorContainer variant="default" className={cn("h-auto", className)}>
        <Editor
          ref={editorRef}
          variant="none"
          // Native (Slate) autofocus: focuses once the contentEditable is
          // mounted and its node→DOM paths are ready. A manual focus() in an
          // effect crashes ("Unable to find the path for Slate node") because it
          // runs before that mapping exists.
          autoFocus={autoFocus && !readOnly}
          aria-label={ariaLabel}
          className={cn("px-0 py-0 text-sm", contentClassName)}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </EditorContainer>
    </Plate>
  );
}
