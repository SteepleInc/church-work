import { nullOp } from "@church-task/shared/noOps";
import { api } from "@church-task/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import type { ReactNode } from "react";

import { recordFromCollection, recordFromQueryResult } from "@/data/convex-query-adapter";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useChurchUsersCollection, type UserCollectionItem } from "@/data/users/usersData.app";

export function useCurrentUserOpt() {
  const { currentOrgOpt, loading: orgLoading } = useCurrentOrgOpt();
  const users = useChurchUsersCollection({ churchId: currentOrgOpt?.id ?? null });
  const state = recordFromCollection(
    users,
    (user) => user.id === (currentOrgOpt?.currentUserId ?? ""),
  );

  return {
    loading: orgLoading || state.loading,
    currentUserOpt: state.record,
  };
}

export function useUserOpt(params: { readonly churchId: string | null; readonly userId: string }) {
  const users = useChurchUsersCollection({ churchId: params.churchId });
  const state = recordFromCollection(users, (user) => user.id === params.userId);

  return {
    loading: state.loading,
    userOpt: state.record,
  };
}

export function useUserData(params: { readonly userId: string }) {
  const result = useQuery(api.admin.getUser, { userId: params.userId });
  const state = recordFromQueryResult<UserCollectionItem>(result);

  return {
    loading: state.loading,
    userOpt: state.record,
  };
}

export function CurrentUserWrapper(props: {
  readonly children: (user: UserCollectionItem) => ReactNode;
}) {
  const { currentUserOpt } = useCurrentUserOpt();

  return currentUserOpt ? props.children(currentUserOpt) : nullOp();
}

export function UserWrapper(props: {
  readonly churchId: string | null;
  readonly userId: string;
  readonly children: (user: UserCollectionItem) => ReactNode;
}) {
  const { userOpt } = useUserOpt({ churchId: props.churchId, userId: props.userId });

  return userOpt ? props.children(userOpt) : nullOp();
}
