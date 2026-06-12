import { api } from "@church-task/backend/convex/_generated/api";
import type { User } from "@church-task/domain";
import { useConvexQuery as useQuery } from "@/data/query-hooks";

import { collectionFromQueryResult } from "@/data/convex-query-adapter";
import { FilterKeys } from "@/shared/global-state";
import { useFilterQuery } from "@/shared/hooks/useFilterQuery";

export type UserCollectionItem = Pick<User, "id" | "name"> & {
  readonly email: User["email"] | null;
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
  const result = useQuery(
    api.dashboard.listMembers,
    params.churchId ? { organizationId: params.churchId } : "skip",
  );
  const state = collectionFromQueryResult(
    result?.map((member) => ({
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      image: null,
      memberId: member.id,
      role: member.role,
      churches: [],
    })) satisfies readonly UserCollectionItem[] | undefined,
  );

  return {
    loading: params.churchId !== null && state.loading,
    collection: state.collection,
    usersCollection: state.collection,
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
