import type { Value } from "platejs";

import {
  EMPTY_DESCRIPTION_VALUE,
  isDescriptionEmpty,
  parseDescriptionValue,
} from "@/components/editor/description-value";

/**
 * Task Comments share the Task description's storage model: the body is
 * serialized Plate JSON (rich text + mention pills). These helpers adapt the
 * description value helpers to the comment contract, where the body column is
 * NOT NULL — so an empty comment is rejected by the caller rather than stored as
 * `null` — and where several consumers (markdown copy, "create task from
 * comment") still need a flattened plain-text view of the body.
 */

/** An empty comment is a single empty paragraph (same as descriptions). */
export const EMPTY_COMMENT_VALUE: Value = EMPTY_DESCRIPTION_VALUE;

/** Parse a stored comment body (Plate JSON, or legacy plain text) into a value. */
export const parseCommentValue = (stored: string | null | undefined): Value =>
  parseDescriptionValue(stored);

/** True when the comment value has no text and no inline nodes (mentions). */
export const isCommentEmpty = (value: Value): boolean => isDescriptionEmpty(value);

/**
 * Serialize a comment value for storage. Returns `null` when the document is
 * empty so callers can short-circuit submission (the body column is NOT NULL,
 * so empties must never be persisted).
 */
export const serializeCommentValue = (value: Value): string | null => {
  if (isCommentEmpty(value)) return null;

  return JSON.stringify(value);
};

type UnknownRecord = { readonly [key: string]: unknown };

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

/** A mention pill flattens to its label, prefixed with `@` for user mentions. */
const mentionText = (node: UnknownRecord): string | null => {
  if (node.type !== "mention") return null;

  const value = typeof node.value === "string" ? node.value : "";

  return node.mentionKind === "user" ? `@${value}` : value;
};

const collectInline = (node: unknown, sink: (text: string) => void): void => {
  if (Array.isArray(node)) {
    for (const child of node) collectInline(child, sink);

    return;
  }
  if (!isRecord(node)) return;

  const mention = mentionText(node);
  if (mention !== null) {
    sink(mention);

    return;
  }

  if (typeof node.text === "string") {
    sink(node.text);

    return;
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) collectInline(child, sink);
  }
};

/**
 * Flatten a stored comment body to plain text, rendering mention pills as their
 * label (`@Jane`, `DEV-12`). Block nodes are joined with newlines. Legacy
 * plain-text bodies pass through. Used for "copy comment" and "create task from
 * comment", which both operate on readable text rather than JSON.
 */
export const commentValueToPlainText = (stored: string | null | undefined): string => {
  if (!stored) return "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return stored;
  }

  if (!Array.isArray(parsed)) return "";

  return parsed
    .map((block) => {
      const parts: string[] = [];
      collectInline(block, (text) => parts.push(text));

      return parts.join("");
    })
    .join("\n")
    .trim();
};
