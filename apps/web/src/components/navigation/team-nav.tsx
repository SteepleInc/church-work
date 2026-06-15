import {
  ArrowDown01Icon,
  ArrowUpRight01Icon,
  Cancel01Icon,
  Copy01Icon,
  Link01Icon,
  Logout02Icon,
  MoreHorizontalIcon,
  PlusSignIcon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useSetAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { TeamAvatar } from "@/components/avatars/teamAvatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroupAction,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { TeamCollectionItem } from "@/data/teams/teamsData.app";
import { useAddTeamMemberMutation, useRemoveTeamMemberMutation } from "@/data/teams/teamsData.app";
import { teamQuickActionStateAtom } from "@/features/quick-actions/team-quick-action";
import { cn } from "@/lib/utils";

// The team's destination surfaces. They all point at the team's Default Team
// View (/team/$identifier) for now; real Cycle-scoped pages come later. Each
// child keeps a stable key so its expansion state can be remembered.
type TeamChild = {
  readonly key: string;
  readonly label: string;
  readonly children?: readonly TeamChild[];
};

const TEAM_CHILDREN: readonly TeamChild[] = [
  { key: "tasks", label: "Tasks" },
  {
    key: "cycles",
    label: "Cycles",
    children: [
      { key: "current", label: "Current" },
      { key: "upcoming", label: "Upcoming" },
    ],
  },
];

const EXPANSION_STORAGE_KEY = "church-task:sidebar:team-expansion";

// Per-team and per-child expansion is a local UI preference (not shareable
// state), so it lives in local storage rather than the URL.
function useExpansionState() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(EXPANSION_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(EXPANSION_STORAGE_KEY, JSON.stringify(expanded));
    } catch {
      // Ignore storage failures (private mode, quota); expansion is non-critical.
    }
  }, [expanded]);

  const setKey = useCallback((key: string, open: boolean) => {
    setExpanded((previous) => ({ ...previous, [key]: open }));
  }, []);

  return { expanded, setKey };
}

function teamHref(identifier: string): string {
  return `/team/${identifier}`;
}

// Team mutations return a discriminated union; only the failure branch carries
// an error. Pull the message off when present, otherwise use the fallback.
function mutationErrorMessage(result: { readonly ok: boolean }, fallback: string): string {
  const error = (result as { readonly error?: { readonly message?: string } }).error;
  return error?.message ?? fallback;
}

async function copyTeamLink(identifier: string) {
  const url = `${window.location.origin}${teamHref(identifier)}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Copied link to clipboard.");
  } catch {
    toast.error("Could not copy link.");
  }
}

export function TeamNavList({
  teams,
  churchId,
  currentUserId,
}: {
  readonly teams: readonly TeamCollectionItem[];
  readonly churchId: string;
  readonly currentUserId: string | null;
}) {
  const { expanded, setKey } = useExpansionState();

  return (
    <>
      {teams.map((team) => (
        <TeamNavItem
          key={team.id}
          churchId={churchId}
          currentUserId={currentUserId}
          expanded={expanded}
          setExpanded={setKey}
          team={team}
        />
      ))}
    </>
  );
}

function TeamNavItem({
  team,
  churchId,
  currentUserId,
  expanded,
  setExpanded,
}: {
  readonly team: TeamCollectionItem;
  readonly churchId: string;
  readonly currentUserId: string | null;
  readonly expanded: Record<string, boolean>;
  readonly setExpanded: (key: string, open: boolean) => void;
}) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { setOpenMobile } = useSidebar();
  const href = teamHref(team.identifier);
  const isActive = pathname.startsWith(href);
  const expansionKey = `team:${team.id}`;
  const isOpen = expanded[expansionKey] ?? false;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(open) => setExpanded(expansionKey, open)}
      render={<SidebarMenuItem />}
    >
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <SidebarMenuButton
              className="pr-12"
              isActive={isActive}
              render={
                <Link
                  onClick={() => setOpenMobile(false)}
                  preload="intent"
                  search={(previousSearch) => ({
                    "details-pane": (previousSearch as { readonly "details-pane"?: unknown })[
                      "details-pane"
                    ],
                  })}
                  to={href as "/"}
                />
              }
            />
          }
        >
          <TeamAvatar color={team.color} name={team.name} size={20} />
          <span className="flex-1 truncate">{team.name}</span>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => void copyTeamLink(team.identifier)}>
            <HugeiconsIcon icon={Link01Icon} strokeWidth={2} />
            Copy link
          </ContextMenuItem>
          <ContextMenuItem render={<a href={href} rel="noopener" target="_blank" />}>
            <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} />
            Open in new tab
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <TeamActionsMenu
        churchId={churchId}
        currentUserId={currentUserId}
        isViewingTeam={isActive}
        team={team}
      />

      <CollapsibleTrigger
        render={
          <SidebarMenuAction
            aria-label={isOpen ? `Collapse ${team.name}` : `Expand ${team.name}`}
            className="right-7"
          />
        }
      >
        <HugeiconsIcon
          className={cn("transition-transform", isOpen ? "rotate-0" : "-rotate-90")}
          icon={ArrowDown01Icon}
          strokeWidth={2}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <SidebarMenuSub>
          {TEAM_CHILDREN.map((child) => (
            <TeamChildItem
              key={child.key}
              child={child}
              expanded={expanded}
              href={href}
              parentKey={expansionKey}
              setExpanded={setExpanded}
            />
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}

function TeamChildItem({
  child,
  href,
  parentKey,
  expanded,
  setExpanded,
}: {
  readonly child: TeamChild;
  readonly href: string;
  readonly parentKey: string;
  readonly expanded: Record<string, boolean>;
  readonly setExpanded: (key: string, open: boolean) => void;
}) {
  const { setOpenMobile } = useSidebar();

  if (child.children) {
    const expansionKey = `${parentKey}:${child.key}`;
    const isOpen = expanded[expansionKey] ?? false;

    return (
      <Collapsible
        open={isOpen}
        onOpenChange={(open) => setExpanded(expansionKey, open)}
        render={<SidebarMenuSubItem />}
      >
        <CollapsibleTrigger render={<SidebarMenuSubButton className="cursor-pointer" />}>
          <HugeiconsIcon
            className={cn("transition-transform", isOpen ? "rotate-0" : "-rotate-90")}
            icon={ArrowDown01Icon}
            strokeWidth={2}
          />
          <span>{child.label}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {child.children.map((grandchild) => (
              <ChildLink key={grandchild.key} href={href} label={grandchild.label} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuSubItem>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <SidebarMenuSubButton
              render={
                <Link onClick={() => setOpenMobile(false)} preload="intent" to={href as "/"} />
              }
            />
          }
        >
          <span>{child.label}</span>
        </ContextMenuTrigger>
        <ChildContextMenuContent href={href} />
      </ContextMenu>
    </SidebarMenuSubItem>
  );
}

function ChildLink({ href, label }: { readonly href: string; readonly label: string }) {
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarMenuSubItem>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <SidebarMenuSubButton
              render={
                <Link onClick={() => setOpenMobile(false)} preload="intent" to={href as "/"} />
              }
            />
          }
        >
          <span>{label}</span>
        </ContextMenuTrigger>
        <ChildContextMenuContent href={href} />
      </ContextMenu>
    </SidebarMenuSubItem>
  );
}

function ChildContextMenuContent({ href }: { readonly href: string }) {
  return (
    <ContextMenuContent>
      <ContextMenuItem
        onClick={() => {
          void (async () => {
            try {
              await navigator.clipboard.writeText(`${window.location.origin}${href}`);
              toast.success("Copied link to clipboard.");
            } catch {
              toast.error("Could not copy link.");
            }
          })();
        }}
      >
        <HugeiconsIcon icon={Link01Icon} strokeWidth={2} />
        Copy link
      </ContextMenuItem>
      <ContextMenuItem render={<a href={href} rel="noopener" target="_blank" />}>
        <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} />
        Open in new tab
      </ContextMenuItem>
    </ContextMenuContent>
  );
}

function TeamActionsMenu({
  team,
  churchId,
  currentUserId,
  isViewingTeam,
}: {
  readonly team: TeamCollectionItem;
  readonly churchId: string;
  readonly currentUserId: string | null;
  readonly isViewingTeam: boolean;
}) {
  const navigate = useNavigate();
  const removeTeamMember = useRemoveTeamMemberMutation();
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const leaveTeam = async () => {
    if (!currentUserId) return;
    setLeaving(true);
    const result = await removeTeamMember({ churchId, teamId: team.id, userId: currentUserId });
    setLeaving(false);

    if (!result.ok) {
      toast.error(mutationErrorMessage(result, "Could not leave Team."));
      return;
    }

    setConfirmingLeave(false);
    toast.success(`Left ${team.name}.`);
    if (isViewingTeam) {
      void navigate({ to: "/my-work" });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuAction aria-label={`${team.name} actions`} showOnHover>
              <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
            </SidebarMenuAction>
          }
        />
        <DropdownMenuContent align="start" className="min-w-48" side="right">
          <DropdownMenuItem
            render={<Link to="/settings/team/$teamTab" params={{ teamTab: "members" }} />}
          >
            <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
            Team settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void copyTeamLink(team.identifier)}>
            <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
            Copy URL
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!currentUserId}
            onClick={() => setConfirmingLeave(true)}
            variant="destructive"
          >
            <HugeiconsIcon icon={Logout02Icon} strokeWidth={2} />
            Leave team...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LeaveTeamDialog
        leaving={leaving}
        onConfirm={() => void leaveTeam()}
        onOpenChange={setConfirmingLeave}
        open={confirmingLeave}
        teamName={team.name}
      />
    </>
  );
}

function LeaveTeamDialog({
  open,
  onOpenChange,
  onConfirm,
  leaving,
  teamName,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
  readonly leaving: boolean;
  readonly teamName: string;
}) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          </AlertDialogMedia>
          <AlertDialogTitle>Leave {teamName}?</AlertDialogTitle>
          <AlertDialogDescription>
            You will no longer see {teamName} in your sidebar. You can rejoin from the Your teams
            menu later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={leaving}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={leaving} onClick={onConfirm} variant="destructive">
            {leaving ? "Leaving..." : "Leave team"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function YourTeamsAddMenu({
  churchId,
  joinableTeams,
  currentUserId,
}: {
  readonly churchId: string;
  readonly joinableTeams: readonly TeamCollectionItem[];
  readonly currentUserId: string | null;
}) {
  const addTeamMember = useAddTeamMemberMutation();
  const setTeamQuickAction = useSetAtom(teamQuickActionStateAtom);

  const handleCreate = () => {
    // Reuse the existing team creation quick action (name + identifier form)
    // rather than silently creating a placeholder Team.
    setTeamQuickAction({ churchId, mode: "create" });
  };

  const handleJoin = async (team: TeamCollectionItem) => {
    if (!currentUserId) return;
    const result = await addTeamMember({ churchId, teamId: team.id, userId: currentUserId });
    if (!result.ok) {
      toast.error(mutationErrorMessage(result, "Could not join Team."));
      return;
    }
    toast.success(`Joined ${team.name}.`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarGroupAction aria-label="Add a team">
            <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
          </SidebarGroupAction>
        }
      />
      <DropdownMenuContent align="start" className="min-w-56" side="right">
        <DropdownMenuItem onClick={handleCreate}>
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
          Create new team...
        </DropdownMenuItem>
        {joinableTeams.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            {joinableTeams.map((team) => (
              <DropdownMenuItem
                disabled={!currentUserId}
                key={team.id}
                onClick={() => void handleJoin(team)}
              >
                <TeamAvatar color={team.color} name={team.name} size={20} />
                <span className="truncate">{team.name}</span>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
