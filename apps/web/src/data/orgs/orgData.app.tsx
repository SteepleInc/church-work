import { nullOp } from "@church-work/shared/noOps";
import type { ReactNode } from "react";

import { recordFromCollection } from "@/data/collection-query-state";
import { useUserOrgsCollection, type OrgCollectionItem } from "@/data/orgs/orgsData.app";
import { useSession } from "@/hooks/use-session";
import { authClient } from "@/lib/auth-client";

export type CurrentOrg = {
  readonly id: string;
  readonly name: string;
  readonly slug: string | null;
  readonly churchTimeZone: string | null;
  readonly rollingMaterializationWindowCycles: number;
  readonly completedOnboarding: boolean;
  readonly url: string | null;
  readonly street: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly zip: string | null;
  readonly countryCode: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly size: string | null;
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
  const { data: activeOrg, isPending } = authClient.useActiveOrganization();
  const { isPending: sessionPending, session } = useSession();
  const activeMember = activeOrg?.members?.find((member) => member.userId === session?.user?.id);
  const currentOrgOpt: CurrentOrg | null = activeOrg
    ? {
        id: activeOrg.id,
        name: activeOrg.name,
        slug: activeOrg.slug ?? null,
        churchTimeZone: activeOrg.churchTimeZone ?? null,
        rollingMaterializationWindowCycles:
          (activeOrg as { readonly rollingMaterializationWindowCycles?: number | null })
            .rollingMaterializationWindowCycles ?? 3,
        completedOnboarding: Boolean(activeOrg.completedOnboarding),
        url: activeOrg.url ?? null,
        street: activeOrg.street ?? null,
        city: activeOrg.city ?? null,
        state: activeOrg.state ?? null,
        zip: activeOrg.zip ?? null,
        countryCode: activeOrg.countryCode ?? null,
        latitude: activeOrg.latitude ?? null,
        longitude: activeOrg.longitude ?? null,
        size: activeOrg.size ?? null,
        role: activeMember?.role ?? "member",
        currentUserId: session?.user?.id ?? "",
        invitations:
          activeOrg.invitations?.map((invitation) => ({
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            status: invitation.status,
          })) ?? [],
      }
    : null;

  return {
    loading: isPending || sessionPending,
    currentOrgOpt,
  };
}

export function useUpdateChurchTimeZoneMutation() {
  return async (params: { readonly churchId: string; readonly churchTimeZone: string }) => {
    const result = await authClient.organization.update({
      data: { churchTimeZone: params.churchTimeZone },
      organizationId: params.churchId,
    });

    if (result.error) {
      return {
        error: { message: result.error.message ?? "Could not update Church Time Zone." },
        ok: false,
      } as const;
    }

    return {
      data: { church: { churchTimeZone: params.churchTimeZone } },
      ok: true,
    } as const;
  };
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
