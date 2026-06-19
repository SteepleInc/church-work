import { describe, expect, it } from "bun:test";

import { canManageKeyDates } from "@/features/settings/key-date-settings";

describe("Key Date settings permissions", () => {
  it("lets every active Church member manage Key Dates in v1", () => {
    expect(canManageKeyDates("owner")).toBe(true);
    expect(canManageKeyDates("admin")).toBe(true);
    expect(canManageKeyDates("member")).toBe(true);
  });

  it("requires an active Church membership before managing Key Dates", () => {
    expect(canManageKeyDates(null)).toBe(false);
    expect(canManageKeyDates(undefined)).toBe(false);
  });
});
