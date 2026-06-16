import { api } from "@church-task/backend-old/convex/_generated/api";

import { authClient } from "@/lib/auth-client";
import { FilterKeys } from "@/shared/global-state";
import { useFilterQuery } from "@/shared/hooks/useFilterQuery";

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

export function useAllUsersCollectionWithFilters() {
  const {
    result: usersCollection,
    info,
    nextPage,
    pageSize,
    limit,
  } = useFilterQuery<UserCollectionItem>({
    filterKey: FilterKeys.Users,
    query: api.admin.listAllUsers,
  });

  return {
    canLoadMore: info === "CanLoadMore",
    limit,
    loading: info === "LoadingFirstPage",
    loadingMore: info === "LoadingMore",
    nextPage,
    pageSize,
    usersCollection,
  };
}
