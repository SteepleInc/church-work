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
import { CreateKeyDateQuickAction } from "@/features/quick-actions/create-key-date-quick-action";
import { CreateTaskQuickAction } from "@/features/quick-actions/create-task-quick-action";
import { EditOrgQuickAction } from "@/features/quick-actions/edit-org-quick-action";
import { EditWeekQuickAction } from "@/features/quick-actions/edit-week-quick-action";
import { EditUserQuickAction } from "@/features/quick-actions/edit-user-quick-action";
import { TeamQuickAction } from "@/features/quick-actions/team-quick-action";
import { InviteMemberQuickAction } from "@/features/settings/invite-member";
import { canInviteChurchMembers } from "@/features/settings/invite-member-utils";
import {
  disableQuickActionsAtom,
  quickActionsIsOpenAtom,
  useQuickActionOpeners,
} from "@/features/quick-actions/quick-actions-state";
import {
  buildChurchTaskQuickActions,
  canManageChurchTeams,
} from "@/features/quick-actions/quick-actions-utils";
import type { QuickActionDefinition } from "@/features/quick-actions/quick-actions-types";

// Avoid hijacking the shortcut while the user is typing in a field.
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function QuickActions() {
  const [quickActionsIsOpen, setQuickActionsIsOpen] = useAtom(quickActionsIsOpenAtom);
  const disableQuickActions = useAtomValue(disableQuickActionsAtom);
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const navigate = useNavigate();
  const { openCreateKeyDate, openCreateTask, openCreateTeam, openInviteMember } =
    useQuickActionOpeners();

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

  // Linear-style "C" opens Create Task from anywhere, unless the user is
  // typing in a field (inputs, textareas, content-editable).
  useEffect(() => {
    if (disableQuickActions) return;

    const handler = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "c") return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      openCreateTask();
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [disableQuickActions, openCreateTask]);

  const activeChurchId = activeChurch?.id ?? null;
  const actions = useMemo(
    () =>
      buildChurchTaskQuickActions({
        canInviteMembers: canInviteChurchMembers(activeChurch?.role),
        canManageKeyDates: activeChurchId !== null && canManageChurchTeams(activeChurch?.role),
        canManageTeams: activeChurchId !== null && canManageChurchTeams(activeChurch?.role),
        closeQuickActions: () => setQuickActionsIsOpen(false),
        openCreateKeyDate: () => {
          if (activeChurchId) openCreateKeyDate({ churchId: activeChurchId });
        },
        openCreateTask: () => openCreateTask(),
        openCreateTeam: () => {
          if (activeChurchId) openCreateTeam({ churchId: activeChurchId });
        },
        navigateToSettings: () => void navigate({ to: "/settings" }),
        openInviteMember,
      }),
    [
      activeChurch?.role,
      activeChurchId,
      navigate,
      openCreateKeyDate,
      openCreateTask,
      openCreateTeam,
      openInviteMember,
      setQuickActionsIsOpen,
    ],
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
      <CreateKeyDateQuickAction />
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
      <EditWeekQuickAction />
      <TeamQuickAction />
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
