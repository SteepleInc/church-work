import { describe, expect, test } from "bun:test";

import { getOrgSwitchTarget } from "./org-routing";

describe("Org switching route behavior", () => {
  test("routes completed Churches to My Work", () => {
    expect(getOrgSwitchTarget({ completedOnboarding: true })).toBe("/my-work");
  });

  test("routes incomplete Churches to onboarding", () => {
    expect(getOrgSwitchTarget({ completedOnboarding: false })).toBe("/onboarding");
  });
});
