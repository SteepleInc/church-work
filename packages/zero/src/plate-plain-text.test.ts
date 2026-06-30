import { describe, expect, test } from "vitest";
import { plateValueToPlainText } from "./plate-plain-text";

const doc = (...children: unknown[]) => JSON.stringify(children);

const userMention = (value: string) => ({
  type: "mention",
  mentionKind: "user",
  userId: "user_1",
  value,
  children: [{ text: "" }],
});

const taskMention = (value: string) => ({
  type: "mention",
  mentionKind: "task",
  taskId: "task_1",
  taskIdentifier: value,
  value,
  children: [{ text: "" }],
});

const paragraph = (...inline: unknown[]) => ({ type: "p", children: inline });

describe("plateValueToPlainText", () => {
  test("returns empty string for empty or null bodies", () => {
    expect(plateValueToPlainText(null)).toBe("");
    expect(plateValueToPlainText("")).toBe("");
  });

  test("passes legacy plain-text bodies through unchanged", () => {
    expect(plateValueToPlainText("just plain text")).toBe("just plain text");
  });

  test("concatenates inline text and renders mention labels", () => {
    const body = doc(
      paragraph({ text: "Hey " }, userMention("Jane"), { text: ", see " }, taskMention("DEV-12")),
    );

    expect(plateValueToPlainText(body)).toBe("Hey @Jane, see DEV-12");
  });

  test("joins block nodes with newlines and trims", () => {
    const body = doc(paragraph({ text: "First line" }), paragraph({ text: "Second line" }));

    expect(plateValueToPlainText(body)).toBe("First line\nSecond line");
  });
});
