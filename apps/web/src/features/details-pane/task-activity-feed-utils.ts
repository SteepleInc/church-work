import {
  getEstimateMeta,
  getPriorityMeta,
  type TaskEstimate,
  type TaskPriority,
} from "@/components/tasks/task-card-fields";

/**
 * Compact, Linear-style relative timestamp: "just now", "5m ago", "2h ago",
 * "3d ago", "10w ago", "2mo ago", "4y ago". Static (computed at render against
 * `now`), not a live-ticking clock; the absolute time goes in a `title`.
 */
export function formatActivityTime(occurredAtMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.round((nowMs - occurredAtMs) / 1000));
  if (seconds < 45) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.round(days / 7);
  // Weeks read better than months up through ~3 months, matching the Linear
  // feed (which still shows "10w ago" before switching to months).
  if (days < 84) return `${Math.max(1, weeks)}w ago`;

  const months = Math.round(days / 30);
  if (days < 365) return `${months}mo ago`;

  const years = Math.round(days / 365);
  return `${years}y ago`;
}

/**
 * A `{ id, label }` or `{ value, label }` reference snapshotted into Activity
 * metadata at change time. The `label` may be `null` when the actor was unknown
 * at write time; the Feed prefers a live name when one is available.
 */
export type ActivityRef = {
  readonly id?: string;
  readonly value?: string;
  readonly label?: string | null;
};

type ActivityMetadata = Record<string, unknown>;

/** A resolver that returns the current display name for a record id, or null. */
export type NameResolver = (id: string) => string | null;

export type ActivityResolvers = {
  readonly user: NameResolver;
  readonly status: NameResolver;
  readonly team: NameResolver;
  readonly label: NameResolver;
};

/**
 * The icon glyph an Activity line leads with. Mapped to a concrete Lucide icon
 * in the component; kept as a semantic token here so this stays pure.
 */
export type ActivityGlyph =
  | "created"
  | "status"
  | "assignee"
  | "team"
  | "priority"
  | "estimate"
  | "due_date"
  | "labels"
  | "cycle"
  | "title"
  | "completed"
  | "canceled"
  | "reopened"
  | "generic";

/**
 * A rendered Activity line. `text` is the human-readable phrase that follows
 * the actor's name (e.g. "moved this from To Do to In Progress"). `null` means
 * the Activity is not surfaced in the Feed.
 */
export type ActivityLine = {
  readonly glyph: ActivityGlyph;
  readonly text: string;
};

const asRef = (value: unknown): ActivityRef | null => {
  if (value === null || typeof value !== "object") return null;
  return value as ActivityRef;
};

const asRefList = (value: unknown): readonly ActivityRef[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ActivityRef => item !== null && typeof item === "object");
};

/** Prefer the live name for a record reference, falling back to its snapshot. */
const refName = (ref: ActivityRef | null, resolve: NameResolver): string | null => {
  if (!ref) return null;
  const live = ref.id ? resolve(ref.id) : null;
  return live ?? ref.label ?? null;
};

const priorityLabel = (ref: ActivityRef | null): string | null => {
  if (!ref) return null;
  const value = (ref.value ?? null) as TaskPriority | null;
  if (value === null || value === "no_priority") return null;
  return getPriorityMeta(value).label;
};

const estimateLabel = (ref: ActivityRef | null): string | null => {
  if (!ref) return null;
  const value = (ref.value ?? null) as TaskEstimate | null;
  if (value === null || value === "no_estimate") return null;
  return getEstimateMeta(value).label;
};

const formatLabelList = (refs: readonly ActivityRef[], resolve: NameResolver): string => {
  const names = refs.map((ref) => refName(ref, resolve)).filter((name) => name !== null);
  if (names.length === 0) return "a label";
  if (names.length === 1) return `the ${names[0]} label`;
  return `${names.length} labels`;
};

/**
 * Builds the Feed line for a single Activity, resolving record names against the
 * live collections (preferring current names, falling back to the snapshot in
 * metadata). Returns `null` for Activities that should not appear in the Feed.
 */
export function describeActivity(
  event_type: string,
  rawMetadata: unknown,
  resolvers: ActivityResolvers,
): ActivityLine | null {
  const metadata: ActivityMetadata =
    rawMetadata !== null && typeof rawMetadata === "object"
      ? (rawMetadata as ActivityMetadata)
      : {};
  const from = asRef(metadata.from);
  const to = asRef(metadata.to);

  switch (event_type) {
    case "task.created":
      return { glyph: "created", text: "created this task" };

    case "task.completed":
      return { glyph: "completed", text: "completed this task" };

    case "task.canceled":
      return { glyph: "canceled", text: "canceled this task" };

    case "task.reopened":
      return { glyph: "reopened", text: "reopened this task" };

    case "task.status_changed": {
      const fromName = refName(from, resolvers.status);
      const toName = refName(to, resolvers.status);
      if (toName === null) return { glyph: "status", text: "changed the status" };
      if (fromName === null) return { glyph: "status", text: `set the status to ${toName}` };
      return { glyph: "status", text: `moved this from ${fromName} to ${toName}` };
    }

    case "task.assignee_changed": {
      const toName = refName(to, resolvers.user);
      const fromName = refName(from, resolvers.user);
      if (toName === null) {
        return { glyph: "assignee", text: "removed the assignee" };
      }
      if (fromName === null) {
        return { glyph: "assignee", text: `assigned this to ${toName}` };
      }
      return { glyph: "assignee", text: `re-assigned this to ${toName}` };
    }

    case "task.team_changed": {
      const toName = refName(to, resolvers.team);
      if (toName === null) return { glyph: "team", text: "changed the team" };
      return { glyph: "team", text: `moved this to the ${toName} team` };
    }

    case "task.priority_changed": {
      const toLabel = priorityLabel(to);
      if (toLabel === null) return { glyph: "priority", text: "removed the priority" };
      return { glyph: "priority", text: `set the priority to ${toLabel}` };
    }

    case "task.estimate_changed": {
      const toLabel = estimateLabel(to);
      if (toLabel === null) return { glyph: "estimate", text: "removed the estimate" };
      return { glyph: "estimate", text: `set the estimate to ${toLabel}` };
    }

    case "task.due_date_changed": {
      const toValue = (to?.value ?? null) as string | null;
      if (toValue === null) return { glyph: "due_date", text: "removed the due date" };
      return { glyph: "due_date", text: `set the due date to ${toValue}` };
    }

    case "task.title_changed": {
      const toValue = (to?.value ?? null) as string | null;
      if (toValue === null) return { glyph: "title", text: "renamed this task" };
      return { glyph: "title", text: `renamed this task to "${toValue}"` };
    }

    case "task.cycle_changed":
      return { glyph: "cycle", text: "moved this to a different week" };

    case "task.labels_changed": {
      const added = asRefList(metadata.added);
      const removed = asRefList(metadata.removed);
      if (added.length > 0 && removed.length === 0) {
        return { glyph: "labels", text: `added ${formatLabelList(added, resolvers.label)}` };
      }
      if (removed.length > 0 && added.length === 0) {
        return { glyph: "labels", text: `removed ${formatLabelList(removed, resolvers.label)}` };
      }
      return { glyph: "labels", text: "changed the labels" };
    }

    // Internal / not surfaced in the Feed (board order, parent links, the
    // generic legacy task.updated, and non-task entity events).
    default:
      return null;
  }
}
