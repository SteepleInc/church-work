import type { CurrentOrg } from "@/data/orgs/orgData.app";

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
