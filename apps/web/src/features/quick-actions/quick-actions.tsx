import { useHotkey } from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";
import { useAtom, useAtomValue } from "jotai";
import { useMemo } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  buildChurchWorkQuickActions,
  canManageChurchTeams,
} from "@/features/quick-actions/quick-actions-utils";
import type { QuickActionDefinition } from "@/features/quick-actions/quick-actions-types";
import { TASK_LIMIT_TITLE, useTaskCreationGate } from "@/features/billing/task-creation-gate";

export function QuickActions() {
  const [quickActionsIsOpen, setQuickActionsIsOpen] = useAtom(quickActionsIsOpenAtom);
  const disableQuickActions = useAtomValue(disableQuickActionsAtom);
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const navigate = useNavigate();
  const taskCreationGate = useTaskCreationGate();
  const {
    openCreateKeyDate,
    openCreateTask,
    openCreateTeam,
    openCreateTemplate,
    openInviteMember,
  } = useQuickActionOpeners();

  // Mod+K toggles the command palette. As a Meta/Ctrl shortcut it defaults to
  // `ignoreInputs: false`, so it still fires while the user is typing in a field.
  useHotkey("Mod+K", () => setQuickActionsIsOpen((isOpen) => !isOpen), {
    enabled: !disableQuickActions,
    preventDefault: true,
    requireReset: true,
  });

  // Linear-style "C" opens Create Task from anywhere. As a single key it
  // defaults to `ignoreInputs: true`, so the manager skips it while the user is
  // typing in an input, textarea, or contentEditable. At the Free Plan Task
  // Limit the gated opener raises a Sonner notification instead of the dialog.
  useHotkey("C", () => openCreateTask(), {
    enabled: !disableQuickActions,
    preventDefault: true,
    requireReset: true,
  });

  const activeChurchId = activeChurch?.id ?? null;
  const actions = useMemo(
    () =>
      buildChurchWorkQuickActions({
        canCreateTasks: !taskCreationGate.blocked,
        // The palette's inline reason has one truncating line, so it carries
        // the short title; full role-aware guidance lives in the Task Usage
        // card, the control tooltips, and the Sonner notification.
        createTasksDisabledReason: taskCreationGate.blocked ? TASK_LIMIT_TITLE : undefined,
        canInviteMembers: canInviteChurchMembers(activeChurch?.role),
        canManageKeyDates: activeChurchId !== null && canManageChurchTeams(activeChurch?.role),
        canManageTemplates: activeChurchId !== null && canManageChurchTeams(activeChurch?.role),
        canManageTeams: activeChurchId !== null && canManageChurchTeams(activeChurch?.role),
        closeQuickActions: () => setQuickActionsIsOpen(false),
        openCreateKeyDate: () => {
          if (activeChurchId) openCreateKeyDate({ churchId: activeChurchId });
        },
        openCreateTemplate,
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
      taskCreationGate,
      openCreateKeyDate,
      openCreateTask,
      openCreateTeam,
      openCreateTemplate,
      openInviteMember,
      setQuickActionsIsOpen,
    ],
  );

  return (
    <>
      <CommandDialog
        description="A menu that lets you quickly execute actions within Church Work."
        onOpenChange={setQuickActionsIsOpen}
        open={quickActionsIsOpen}
        title="Quick Actions Menu"
      >
        <CommandMenuContent actions={actions} />
      </CommandDialog>
      {activeChurch ? (
        <>
          <CreateKeyDateQuickAction />
          <CreateTaskQuickAction />
        </>
      ) : null}
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
      <ScrollArea className="max-h-[300px]">
        <CommandList className="max-h-none overflow-visible">
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Quick Action">
            {actions.map((action) => (
              <QuickActionCommandItem action={action} key={action.name} />
            ))}
          </CommandGroup>
        </CommandList>
      </ScrollArea>
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
      {/* Disabled actions carry their reason inline (a tooltip cannot follow
          the palette's keyboard-driven highlight). */}
      {!action.enabled && action.disabledReason ? (
        <span className="ml-auto truncate text-muted-foreground text-xs">
          {action.disabledReason}
        </span>
      ) : null}
    </CommandItem>
  );
}
