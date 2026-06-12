import { describe, expect, test } from "bun:test";

import {
  deriveTeamIdentifierBase,
  generateTeamIdentifier,
  isValidTeamIdentifier,
  normalizeTeamIdentifier,
  TEAM_IDENTIFIER_MAX_LENGTH,
} from "@church-task/domain/Team";

describe("deriveTeamIdentifierBase", () => {
  test("takes the first three alphanumeric characters, uppercased", () => {
    expect(deriveTeamIdentifierBase("Production")).toBe("PRO");
    expect(deriveTeamIdentifierBase("Social Media")).toBe("SOC");
    expect(deriveTeamIdentifierBase("kids")).toBe("KID");
  });

  test("skips non-alphanumeric characters", () => {
    expect(deriveTeamIdentifierBase("A/V Crew")).toBe("AVC");
    expect(deriveTeamIdentifierBase("  worship  ")).toBe("WOR");
  });

  test("keeps digits", () => {
    expect(deriveTeamIdentifierBase("3rd Grade")).toBe("3RD");
  });

  test("short names yield shorter bases", () => {
    expect(deriveTeamIdentifierBase("Go")).toBe("GO");
    expect(deriveTeamIdentifierBase("X")).toBe("X");
  });

  test("names with no alphanumeric characters fall back to TEAM", () => {
    expect(deriveTeamIdentifierBase("!!!")).toBe("TEAM");
    expect(deriveTeamIdentifierBase("")).toBe("TEAM");
  });
});

describe("generateTeamIdentifier", () => {
  test("uses the base when it is free", () => {
    expect(generateTeamIdentifier("Production", [])).toBe("PRO");
  });

  test("bumps deterministically on collision", () => {
    expect(generateTeamIdentifier("Kids", ["KID"])).toBe("KID2");
    expect(generateTeamIdentifier("Kids", ["KID", "KID2"])).toBe("KID3");
    expect(generateTeamIdentifier("Kids", ["KID", "KID2", "KID3"])).toBe("KID4");
  });

  test("treats taken identifiers case-insensitively", () => {
    expect(generateTeamIdentifier("Kids", ["kid"])).toBe("KID2");
  });

  test("colliding short names bump too", () => {
    expect(generateTeamIdentifier("Go", ["GO"])).toBe("GO2");
  });

  test("bumped candidates never exceed the max length", () => {
    const taken = ["KID", ...Array.from({ length: 9999 }, (_, i) => `KID${i + 2}`)].map((value) =>
      value.slice(0, TEAM_IDENTIFIER_MAX_LENGTH),
    );
    const generated = generateTeamIdentifier("Kids", taken);
    expect(generated.length).toBeLessThanOrEqual(TEAM_IDENTIFIER_MAX_LENGTH);
    expect(taken).not.toContain(generated);
  });
});

describe("normalizeTeamIdentifier", () => {
  test("trims and uppercases to the canonical form", () => {
    expect(normalizeTeamIdentifier(" prd ")).toBe("PRD");
    expect(normalizeTeamIdentifier("PRD")).toBe("PRD");
  });
});

describe("isValidTeamIdentifier", () => {
  test("accepts 1-7 uppercase alphanumeric characters", () => {
    expect(isValidTeamIdentifier("P")).toBe(true);
    expect(isValidTeamIdentifier("PRD")).toBe(true);
    expect(isValidTeamIdentifier("ABC1234")).toBe(true);
  });

  test("rejects empty, lowercase, too-long, and symbol-bearing values", () => {
    expect(isValidTeamIdentifier("")).toBe(false);
    expect(isValidTeamIdentifier("prd")).toBe(false);
    expect(isValidTeamIdentifier("ABCD1234")).toBe(false);
    expect(isValidTeamIdentifier("PR-D")).toBe(false);
    expect(isValidTeamIdentifier("PR D")).toBe(false);
  });
});
