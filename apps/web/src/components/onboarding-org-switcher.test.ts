import { describe, expect, test } from "bun:test";

import { getOnboardingOrgSwitcherLabel } from "./org-switcher-utils";

describe("OnboardingOrgSwitcher", () => {
  test("shows creating-new-Church state when there is no active Church", () => {
    expect(getOnboardingOrgSwitcherLabel({ currentOrgName: null })).toBe("Creating new Church...");
  });

  test("shows active Church name when one is selected", () => {
    expect(getOnboardingOrgSwitcherLabel({ currentOrgName: "Grace Church" })).toBe("Grace Church");
  });
});
