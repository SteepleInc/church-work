import { describe, expect, test } from "bun:test";

import {
  normalizeDraftEstimate,
  normalizeDraftPriority,
  parseDraftLabelIds,
} from "./task-draft-values";

describe("parseDraftLabelIds", () => {
  test("parses a JSON array of string ids", () => {
    expect(parseDraftLabelIds('["a","b"]')).toEqual(["a", "b"]);
  });

  test("treats null / undefined / empty as no labels", () => {
    expect(parseDraftLabelIds(null)).toEqual([]);
    expect(parseDraftLabelIds(undefined)).toEqual([]);
    expect(parseDraftLabelIds("[]")).toEqual([]);
  });

  test("drops non-string entries and survives malformed JSON", () => {
    expect(parseDraftLabelIds('["a",1,null,"b"]')).toEqual(["a", "b"]);
    expect(parseDraftLabelIds("not json")).toEqual([]);
    expect(parseDraftLabelIds('{"a":1}')).toEqual([]);
  });
});

describe("normalizeDraftPriority", () => {
  test("passes through known priorities", () => {
    for (const value of ["urgent", "high", "medium", "low"] as const) {
      expect(normalizeDraftPriority(value)).toBe(value);
    }
  });

  test("falls back to no_priority for unknown / missing values", () => {
    expect(normalizeDraftPriority(null)).toBe("no_priority");
    expect(normalizeDraftPriority(undefined)).toBe("no_priority");
    expect(normalizeDraftPriority("no_priority")).toBe("no_priority");
    expect(normalizeDraftPriority("bogus")).toBe("no_priority");
  });
});

describe("normalizeDraftEstimate", () => {
  test("passes through known estimates", () => {
    for (const value of ["xs", "s", "m", "l", "xl"] as const) {
      expect(normalizeDraftEstimate(value)).toBe(value);
    }
  });

  test("falls back to no_estimate for unknown / missing values", () => {
    expect(normalizeDraftEstimate(null)).toBe("no_estimate");
    expect(normalizeDraftEstimate(undefined)).toBe("no_estimate");
    expect(normalizeDraftEstimate("no_estimate")).toBe("no_estimate");
    expect(normalizeDraftEstimate("xxl")).toBe("no_estimate");
  });
});
