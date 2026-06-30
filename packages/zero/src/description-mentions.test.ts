import { describe, expect, test } from "vitest";
import { extractDescriptionMentions } from "./description-mentions";

const doc = (...children: unknown[]) => JSON.stringify(children);

const userMention = (userId: string) => ({
  type: "mention",
  mentionKind: "user",
  userId,
  value: "Display",
  children: [{ text: "" }],
});

const taskMention = (taskId: string) => ({
  type: "mention",
  mentionKind: "task",
  taskId,
  taskIdentifier: "DEV-1",
  value: "DEV-1",
  children: [{ text: "" }],
});

const paragraph = (...inline: unknown[]) => ({ type: "p", children: inline });

describe("extractDescriptionMentions", () => {
  test("returns no mentions for empty, null, or legacy plain-text descriptions", () => {
    expect(extractDescriptionMentions(null, "task_self")).toEqual([]);
    expect(extractDescriptionMentions("", "task_self")).toEqual([]);
    expect(extractDescriptionMentions("just some plain text", "task_self")).toEqual([]);
  });

  test("extracts typed user and task edges from nested nodes", () => {
    const description = doc(
      paragraph(
        { text: "Hey " },
        userMention("user_jane"),
        { text: " see " },
        taskMention("task_42"),
      ),
    );

    expect(extractDescriptionMentions(description, "task_self")).toEqual([
      { kind: "user", targetUserId: "user_jane" },
      { kind: "task", targetTaskId: "task_42" },
    ]);
  });

  test("dedupes repeated mentions and drops self-task mentions", () => {
    const description = doc(
      paragraph(userMention("user_jane"), userMention("user_jane")),
      paragraph(taskMention("task_self"), taskMention("task_42"), taskMention("task_42")),
    );

    expect(extractDescriptionMentions(description, "task_self")).toEqual([
      { kind: "user", targetUserId: "user_jane" },
      { kind: "task", targetTaskId: "task_42" },
    ]);
  });

  test("ignores mention nodes missing their target id", () => {
    const description = doc(
      paragraph(
        { type: "mention", mentionKind: "user", value: "Ghost", children: [{ text: "" }] },
        { type: "mention", mentionKind: "task", taskId: "  ", children: [{ text: "" }] },
      ),
    );

    expect(extractDescriptionMentions(description, "task_self")).toEqual([]);
  });
});
