import { nullOp } from "@church-task/shared/noOps";
import { api } from "@church-task/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import type { ReactNode } from "react";

import { recordFromCollection, recordFromQueryResult } from "@/data/convex-query-adapter";
import { useUserOrgsCollection, type OrgCollectionItem } from "@/data/orgs/orgsData.app";

export type CurrentOrg = {
  readonly id: string;
  readonly name: string;
  readonly slug: string | null;
  readonly churchTimeZone: string | null;
  readonly role: string;
  readonly currentUserId: string;
  readonly invitations: readonly {
    readonly id: string;
    readonly email: string;
    readonly role: string;
    readonly status: string;
  }[];
};

export function useOrgData(params: { readonly orgId: string }) {
  const orgs = useUserOrgsCollection();
  const state = recordFromCollection(orgs, (org) => org.id === params.orgId);

  return {
    loading: state.loading,
    orgOpt: state.record,
  };
}

export function useCurrentOrgOpt() {
  const activeOrg = useQuery(api.dashboard.getActiveOrganization);
  const state = recordFromQueryResult<CurrentOrg>(activeOrg);

  return {
    loading: state.loading,
    currentOrgOpt: state.record,
  };
}

export function useUpdateChurchTimeZoneMutation() {
  return useMutation(api.churchSettings.updateTimeZone);
}

export function CurrentOrgWrapper(props: { readonly children: (org: CurrentOrg) => ReactNode }) {
  const { currentOrgOpt } = useCurrentOrgOpt();

  return currentOrgOpt ? props.children(currentOrgOpt) : nullOp();
}

export function OrgWrapper(props: {
  readonly orgId: string;
  readonly children: (org: OrgCollectionItem) => ReactNode;
}) {
  const { orgOpt } = useOrgData({ orgId: props.orgId });

  return orgOpt ? props.children(orgOpt) : nullOp();
}
