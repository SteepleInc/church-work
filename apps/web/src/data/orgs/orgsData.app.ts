import { queries, type Member, type Organization, type Team } from "@church-task/zero";
import { useQuery as useZeroQuery } from "@rocicorp/zero/react";

import { authClient } from "@/lib/auth-client";
import { FilterKeys } from "@/shared/global-state";
import { useZeroListArgs } from "@/shared/hooks/useZeroListArgs";

export type OrgCollectionItem = {
  readonly id: string;
  readonly name: string;
  readonly slug: string | null;
  readonly completedOnboarding: boolean;
  readonly churchTimeZone: string | null;
  readonly createdAt?: number;
  readonly city?: string | null;
  readonly countryCode?: string | null;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly logo?: string | null;
  readonly membersCount?: number;
  readonly size?: string | null;
  readonly state?: string | null;
  readonly street?: string | null;
  readonly teamsCount?: number;
  readonly url?: string | null;
  readonly zip?: string | null;
};

export function useUserOrgsCollection() {
  const { data: orgRows, isPending } = authClient.useListOrganizations();
  const orgsCollection = (orgRows ?? []).map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug ?? null,
    completedOnboarding: Boolean(org.completedOnboarding),
    churchTimeZone: org.churchTimeZone ?? null,
    city: org.city ?? null,
    countryCode: org.countryCode ?? null,
    createdAt: org.createdAt ? new Date(org.createdAt).getTime() : undefined,
    latitude: org.latitude ?? null,
    logo: org.logo ?? null,
    longitude: org.longitude ?? null,
    size: org.size ?? null,
    state: org.state ?? null,
    street: org.street ?? null,
    url: org.url ?? null,
    zip: org.zip ?? null,
  }));

  return {
    loading: isPending,
    collection: orgsCollection,
    orgsCollection,
  };
}

export const useOrgsCollection = useUserOrgsCollection;

const orgColumnMap = {
  churchTimeZone: "church_time_zone",
  completedOnboarding: "completed_onboarding",
  createdAt: "created_at",
} as const;

const mapOrg = (
  org: Organization,
  members: readonly Member[],
  teams: readonly Team[],
): OrgCollectionItem => ({
  id: org.id,
  name: org.name,
  slug: org.slug ?? null,
  completedOnboarding: Boolean(org.completedOnboarding),
  churchTimeZone: org.churchTimeZone ?? null,
  city: org.city ?? null,
  countryCode: org.countryCode ?? null,
  createdAt: org.createdAt ?? undefined,
  latitude: org.latitude ?? null,
  logo: org.logo ?? null,
  longitude: org.longitude ?? null,
  membersCount: members.filter((member) => member.organizationId === org.id).length,
  size: org.size ?? null,
  state: org.state ?? null,
  street: org.street ?? null,
  teamsCount: teams.filter((team) => team.church_id === org.id).length,
  url: org.url ?? null,
  zip: org.zip ?? null,
});

export function useAllOrgsCollectionWithFilters() {
  const { limit, listArgs, nextPage, pageSize } = useZeroListArgs({
    columnMap: orgColumnMap,
    filterKey: FilterKeys.Orgs,
  });
  const [orgRows] = useZeroQuery(queries.organization.admin_list({ list_args: listArgs }));
  const [memberRows] = useZeroQuery(queries.member.admin_all());
  const [teamRows] = useZeroQuery(queries.teams_admin.admin_all());
  const orgsCollection = orgRows.map((org) => mapOrg(org, memberRows, teamRows));

  return {
    canLoadMore: orgRows.length >= limit,
    limit,
    loading: false,
    loadingMore: false,
    nextPage,
    orgsCollection,
    pageSize,
  };
}

export function useAdminOrgData(params: { readonly orgId: string | null }) {
  const [orgRows] = useZeroQuery(
    queries.organization.admin_list({
      list_args: params.orgId ? { limit: 1, selected_ids: [params.orgId] } : { limit: 0 },
    }),
  );
  const [memberRows] = useZeroQuery(queries.member.admin_all());
  const [teamRows] = useZeroQuery(queries.teams_admin.admin_all());
  const org = orgRows[0] ? mapOrg(orgRows[0], memberRows, teamRows) : null;

  return {
    loading: false,
    orgOpt: org,
  };
}
