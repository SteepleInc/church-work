import { describe, expect, test } from "bun:test";

import { formatTaskIdentifier, parseTaskIdentifier } from "@church-task/domain/Task";

describe("formatTaskIdentifier", () => {
  test("joins the Team Identifier and task number with a dash", () => {
    expect(formatTaskIdentifier("PRD", 48)).toBe("PRD-48");
    expect(formatTaskIdentifier("KID2", 1)).toBe("KID2-1");
  });

  test("normalizes the Team Identifier to the canonical uppercase form", () => {
    expect(formatTaskIdentifier("prd", 48)).toBe("PRD-48");
    expect(formatTaskIdentifier(" prd ", 48)).toBe("PRD-48");
  });
});

describe("parseTaskIdentifier", () => {
  test("round-trips formatted identifiers", () => {
    expect(parseTaskIdentifier(formatTaskIdentifier("PRD", 48))).toEqual({
      teamIdentifier: "PRD",
      taskNumber: 48,
    });
    expect(parseTaskIdentifier(formatTaskIdentifier("ABC1234", 7))).toEqual({
      teamIdentifier: "ABC1234",
      taskNumber: 7,
    });
  });

  test("matches case-insensitively and returns the uppercase canonical form", () => {
    expect(parseTaskIdentifier("prd-48")).toEqual({ teamIdentifier: "PRD", taskNumber: 48 });
    expect(parseTaskIdentifier("Prd-48")).toEqual({ teamIdentifier: "PRD", taskNumber: 48 });
  });

  test("tolerates surrounding whitespace", () => {
    expect(parseTaskIdentifier(" PRD-48 ")).toEqual({ teamIdentifier: "PRD", taskNumber: 48 });
  });

  test("rejects malformed values", () => {
    expect(parseTaskIdentifier("")).toBeNull();
    expect(parseTaskIdentifier("PRD")).toBeNull();
    expect(parseTaskIdentifier("PRD-")).toBeNull();
    expect(parseTaskIdentifier("-48")).toBeNull();
    expect(parseTaskIdentifier("PRD-48-2")).toBeNull();
    expect(parseTaskIdentifier("PR D-48")).toBeNull();
    expect(parseTaskIdentifier("PRD-4a")).toBeNull();
  });

  test("rejects Team Identifiers longer than the max length", () => {
    expect(parseTaskIdentifier("ABCD1234-48")).toBeNull();
  });

  test("rejects zero and unsafe numbers", () => {
    expect(parseTaskIdentifier("PRD-0")).toBeNull();
    expect(parseTaskIdentifier("PRD-99999999999999999999")).toBeNull();
  });
});
