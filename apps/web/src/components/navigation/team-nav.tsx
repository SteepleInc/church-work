import {
  ArrowDown01Icon,
  ArrowUpRight01Icon,
  Calendar03Icon,
  Cancel01Icon,
  Copy01Icon,
  Link01Icon,
  Logout02Icon,
  MoreHorizontalIcon,
  PlayCircleIcon,
  PlusSignIcon,
  Settings01Icon,
  Task01Icon,
  Time04Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { useSetAtom } from "jotai";
import type { ComponentProps } from "react";
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
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
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
type IconType = ComponentProps<typeof HugeiconsIcon>["icon"];

type TeamChild = {
  readonly key: string;
  readonly label: string;
  readonly icon: IconType;
  readonly children?: readonly TeamChild[];
};

type WeekScope = "current" | "upcoming";

export const teamNavChildren: readonly TeamChild[] = [
  { key: "tasks", label: "Tasks", icon: Task01Icon },
  {
    key: "weeks",
    label: "Weeks",
    icon: Calendar03Icon,
    children: [
      { key: "current", label: "Current", icon: PlayCircleIcon },
      { key: "upcoming", label: "Upcoming", icon: Time04Icon },
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

function isWeekScope(value: string | undefined): value is WeekScope {
  return value === "current" || value === "upcoming";
}

export function getTeamChildHref(identifier: string, key: string): string {
  const href = teamHref(identifier);
  if (key === "weeks") return `${href}/weeks`;
  if (isWeekScope(key)) return `${href}?week=${key}`;
  return href;
}

function preserveDetailsPaneSearch(previousSearch: unknown) {
  return {
    "details-pane": (previousSearch as { readonly "details-pane"?: unknown })["details-pane"],
  };
}

// Which Team sub-item a given URL lights up. The bare Team path is the
// Default Team View ("Tasks"); the Week shortcuts are the same path scoped by
// the `week` search param. Exported for focused navigation tests.
export function resolveActiveTeamChild(args: {
  readonly pathname: string;
  readonly teamHref: string;
  readonly week: string | undefined;
}): "tasks" | "weeks" | WeekScope | null {
  const onTeam = args.pathname === args.teamHref || args.pathname.startsWith(`${args.teamHref}/`);
  if (!onTeam) return null;
  if (
    args.pathname === `${args.teamHref}/weeks` ||
    args.pathname.startsWith(`${args.teamHref}/weeks/`)
  ) {
    return "weeks";
  }
  if (isWeekScope(args.week)) return args.week;
  return "tasks";
}

function isTeamRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
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
  // The `week` shortcut lives in the URL, so the active sub-item is shared
  // (link-reproducible) state. Read it loosely so this works from any route.
  const week = useSearch({
    strict: false,
    select: (search) => (search as { readonly week?: string }).week,
  });
  const { setOpenMobile } = useSidebar();
  const href = teamHref(team.identifier);
  const isActive = isTeamRoute(pathname, href);
  const activeChild = resolveActiveTeamChild({ pathname, teamHref: href, week });
  const expansionKey = `team:${team.id}`;
  // When a Week shortcut is the active surface, reveal it: open the Team and
  // its Weeks group so the highlighted item is visible without a manual expand.
  const weekActive =
    activeChild === "weeks" || activeChild === "current" || activeChild === "upcoming";
  const isOpen = (expanded[expansionKey] ?? false) || weekActive;

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
                  search={preserveDetailsPaneSearch}
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
        <SidebarMenuSub className="before:hidden">
          {teamNavChildren.map((child) => (
            <TeamChildItem
              key={child.key}
              activeChild={activeChild}
              child={child}
              href={href}
              identifier={team.identifier}
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
  identifier,
  activeChild,
}: {
  readonly child: TeamChild;
  readonly href: string;
  readonly identifier: string;
  readonly activeChild: "tasks" | "weeks" | WeekScope | null;
}) {
  const { setOpenMobile } = useSidebar();

  if (child.children) {
    return (
      <>
        <SidebarMenuSubItem>
          <ContextMenu>
            <ContextMenuTrigger
              render={
                <SidebarMenuSubButton
                  isActive={activeChild === child.key}
                  render={
                    <Link
                      onClick={() => setOpenMobile(false)}
                      preload="intent"
                      search={preserveDetailsPaneSearch}
                      to={getTeamChildHref(identifier, child.key) as "/"}
                    />
                  }
                />
              }
            >
              <ChildIcon icon={child.icon} />
              <span className="flex-1 truncate">{child.label}</span>
            </ContextMenuTrigger>
            <ChildContextMenuContent href={getTeamChildHref(identifier, child.key)} />
          </ContextMenu>
        </SidebarMenuSubItem>
        <SidebarMenuSub className="ml-4 py-0 pl-3 before:inset-y-1 before:block">
          {child.children.map((grandchild) => (
            <ChildLink
              key={grandchild.key}
              href={getTeamChildHref(identifier, grandchild.key)}
              isActive={activeChild === grandchild.key}
              label={grandchild.label}
              week={isWeekScope(grandchild.key) ? grandchild.key : undefined}
            />
          ))}
        </SidebarMenuSub>
      </>
    );
  }

  return (
    <SidebarMenuSubItem>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <SidebarMenuSubButton
              isActive={activeChild === child.key}
              render={
                <Link
                  onClick={() => setOpenMobile(false)}
                  preload="intent"
                  search={preserveDetailsPaneSearch}
                  to={href as "/"}
                />
              }
            />
          }
        >
          <ChildIcon icon={child.icon} />
          <span className="flex-1 truncate">{child.label}</span>
        </ContextMenuTrigger>
        <ChildContextMenuContent href={href} />
      </ContextMenu>
    </SidebarMenuSubItem>
  );
}

// Leading content icon for a team sub-item. Muted by default and lit on
// hover/active to match Linear, where the label is primary and the icon is a
// quiet wayfinding cue. `in-data-[active]` lights the icon when its containing
// sub-button is the active surface, so it reads alongside the highlighted row.
function ChildIcon({ icon }: { readonly icon: IconType }) {
  return (
    <HugeiconsIcon
      className="text-muted-foreground! group-hover/menu-sub-item:text-sidebar-accent-foreground! in-data-[active]:text-sidebar-accent-foreground!"
      icon={icon}
      strokeWidth={2}
    />
  );
}

function ChildLink({
  href,
  label,
  icon,
  isActive,
  week,
}: {
  readonly href: string;
  readonly label: string;
  readonly icon?: IconType;
  readonly isActive: boolean;
  readonly week: WeekScope | undefined;
}) {
  const { setOpenMobile } = useSidebar();
  // The shortcut path is the Team path; the Week scope rides in `search` so it
  // sets/replaces the `week` param cleanly and preserves an open Details Pane.
  const path = href.split("?")[0];

  return (
    <SidebarMenuSubItem>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <SidebarMenuSubButton
              isActive={isActive}
              render={
                <Link
                  onClick={() => setOpenMobile(false)}
                  preload="intent"
                  search={(previousSearch) => ({
                    ...preserveDetailsPaneSearch(previousSearch),
                    week,
                  })}
                  to={path as "/"}
                />
              }
            />
          }
        >
          {icon ? <ChildIcon icon={icon} /> : null}
          <span className="flex-1 truncate">{label}</span>
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // The team menu's shortcuts (matching Linear) are scoped to this menu: they
  // only fire while this team's menu is open, and they act on this team. There
  // is no global registration, so two teams' menus can share the same keys
  // without ambiguity.
  useEffect(() => {
    if (!menuOpen) return;

    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return;
      // Copy URL = ⌘⇧, (Cmd/Ctrl + Shift + comma), as in Linear.
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === ",") {
        event.preventDefault();
        setMenuOpen(false);
        void copyTeamLink(team.identifier);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menuOpen, team.identifier]);

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
      <DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
        <DropdownMenuTrigger
          render={
            <SidebarMenuAction aria-label={`${team.name} actions`} showOnHover>
              <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
            </SidebarMenuAction>
          }
        />
        <DropdownMenuContent align="start" className="min-w-48" side="right">
          <DropdownMenuItem
            render={<Link to="/settings/teams/$teamId/members" params={{ teamId: team.id }} />}
          >
            <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
            Team settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void copyTeamLink(team.identifier)}>
            <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
            Copy URL
            <DropdownMenuShortcut>
              <Kbd>mod shift ,</Kbd>
            </DropdownMenuShortcut>
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
  const [menuOpen, setMenuOpen] = useState(false);

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

  // When there are no Teams to join, the menu would only ever show a single
  // "Create new team..." item, so skip the nested menu and open the create
  // quick action directly from the + button.
  if (joinableTeams.length === 0) {
    return (
      <SidebarGroupAction aria-label="Create a team" onClick={handleCreate}>
        <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
      </SidebarGroupAction>
    );
  }

  return (
    <DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
      <DropdownMenuTrigger
        render={
          <SidebarGroupAction
            aria-label="Add a team"
            className="aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground"
          >
            <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
          </SidebarGroupAction>
        }
      />
      <DropdownMenuContent align="end" className="min-w-56" side="bottom">
        <DropdownMenuItem onClick={handleCreate}>
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
          Create new team...
        </DropdownMenuItem>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
