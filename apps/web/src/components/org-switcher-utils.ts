import type { OrgCollectionItem } from "@/data/orgs/orgsData.app";

export function getFilteredOrgSwitcherItems(params: {
  readonly orgs: readonly OrgCollectionItem[];
  readonly search: string;
}) {
  const search = params.search.trim().toLocaleLowerCase();

  if (!search) {
    return [...params.orgs];
  }

  return params.orgs.filter((org) => org.name.toLocaleLowerCase().includes(search));
}

export function getOnboardingOrgSwitcherLabel(params: { readonly currentOrgName: string | null }) {
  return params.currentOrgName ?? "Creating new Church...";
}
