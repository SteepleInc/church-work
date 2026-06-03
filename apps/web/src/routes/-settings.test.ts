import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import {
  getChurchProfileSettingsDefaultValues,
  getSettingsSectionIds,
  normalizeOptionalChurchProfileValue,
  normalizeProfileName,
  settingsSections,
} from "@/routes/-settings";

describe("settings route sections", () => {
  it("keeps the copied sectioned settings structure focused on active Church Task areas", () => {
    expect(getSettingsSectionIds()).toEqual(["profile", "church", "members", "invites"]);
    expect(settingsSections.map((section) => section.label)).toEqual([
      "Profile",
      "Church",
      "Members",
      "Invitations",
    ]);
    expect(settingsSections.map((section) => ({ params: section.params, to: section.to }))).toEqual(
      [
        { params: undefined, to: "/settings/profile" },
        { params: undefined, to: "/settings/org" },
        { params: { teamTab: "members" }, to: "/settings/team/$teamTab" },
        { params: { teamTab: "invites" }, to: "/settings/team/$teamTab" },
      ],
    );
  });

  it("does not expose excluded PreachX settings sections", () => {
    expect(getSettingsSectionIds()).not.toContain("billing");
    expect(getSettingsSectionIds()).not.toContain("prompts");
  });

  it("keeps settings navigation in the sidebar instead of a settings card-grid landing", () => {
    const settingsSource = readFileSync("apps/web/src/routes/-settings.tsx", "utf8");
    const appNavigationSource = readFileSync(
      "apps/web/src/components/navigation/app-navigation.tsx",
      "utf8",
    );

    expect(settingsSource).not.toContain('aria-label="Settings sections"');
    expect(settingsSource).not.toContain("md:grid-cols-4");
    expect(appNavigationSource).toContain("<SidebarGroupLabel>Settings</SidebarGroupLabel>");
    expect(appNavigationSource).toContain("settingsNavItems.map");
  });

  it("uses the copied PreachX Team settings route shape with parent tabs", () => {
    const teamRouteSource = readFileSync("apps/web/src/routes/_org/settings.team.tsx", "utf8");
    const teamTabRouteSource = readFileSync(
      "apps/web/src/routes/_org/settings.team.$teamTab.tsx",
      "utf8",
    );
    const teamTabsSource = readFileSync("apps/web/src/features/users/team-tabs.tsx", "utf8");

    expect(teamRouteSource).toContain("<MainContainer>");
    expect(teamRouteSource).toContain('<TeamTabs basePath="/settings/team" />');
    expect(teamRouteSource).toContain("<Outlet />");
    expect(teamTabRouteSource).not.toContain("SettingsFrame");
    expect(teamTabsSource).toContain("<PageTabs");
    expect(teamTabsSource).toContain("<PageTabsList");
    expect(teamTabsSource).toContain("<PageTabsTrigger");
    expect(teamTabsSource).toContain("render={<Link");
    expect(teamTabsSource).not.toContain("params={tab.params}");
    expect(teamTabsSource).toContain("pendingInvitationsCount");
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
