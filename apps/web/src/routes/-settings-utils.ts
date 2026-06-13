import type { CurrentOrg } from "@/data/orgs/orgData.app";

type SettingsSection = "profile" | "church" | "members" | "invites" | "labels";

export const settingsSections: readonly {
  readonly id: SettingsSection;
  readonly label: string;
  readonly description: string;
  readonly to:
    | "/settings/profile"
    | "/settings/org"
    | "/settings/team/$teamTab"
    | "/settings/labels";
  readonly params?: { readonly teamTab: "members" | "invites" };
}[] = [
  {
    id: "profile",
    label: "Profile",
    description: "Your user account and support details.",
    to: "/settings/profile",
  },
  {
    id: "church",
    label: "Church",
    description: "Church profile and cycle configuration.",
    to: "/settings/org",
  },
  {
    id: "members",
    label: "Members",
    description: "Church members, Teams, and Team membership.",
    params: { teamTab: "members" },
    to: "/settings/team/$teamTab",
  },
  {
    id: "invites",
    label: "Invitations",
    description: "Invite members and review pending invitations.",
    params: { teamTab: "invites" },
    to: "/settings/team/$teamTab",
  },
  {
    id: "labels",
    label: "Labels",
    description: "Labels for categorizing Tasks across the Church.",
    to: "/settings/labels",
  },
];

export function getSettingsSectionIds() {
  return settingsSections.map((section) => section.id);
}

export function normalizeProfileName(value: string) {
  return value.trim().replaceAll(/\s+/g, " ");
}

export function normalizeOptionalChurchProfileValue(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue.length === 0 || trimmedValue === "none" ? undefined : trimmedValue;
}

export function getChurchProfileSettingsDefaultValues(activeChurch: CurrentOrg) {
  return {
    churchTimeZone: activeChurch.churchTimeZone ?? detectedChurchTimeZone(),
    city: activeChurch.city ?? "",
    countryCode: activeChurch.countryCode ?? "",
    name: activeChurch.name,
    size: activeChurch.size ?? "none",
    state: activeChurch.state ?? "",
    street: activeChurch.street ?? "",
    url: activeChurch.url ?? "",
    zip: activeChurch.zip ?? "",
  };
}

function detectedChurchTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
}
