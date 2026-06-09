import { PencilIcon, UserRoundIcon } from "lucide-react";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { toast } from "sonner";

import type { EntityAction, EntityActionsRenderMode } from "@/features/actions/actionTypes";
import { EntityActionsMenu } from "@/features/actions/entityActionsMenu";
import { editUserQuickActionStateAtom } from "@/features/quick-actions/edit-user-quick-action";
import { authClient } from "@/lib/auth-client";
import { useIsAdmin } from "@/data/users/adminData.app";

type UserActionsProps = {
  readonly userId: string;
  readonly className?: string;
  readonly mode: EntityActionsRenderMode;
  readonly onClose?: () => void;
};

export function useUserActions({
  userId,
  onClose,
}: {
  readonly userId: string;
  readonly onClose?: () => void;
}): ReadonlyArray<EntityAction> {
  const isAdmin = useIsAdmin();
  const { refetch: refetchSession } = authClient.useSession();
  const setEditUserState = useSetAtom(editUserQuickActionStateAtom);
  const [impersonating, setImpersonating] = useState(false);

  if (!isAdmin) {
    return [];
  }

  return [
    {
      icon: <PencilIcon className="size-4" />,
      id: "edit-user",
      label: "Edit user",
      onAction: () => {
        onClose?.();
        setEditUserState({ userId });
      },
      primary: false,
    },
    {
      icon: <UserRoundIcon className="size-4" />,
      id: "impersonate-user",
      label: "Impersonate user",
      loading: impersonating,
      onAction: () => {
        void (async () => {
          setImpersonating(true);

          try {
            const { error } = await authClient.admin.impersonateUser({ userId });

            if (error) {
              toast.error(error.message || "Could not impersonate user.");
              return;
            }

            await refetchSession();
            onClose?.();
            toast.success("Impersonation session started.");
          } finally {
            setImpersonating(false);
          }
        })();
      },
      primary: false,
    },
  ];
}

export function UserActions({ userId, className, mode, onClose }: UserActionsProps) {
  const actions = useUserActions({ onClose, userId });

  if (actions.length === 0) {
    return null;
  }

  return (
    <EntityActionsMenu actions={actions} className={className} mode={mode} onClose={onClose} />
  );
}
