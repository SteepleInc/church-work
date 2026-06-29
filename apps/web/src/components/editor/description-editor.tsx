"use client";

import * as React from "react";

import type { Value } from "platejs";

import { Plate, usePlateEditor } from "platejs/react";

import { DescriptionKit } from "@/components/editor/plugins/description-kit";
import { Editor, EditorContainer } from "@/components/ui/editor";
import { useEditorFocusTracking } from "@/lib/editor-focus";
import { cn } from "@/lib/utils";

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
  /** Accessible name for the contentEditable (e.g. "Edit comment"). */
  ariaLabel?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
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
  ariaLabel,
  onKeyDown,
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

  const handleFocus: React.FocusEventHandler<HTMLDivElement> = (event) => {
    focusTracking.onFocus();
    onFocus?.(event);
  };

  const handleBlur: React.FocusEventHandler<HTMLDivElement> = (event) => {
    focusTracking.onBlur();
    onBlur?.(event);
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
          onKeyDown={onKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </EditorContainer>
    </Plate>
  );
}
