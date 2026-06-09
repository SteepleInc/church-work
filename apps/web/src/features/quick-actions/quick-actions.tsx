import { createHotkeyHandler } from "@tanstack/hotkeys";
import { useNavigate } from "@tanstack/react-router";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useMemo } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { CreateTaskQuickAction } from "@/features/quick-actions/create-task-quick-action";
import { EditOrgQuickAction } from "@/features/quick-actions/edit-org-quick-action";
import { EditUserQuickAction } from "@/features/quick-actions/edit-user-quick-action";
import { canInviteChurchMembers, InviteMemberQuickAction } from "@/features/settings/invite-member";
import {
  buildChurchTaskQuickActions,
  disableQuickActionsAtom,
  quickActionsIsOpenAtom,
  useQuickActionOpeners,
} from "@/features/quick-actions/quick-actions-state";
import type { QuickActionDefinition } from "@/features/quick-actions/quick-actions-types";

export function QuickActions() {
  const [quickActionsIsOpen, setQuickActionsIsOpen] = useAtom(quickActionsIsOpenAtom);
  const disableQuickActions = useAtomValue(disableQuickActionsAtom);
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const navigate = useNavigate();
  const { openCreateTask, openInviteMember } = useQuickActionOpeners();

  useEffect(() => {
    if (disableQuickActions) return;

    const handler = createHotkeyHandler(
      "Mod+K",
      (event) => {
        if (event.repeat) return;
        setQuickActionsIsOpen((isOpen) => !isOpen);
      },
      { preventDefault: true },
    );

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [disableQuickActions, setQuickActionsIsOpen]);

  const actions = useMemo(
    () =>
      buildChurchTaskQuickActions({
        canInviteMembers: canInviteChurchMembers(activeChurch?.role),
        closeQuickActions: () => setQuickActionsIsOpen(false),
        openCreateTask: () => openCreateTask(),
        navigateToSettings: () => void navigate({ to: "/settings" }),
        openInviteMember,
      }),
    [activeChurch?.role, navigate, openCreateTask, openInviteMember, setQuickActionsIsOpen],
  );

  return (
    <>
      <CommandDialog
        description="A menu that lets you quickly execute actions within Church Task."
        onOpenChange={setQuickActionsIsOpen}
        open={quickActionsIsOpen}
        title="Quick Actions Menu"
      >
        <CommandMenuContent actions={actions} />
      </CommandDialog>
      <CreateTaskQuickAction />
      {activeChurch ? (
        <InviteMemberQuickAction
          activeChurchId={activeChurch.id}
          activeChurchRole={activeChurch.role}
          source="quick-actions"
        />
      ) : null}
      <EditOrgQuickAction />
      <EditUserQuickAction />
    </>
  );
}

function CommandMenuContent({ actions }: { readonly actions: readonly QuickActionDefinition[] }) {
  return (
    <>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Quick Action">
          {actions.map((action) => (
            <QuickActionCommandItem action={action} key={action.name} />
          ))}
        </CommandGroup>
      </CommandList>
    </>
  );
}

function QuickActionCommandItem({ action }: { readonly action: QuickActionDefinition }) {
  const Icon = action.icon;

  return (
    <CommandItem
      className="gap-2"
      disabled={!action.enabled}
      keywords={[...action.keywords]}
      onSelect={action.onSelect}
      value={action.name}
    >
      <Icon className="size-4" />
      {action.name}
    </CommandItem>
  );
}
