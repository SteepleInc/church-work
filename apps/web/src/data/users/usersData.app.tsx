import { queries, type Member, type Organization, type User } from "@church-task/zero";
import { useQuery } from "@rocicorp/zero/react";

import { authClient } from "@/lib/auth-client";
import { FilterKeys } from "@/shared/global-state";
import { useZeroListArgs } from "@/shared/hooks/useZeroListArgs";

export type UserCollectionItem = {
  readonly id: string;
  readonly name: string | null;
  readonly email: string | null;
  readonly image?: string | null;
  readonly createdAt?: number;
  readonly memberId?: string;
  readonly role?: string;
  readonly churches: readonly {
    readonly id: string;
    readonly name: string;
    readonly slug: string | null;
    readonly role: string;
  }[];
};

export function getUserDisplayName(user: Pick<UserCollectionItem, "id" | "name" | "email">) {
  const name = user.name?.trim();
  if (name) return name;

  const email = user.email?.trim();
  return email || user.id;
}

export function useChurchUsersCollection(params: { readonly churchId: string | null }) {
  const { data: activeOrg, isPending: activeOrgPending } = authClient.useActiveOrganization();
  const session = authClient.useSession();
  const members = activeOrg?.id === params.churchId ? (activeOrg.members ?? []) : [];
  const collection = members.map((member) => {
    const user = "user" in member ? member.user : null;
    const id = user?.id ?? member.userId;
    const email = user?.email ?? (id === session.data?.user?.id ? session.data.user.email : null);
    const name = user?.name ?? (id === session.data?.user?.id ? session.data.user.name : null);

    return {
      id,
      name,
      email,
      image: user?.image ?? null,
      memberId: member.id,
      role: member.role,
      churches: [],
    } satisfies UserCollectionItem;
  });

  return {
    loading: params.churchId !== null && (activeOrgPending || session.isPending),
    collection,
    usersCollection: collection,
  };
}

const userColumnMap = {
  createdAt: "created_at",
} as const;

export const mapAdminUser = (
  user: User,
  members: readonly Member[],
  orgsById: ReadonlyMap<string, Organization>,
): UserCollectionItem => ({
  id: user.id,
  name: user.name,
  email: user.email,
  image: user.image ?? null,
  createdAt: user.createdAt ?? undefined,
  role: user.role ?? undefined,
  churches: members
    .filter((member) => member.userId === user.id)
    .map((member) => {
      const org = orgsById.get(member.organizationId);

      return {
        id: member.organizationId,
        name: org?.name ?? member.organizationId,
        role: member.role,
        slug: org?.slug ?? null,
      };
    }),
});

export function useAllUsersCollectionWithFilters() {
  const { limit, listArgs, nextPage, pageSize } = useZeroListArgs({
    columnMap: userColumnMap,
    filterKey: FilterKeys.Users,
  });
  const [userRows] = useQuery(queries.user.admin_list({ list_args: listArgs }));
  const [memberRows] = useQuery(queries.member.admin_all());
  const [orgRows] = useQuery(queries.organization.admin_list({ list_args: { limit: 500 } }));
  const orgsById = new Map(orgRows.map((org) => [org.id, org]));
  const usersCollection = userRows.map((user) => mapAdminUser(user, memberRows, orgsById));

  return {
    canLoadMore: userRows.length >= limit,
    limit,
    loading: false,
    loadingMore: false,
    nextPage,
    pageSize,
    usersCollection,
  };
}
