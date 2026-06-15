import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import {
  accountNavGroup,
  administrationNavGroup,
  settingsNavGroups,
} from "@/features/settings/settings-nav-items";
import {
  getChurchProfileSettingsDefaultValues,
  normalizeOptionalChurchProfileValue,
  normalizeProfileName,
} from "@/routes/-settings-utils";

describe("Linear-style settings navigation", () => {
  it("groups static settings sections like Linear (Account, Administration)", () => {
    expect(settingsNavGroups.map((group) => group.label)).toEqual(["Account", "Administration"]);
    expect(accountNavGroup.items.map((item) => item.to)).toEqual(["/settings/account/profile"]);
    expect(administrationNavGroup.items.map((item) => item.to)).toEqual([
      "/settings/workspace/general",
      "/settings/workspace/members",
      "/settings/workspace/labels",
    ]);
  });

  it("renders settings as a full-screen takeover with a dedicated sidebar", () => {
    const shellSource = readFileSync(
      new URL("../features/settings/settings-shell.tsx", import.meta.url),
      "utf8",
    );
    const sidebarSource = readFileSync(
      new URL("../features/settings/settings-sidebar.tsx", import.meta.url),
      "utf8",
    );

    expect(shellSource).toContain("<SettingsSidebar />");
    expect(shellSource).toContain("useAuthGuard");
    expect(sidebarSource).toContain("Back to app");
    expect(sidebarSource).toContain("Your teams");
  });

  it("removes settings from the app sidebar in favor of the org picker entry point", () => {
    const appNavigationSource = readFileSync(
      new URL("../components/navigation/app-navigation.tsx", import.meta.url),
      "utf8",
    );
    const orgSwitcherSource = readFileSync(
      new URL("../components/org-switcher.tsx", import.meta.url),
      "utf8",
    );

    expect(appNavigationSource).not.toContain("<SidebarGroupLabel>Settings</SidebarGroupLabel>");
    expect(appNavigationSource).not.toContain("settingsNavItems");
    expect(orgSwitcherSource).toContain('to: "/settings/account/profile"');
  });

  it("composes Profile and Church settings with the copied CardForm", () => {
    const settingsSource = readFileSync(new URL("./-settings.tsx", import.meta.url), "utf8");

    expect(settingsSource).toContain('import { CardForm } from "@/components/form/card-form"');
    expect(settingsSource.match(/<CardForm/g)?.length).toBe(2);
  });

  it("normalizes profile names like the copied profile settings form", () => {
    expect(normalizeProfileName("  Jane   Q.   Member  ")).toBe("Jane Q. Member");
  });

  it("normalizes optional Church profile values before updating Better Auth custom fields", () => {
    expect(normalizeOptionalChurchProfileValue("  https://example.org  ")).toBe(
      "https://example.org",
    );
    expect(normalizeOptionalChurchProfileValue("   ")).toBeUndefined();
    expect(normalizeOptionalChurchProfileValue("none")).toBeUndefined();
  });

  it("builds editable Church profile defaults from the active Church", () => {
    expect(
      getChurchProfileSettingsDefaultValues({
        churchTimeZone: "America/Chicago",
        city: "Nashville",
        completedOnboarding: true,
        countryCode: "US",
        currentUserId: "user_1",
        id: "org_1",
        invitations: [],
        latitude: null,
        longitude: null,
        name: "Grace Church",
        role: "owner",
        size: null,
        slug: "grace-church",
        state: "TN",
        street: "123 Main Street",
        url: "https://example.org",
        zip: "37203",
      }),
    ).toMatchObject({
      churchTimeZone: "America/Chicago",
      city: "Nashville",
      countryCode: "US",
      name: "Grace Church",
      size: "none",
      state: "TN",
      street: "123 Main Street",
      url: "https://example.org",
      zip: "37203",
    });
  });
});
