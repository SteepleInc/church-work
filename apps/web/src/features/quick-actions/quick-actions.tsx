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
  CommandShortcut,
} from "@/components/ui/command";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { canInviteChurchMembers, InviteMemberQuickAction } from "@/features/settings/invite-member";
import {
  buildChurchTaskQuickActions,
  disableQuickActionsAtom,
  quickActionsIsOpenAtom,
  useQuickActionOpeners,
} from "@/features/quick-actions/quick-actions-state";
import type {
  QuickActionDefinition,
  QuickActionGroup,
} from "@/features/quick-actions/quick-actions-types";

const groupLabels = {
  "big-action": "Big Actions",
  "quick-action": "Quick Actions",
} satisfies Record<QuickActionGroup, string>;

export function QuickActions() {
  const [quickActionsIsOpen, setQuickActionsIsOpen] = useAtom(quickActionsIsOpenAtom);
  const disableQuickActions = useAtomValue(disableQuickActionsAtom);
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const navigate = useNavigate();
  const { openInviteMember } = useQuickActionOpeners();

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
        navigateToMyWork: () => void navigate({ to: "/my-work" }),
        navigateToOurWork: () => void navigate({ to: "/our-work" }),
        navigateToSettings: () => void navigate({ to: "/settings" }),
        openInviteMember,
      }),
    [activeChurch?.role, navigate, openInviteMember, setQuickActionsIsOpen],
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
      {activeChurch ? (
        <InviteMemberQuickAction
          activeChurchId={activeChurch.id}
          activeChurchRole={activeChurch.role}
        />
      ) : null}
    </>
  );
}

function CommandMenuContent({ actions }: { readonly actions: readonly QuickActionDefinition[] }) {
  return (
    <>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {(["big-action", "quick-action"] as const).map((group) => (
          <CommandGroup heading={groupLabels[group]} key={group}>
            {actions
              .filter((action) => action.group === group)
              .map((action) => (
                <QuickActionCommandItem action={action} key={action.name} />
              ))}
          </CommandGroup>
        ))}
      </CommandList>
    </>
  );
}

function QuickActionCommandItem({ action }: { readonly action: QuickActionDefinition }) {
  const Icon = action.icon;

  return (
    <CommandItem
      className="items-start gap-3"
      disabled={!action.enabled}
      keywords={[...action.keywords]}
      onSelect={action.onSelect}
      value={`${action.name} ${action.description}`}
    >
      <Icon className="mt-0.5 size-4 text-muted-foreground" />
      <span className="grid gap-0.5">
        <span>{action.name}</span>
        <span className="text-xs text-muted-foreground">
          {action.enabled ? action.description : action.disabledReason}
        </span>
      </span>
      {action.shortcut ? <CommandShortcut>{action.shortcut}</CommandShortcut> : null}
    </CommandItem>
  );
}
