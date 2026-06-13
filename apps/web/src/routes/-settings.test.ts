import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import {
  getChurchProfileSettingsDefaultValues,
  getSettingsSectionIds,
  normalizeOptionalChurchProfileValue,
  normalizeProfileName,
  settingsSections,
} from "@/routes/-settings-utils";

describe("settings route sections", () => {
  it("keeps the copied sectioned settings structure focused on active Church Task areas", () => {
    expect(getSettingsSectionIds()).toEqual(["profile", "church", "members", "invites", "labels"]);
    expect(settingsSections.map((section) => section.label)).toEqual([
      "Profile",
      "Church",
      "Members",
      "Invitations",
      "Labels",
    ]);
    expect(settingsSections.map((section) => ({ params: section.params, to: section.to }))).toEqual(
      [
        { params: undefined, to: "/settings/profile" },
        { params: undefined, to: "/settings/org" },
        { params: { teamTab: "members" }, to: "/settings/team/$teamTab" },
        { params: { teamTab: "invites" }, to: "/settings/team/$teamTab" },
        { params: undefined, to: "/settings/labels" },
      ],
    );
  });

  it("does not expose excluded PreachX settings sections", () => {
    expect(getSettingsSectionIds()).not.toContain("billing");
    expect(getSettingsSectionIds()).not.toContain("prompts");
  });

  it("keeps settings navigation in the sidebar instead of a settings card-grid landing", () => {
    const settingsSource = readFileSync(new URL("./-settings.tsx", import.meta.url), "utf8");
    const appNavigationSource = readFileSync(
      new URL("../components/navigation/app-navigation.tsx", import.meta.url),
      "utf8",
    );

    expect(settingsSource).not.toContain('aria-label="Settings sections"');
    expect(settingsSource).not.toContain("md:grid-cols-4");
    expect(appNavigationSource).toContain("<SidebarGroupLabel>Settings</SidebarGroupLabel>");
    expect(appNavigationSource).toContain("settingsNavItems.map");
  });

  it("uses the copied PreachX Team settings route shape with parent tabs", () => {
    const teamRouteSource = readFileSync(
      new URL("./_org/settings.team.tsx", import.meta.url),
      "utf8",
    );
    const teamTabRouteSource = readFileSync(
      new URL("./_org/settings.team.$teamTab.tsx", import.meta.url),
      "utf8",
    );
    const teamTabsSource = readFileSync(
      new URL("../features/users/team-tabs.tsx", import.meta.url),
      "utf8",
    );

    expect(teamRouteSource).toContain("<MainContainer>");
    expect(teamRouteSource).toContain('<TeamTabs basePath="/settings/team" className="px-0" />');
    expect(teamRouteSource).toContain("<Outlet />");
    expect(teamTabRouteSource).not.toContain("SettingsFrame");
    expect(teamTabsSource).toContain("<PageTabs");
    expect(teamTabsSource).toContain("<PageTabsList");
    expect(teamTabsSource).toContain("<PageTabsTrigger");
    expect(teamTabsSource).toContain("render={<Link");
    expect(teamTabsSource).not.toContain("params={tab.params}");
    expect(teamTabsSource).toContain("pendingInvitationsCount");
  });

  it("composes Profile and Church settings with copied PreachX CardForm", () => {
    const settingsSource = readFileSync(new URL("./-settings.tsx", import.meta.url), "utf8");
    const cardFormSource = readFileSync(
      new URL("../components/form/card-form.tsx", import.meta.url),
      "utf8",
    );

    expect(settingsSource).toContain('import { CardForm } from "@/components/form/card-form"');
    expect(settingsSource.match(/<CardForm/g)?.length).toBe(2);
    expect(cardFormSource).toContain('className={cn("flex w-full flex-col items-stretch gap-0"');
    expect(cardFormSource).toContain('orientation="vertical"');
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
