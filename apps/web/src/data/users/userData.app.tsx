import { nullOp } from "@church-task/shared/noOps";
import { queries } from "@church-task/zero";
import { useQuery } from "@rocicorp/zero/react";
import type { ReactNode } from "react";

import { recordFromCollection } from "@/data/collection-query-state";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import {
  mapAdminUser,
  useChurchUsersCollection,
  type UserCollectionItem,
} from "@/data/users/usersData.app";

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
  const [userRows] = useQuery(
    queries.user.admin_list({ list_args: { limit: 1, selected_ids: [params.userId] } }),
  );
  const [memberRows] = useQuery(queries.member.admin_all());
  const [orgRows] = useQuery(queries.organization.admin_list({ list_args: { limit: 500 } }));
  const orgsById = new Map(orgRows.map((org) => [org.id, org]));
  const user = userRows[0] ? mapAdminUser(userRows[0], memberRows, orgsById) : null;

  return {
    loading: false,
    userOpt: user,
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
