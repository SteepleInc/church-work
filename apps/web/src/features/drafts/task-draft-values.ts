import type { TaskEstimate, TaskPriority } from "@/components/tasks/task-card-fields";

/**
 * Shared helpers for reading the raw, nullable fields stored on a `task_drafts`
 * row back into the shapes the create-Task composer and the Draft card render.
 *
 * A Task Draft may be incomplete, so every composer field is stored nullable
 * (and `label_ids` as a JSON-encoded text column mirroring `tasks`). These
 * helpers are the single place that normalizes those raw values, so the composer
 * rehydration and the Draft card pills always agree on what a Draft "carries".
 */

/** Parses the JSON-encoded `label_ids` text column into a string id array. */
export function parseDraftLabelIds(raw: string | null | undefined): readonly string[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

/** Coerces a stored priority into a known `TaskPriority`, defaulting to none. */
export function normalizeDraftPriority(value: string | null | undefined): TaskPriority {
  switch (value) {
    case "urgent":
    case "high":
    case "medium":
    case "low":
      return value;
    default:
      return "no_priority";
  }
}

/** Coerces a stored estimate into a known `TaskEstimate`, defaulting to none. */
export function normalizeDraftEstimate(value: string | null | undefined): TaskEstimate {
  switch (value) {
    case "xs":
    case "s":
    case "m":
    case "l":
    case "xl":
      return value;
    default:
      return "no_estimate";
  }
}
