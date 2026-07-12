import {
  hasPaidEntitlements,
  isTaskCountedForUsage,
  paymentGraceEndsAt,
} from "@church-work/domain";
import {
  queries,
  type Member,
  type Organization,
  type Subscription,
  type Team,
} from "@church-work/zero";
import { useQuery as useZeroQuery } from "@rocicorp/zero/react";

import { authClient } from "@/lib/auth-client";
import { FilterKeys } from "@/shared/global-state";
import { useZeroListArgs } from "@/shared/hooks/useZeroListArgs";
import { useIsAppAdmin } from "@/data/users/adminData.app";

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
  readonly billing?: AdminChurchBilling;
  readonly url?: string | null;
  readonly zip?: string | null;
};

export type AdminChurchBilling = {
  readonly plan: "Free" | "Paid";
  readonly status: string | null;
  readonly periodEnd: number | null;
  readonly cancelAtPeriodEnd: boolean;
  readonly cancelAt: number | null;
  readonly canceledAt: number | null;
  readonly endedAt: number | null;
  readonly graceEndsAt: number | null;
  readonly taskUsage?: number;
};

export const toAdminChurchBilling = (
  subscription: Subscription | null,
  taskUsage?: number,
): AdminChurchBilling => ({
  plan: hasPaidEntitlements(subscription) ? "Paid" : "Free",
  status: subscription?.status ?? null,
  periodEnd: subscription?.periodEnd ?? null,
  cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
  cancelAt: subscription?.cancelAt ?? null,
  canceledAt: subscription?.canceledAt ?? null,
  endedAt: subscription?.endedAt ?? null,
  graceEndsAt: subscription ? paymentGraceEndsAt(subscription) : null,
  taskUsage,
});

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
  subscriptions: readonly Subscription[] = [],
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
  billing: toAdminChurchBilling(
    subscriptions.find((subscription) => subscription.referenceId === org.id) ?? null,
  ),
});

export function useAllOrgsCollectionWithFilters() {
  const isAppAdmin = useIsAppAdmin();
  const { limit, listArgs, nextPage, pageSize } = useZeroListArgs({
    columnMap: orgColumnMap,
    filterKey: FilterKeys.Orgs,
  });
  const [orgRows = []] = useZeroQuery(queries.organization.admin_list({ list_args: listArgs }), {
    enabled: isAppAdmin,
  });
  const [memberRows = []] = useZeroQuery(queries.member.admin_all(), { enabled: isAppAdmin });
  const [teamRows = []] = useZeroQuery(queries.teams_admin.admin_all(), { enabled: isAppAdmin });
  const [subscriptionRows = []] = useZeroQuery(queries.subscription.admin_all(), {
    enabled: isAppAdmin,
  });
  const orgsCollection = orgRows.map((org) => mapOrg(org, memberRows, teamRows, subscriptionRows));

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
  const isAppAdmin = useIsAppAdmin();
  const [orgRows = []] = useZeroQuery(
    queries.organization.admin_list({
      list_args: params.orgId ? { limit: 1, selected_ids: [params.orgId] } : { limit: 0 },
    }),
    { enabled: isAppAdmin },
  );
  const [memberRows = []] = useZeroQuery(queries.member.admin_all(), { enabled: isAppAdmin });
  const [teamRows = []] = useZeroQuery(queries.teams_admin.admin_all(), { enabled: isAppAdmin });
  const [subscription] = useZeroQuery(
    params.orgId ? queries.subscription.admin_by_church({ church_id: params.orgId }) : undefined,
    { enabled: isAppAdmin },
  );
  const [tasks = []] = useZeroQuery(
    params.orgId ? queries.tasks.admin_by_church({ church_id: params.orgId }) : undefined,
    { enabled: isAppAdmin },
  );
  const [cycles = []] = useZeroQuery(
    params.orgId ? queries.cycles.admin_by_church({ church_id: params.orgId }) : undefined,
    { enabled: isAppAdmin },
  );
  const cyclesById = new Map(cycles.map((cycle) => [cycle.id, cycle]));
  const taskUsage = tasks.filter((task) => {
    const cycle = task.cycle_id ? cyclesById.get(task.cycle_id) : null;
    return isTaskCountedForUsage({
      cycleDeletedAt: cycle?.deleted_at,
      cycleEndsAt: cycle?.ends_at,
      deletedAt: task.deleted_at,
      taskState: task.task_state,
    });
  }).length;
  const org = orgRows[0]
    ? {
        ...mapOrg(orgRows[0], memberRows, teamRows),
        billing: toAdminChurchBilling(subscription ?? null, taskUsage),
      }
    : null;

  return {
    loading: false,
    orgOpt: org,
  };
}
