import { describe, expect, it } from "bun:test";

import { getSettingsSectionIds, settingsSections } from "@/routes/-settings";

describe("settings route sections", () => {
  it("keeps the copied sectioned settings structure focused on active Church Task areas", () => {
    expect(getSettingsSectionIds()).toEqual(["profile", "church", "members", "invites"]);
    expect(settingsSections.map((section) => section.label)).toEqual([
      "Profile",
      "Church",
      "Members",
      "Invitations",
    ]);
  });

  it("does not expose excluded PreachX settings sections", () => {
    expect(getSettingsSectionIds()).not.toContain("billing");
    expect(getSettingsSectionIds()).not.toContain("prompts");
  });
});
