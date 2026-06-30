import type { Value } from "platejs";

/** An empty description is a single empty paragraph. */
export const EMPTY_DESCRIPTION_VALUE: Value = [{ type: "p", children: [{ text: "" }] }];

/**
 * Parse a stored description into a Plate `Value`.
 *
 * Descriptions are stored as serialized Plate JSON. Legacy rows may hold plain
 * text (or be empty/null); those are coerced into a single paragraph so the
 * editor always receives a valid value.
 */
export function parseDescriptionValue(stored: string | null | undefined): Value {
  if (!stored) return EMPTY_DESCRIPTION_VALUE;

  try {
    const parsed = JSON.parse(stored) as unknown;

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as Value;
    }

    return EMPTY_DESCRIPTION_VALUE;
  } catch {
    // Legacy plain-text description.
    return [{ type: "p", children: [{ text: stored }] }];
  }
}

/** True when the value has no text content and no inline nodes (mentions). */
export function isDescriptionEmpty(value: Value): boolean {
  return value.every((node) => {
    const children = (node as { children?: unknown[] }).children ?? [];

    return children.every((child) => {
      const text = (child as { text?: string }).text;
      // A node with no `text` key is an element (e.g. a mention) → not empty.
      return typeof text === "string" && text.trim() === "";
    });
  });
}

/**
 * Serialize a Plate `Value` for storage. Returns `null` when the document is
 * empty so the column stays `NULL` (matching the existing nullable contract).
 */
export function serializeDescriptionValue(value: Value): string | null {
  if (isDescriptionEmpty(value)) return null;

  return JSON.stringify(value);
}
