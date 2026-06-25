import { queries, type Invitation } from "@church-work/zero";
import { useQuery } from "@rocicorp/zero/react";
import { useEffect, useState } from "react";

import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useSession } from "@/hooks/use-session";
import { authClient } from "@/lib/auth-client";

export type InvitationCollectionItem = {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly status: string;
  readonly organizationName?: string;
};

type BetterAuthInvitation = {
  readonly id: string;
  readonly email: string;
  readonly role?: string | null;
  readonly status: string;
  readonly organizationName?: string | null;
};

const mapInvitation = (
  invitation: Pick<Invitation, "email" | "id" | "role" | "status">,
  organizationName?: string,
): InvitationCollectionItem => ({
  email: invitation.email,
  id: invitation.id,
  organizationName,
  role: invitation.role ?? "member",
  status: invitation.status,
});

export function useOrgInvitations() {
  const { currentOrgOpt, loading } = useCurrentOrgOpt();
  const [rows] = useQuery(
    queries.invitations.by_church({ church_id: currentOrgOpt?.id ?? "__no_church__" }),
  );
  const collection = currentOrgOpt
    ? rows.map((invitation) => mapInvitation(invitation, currentOrgOpt.name))
    : [];

  return {
    loading,
    collection,
    invitationsCollection: collection,
  };
}

export function usePendingInvitationsCount() {
  const invitations = useOrgInvitations();

  return {
    loading: invitations.loading,
    count: invitations.invitationsCollection.filter((invitation) => invitation.status === "pending")
      .length,
  };
}

export function useUserInvitationsCollection() {
  const session = useSession();
  const userId = session.session?.user.id;
  const [collection, setCollection] = useState<readonly InvitationCollectionItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setCollection([]);
      setLoading(session.isPending);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void authClient.organization
      .listUserInvitations()
      .then((result) => {
        if (cancelled) return;

        setLoading(false);
        if (result.error) {
          setCollection([]);
          return;
        }

        const invitations = (result.data ?? []) as readonly BetterAuthInvitation[];
        setCollection(
          invitations.map((invitation) => ({
            email: invitation.email,
            id: invitation.id,
            organizationName: invitation.organizationName ?? undefined,
            role: invitation.role ?? "member",
            status: invitation.status,
          })),
        );
      })
      .catch(() => {
        if (cancelled) return;

        setLoading(false);
        setCollection([]);
      });

    return () => {
      cancelled = true;
    };
  }, [session.isPending, userId]);

  return {
    loading,
    collection,
    invitationsCollection: collection,
  };
}
