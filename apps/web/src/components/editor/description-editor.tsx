"use client";

import * as React from "react";

import type { Value } from "platejs";

import { Plate, usePlateEditor } from "platejs/react";

import { DescriptionKit } from "@/components/editor/plugins/description-kit";
import { Editor, EditorContainer } from "@/components/ui/editor";
import { cn } from "@/lib/utils";

export type DescriptionEditorProps = {
  /** Initial Plate value. Only read on mount; updates are uncontrolled. */
  value: Value;
  onChange?: (value: Value) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Render the same nodes (mentions, code, lists) without editing affordances. */
  readOnly?: boolean;
  className?: string;
  /** Forwarded to the underlying contentEditable for focus management. */
  editorRef?: React.RefObject<HTMLDivElement | null>;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
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
  className,
  editorRef,
  onKeyDown,
}: DescriptionEditorProps) {
  const editor = usePlateEditor({
    plugins: DescriptionKit,
    readOnly,
    value,
  });

  return (
    <Plate editor={editor} onChange={({ value }) => onChange?.(value)}>
      <EditorContainer variant="default" className={cn("h-auto", className)}>
        <Editor
          ref={editorRef}
          variant="none"
          className="px-0 py-0 text-sm"
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          onKeyDown={onKeyDown}
        />
      </EditorContainer>
    </Plate>
  );
}
