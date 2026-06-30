/**
 * Server-safe extraction of human-readable plain text from a serialized Plate
 * value (Task descriptions and Task Comments are both stored as Plate JSON; see
 * `apps/web/src/components/editor/description-value.ts`).
 *
 * This is used wherever a rich body needs to be flattened back to text — e.g.
 * comment notification excerpts and "copy as text" — without pulling in Plate.
 * It walks the same plain JSON shape the mutators already reason about, so it
 * runs on both client and server.
 *
 * Mention pills render as their cached display label so an excerpt reads
 * naturally (`@Jane`, `DEV-12`) instead of dropping the reference entirely.
 * Block-level nodes are separated by newlines so multi-paragraph bodies keep
 * their line structure; legacy plain-text bodies pass through untouched.
 */

const MENTION_NODE_TYPE = "mention";

type UnknownRecord = { readonly [key: string]: unknown };

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

/** A mention pill flattens to its display label, prefixed for user mentions. */
const mentionText = (node: UnknownRecord): string | null => {
  if (node.type !== MENTION_NODE_TYPE) return null;

  const value = typeof node.value === "string" ? node.value : "";
  if (node.mentionKind === "user") return `@${value}`;

  return value;
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
 * Flattens a serialized Plate value to plain text. Top-level block nodes are
 * joined with newlines; inline text and mention labels are concatenated within
 * a block. Empty / null / unparseable input returns the input verbatim (legacy
 * plain-text bodies) or an empty string.
 */
export const plateValueToPlainText = (serialized: string | null | undefined): string => {
  if (!serialized) return "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    // Legacy plain-text body — already human-readable.
    return serialized;
  }

  if (!Array.isArray(parsed)) return "";

  const blocks: string[] = [];
  for (const block of parsed) {
    const parts: string[] = [];
    collectInline(block, (text) => parts.push(text));
    blocks.push(parts.join(""));
  }

  return blocks.join("\n").trim();
};

/**
 * True when a serialized Plate body carries no text and no mentions. Used to
 * reject empty rich-text comments where a raw-string `.trim()` check would be
 * fooled by structural JSON (e.g. `"[]"` or an empty paragraph). Mentions
 * flatten to their label, so a non-empty flattened result also covers
 * mention-only bodies.
 */
export const isPlateBodyEmpty = (serialized: string | null | undefined): boolean =>
  plateValueToPlainText(serialized).trim().length === 0;
