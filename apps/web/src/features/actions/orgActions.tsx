import { PencilIcon } from "lucide-react";
import { useSetAtom } from "jotai";

import type { EntityAction, EntityActionsRenderMode } from "@/features/actions/actionTypes";
import { EntityActionsMenu } from "@/features/actions/entityActionsMenu";
import { editOrgQuickActionStateAtom } from "@/features/quick-actions/edit-org-quick-action";
import { useIsAdmin } from "@/data/users/adminData.app";

type OrgActionsProps = {
  readonly orgId: string;
  readonly className?: string;
  readonly mode: EntityActionsRenderMode;
  readonly onClose?: () => void;
};

export function useOrgActions({
  orgId,
  onClose,
}: {
  readonly orgId: string;
  readonly onClose?: () => void;
}): ReadonlyArray<EntityAction> {
  const isAdmin = useIsAdmin();
  const setEditOrgState = useSetAtom(editOrgQuickActionStateAtom);

  if (!isAdmin) {
    return [];
  }

  return [
    {
      icon: <PencilIcon className="size-4" />,
      id: "edit-org",
      label: "Edit org",
      onAction: () => {
        onClose?.();
        setEditOrgState({ orgId });
      },
      primary: false,
    },
  ];
}

export function OrgActions({ orgId, className, mode, onClose }: OrgActionsProps) {
  const actions = useOrgActions({ onClose, orgId });

  if (actions.length === 0) {
    return null;
  }

  return (
    <EntityActionsMenu actions={actions} className={className} mode={mode} onClose={onClose} />
  );
}
