/**
 * Server-side extraction of the mention graph from a Task `description`.
 *
 * The description is stored as serialized Plate JSON (see
 * `apps/web/src/components/editor/description-value.ts`). Mention pills are
 * inline element nodes shaped like:
 *
 *   { type: "mention", mentionKind: "user", userId: "user_...", value: "Jane" }
 *   { type: "mention", mentionKind: "task", taskId: "task_...", value: "DEV-5" }
 *
 * We never trust the editor to compute edges; instead we re-derive them here so
 * the `task_mentions` table is the single source of truth for both "mentioned
 * in" backlinks and mention notifications. This module has no Plate dependency
 * on purpose — it walks plain JSON so it can run inside the Zero mutator on
 * server and client.
 */

/** The Plate element `type` used for mention pills (`KEYS.mention`). */
const MENTION_NODE_TYPE = "mention";

export type ExtractedMention =
  | { readonly kind: "user"; readonly targetUserId: string }
  | { readonly kind: "task"; readonly targetTaskId: string };

type UnknownRecord = { readonly [key: string]: unknown };

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const asNonEmptyString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

const mentionFromNode = (node: UnknownRecord): ExtractedMention | null => {
  if (node.type !== MENTION_NODE_TYPE) return null;

  if (node.mentionKind === "user") {
    const targetUserId = asNonEmptyString(node.userId);

    return targetUserId ? { kind: "user", targetUserId } : null;
  }
  if (node.mentionKind === "task") {
    const targetTaskId = asNonEmptyString(node.taskId);

    return targetTaskId ? { kind: "task", targetTaskId } : null;
  }

  return null;
};

const walk = (node: unknown, sink: (mention: ExtractedMention) => void): void => {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, sink);

    return;
  }
  if (!isRecord(node)) return;

  const mention = mentionFromNode(node);
  if (mention) sink(mention);

  if (Array.isArray(node.children)) {
    for (const child of node.children) walk(child, sink);
  }
};

/**
 * Parses a serialized Plate description and returns the distinct mention edges
 * it contains. Self-task mentions (a Task mentioning itself) are dropped so a
 * Task never backlinks to itself. Returns an empty array for empty / legacy
 * plain-text / unparseable descriptions.
 */
export const extractDescriptionMentions = (
  description: string | null | undefined,
  sourceTaskId: string,
): readonly ExtractedMention[] => {
  if (!description) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(description);
  } catch {
    // Legacy plain-text descriptions never carried structured mentions.
    return [];
  }

  const seenUsers = new Set<string>();
  const seenTasks = new Set<string>();
  const mentions: ExtractedMention[] = [];

  walk(parsed, (mention) => {
    if (mention.kind === "user") {
      if (seenUsers.has(mention.targetUserId)) return;
      seenUsers.add(mention.targetUserId);
      mentions.push(mention);

      return;
    }
    if (mention.targetTaskId === sourceTaskId) return;
    if (seenTasks.has(mention.targetTaskId)) return;
    seenTasks.add(mention.targetTaskId);
    mentions.push(mention);
  });

  return mentions;
};
