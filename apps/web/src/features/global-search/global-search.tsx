import { createHotkeyHandler } from "@tanstack/hotkeys";
import { useNavigate } from "@tanstack/react-router";
import { useAtom, useSetAtom } from "jotai";
import { Building2Icon, ListTodoIcon, SettingsIcon, UserIcon, UsersIcon } from "lucide-react";
import { useEffect, useMemo } from "react";

import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useTasksCollection } from "@/data/tasks/tasksData.app";
import { useTeamsCollection } from "@/data/teams/teamsData.app";
import { useChurchUsersCollection } from "@/data/users/usersData.app";
import { globalSearchIsOpenAtom } from "@/features/global-search/global-search-state";
import type { GlobalSearchResult } from "@/features/global-search/global-search-types";
import { GlobalSearchWindow } from "@/features/global-search/global-search-window";
import {
  GLOBAL_SEARCH_SHORTCUT,
  isEditableKeyboardTarget,
} from "@/features/global-search/global-search-utils";
import {
  QuickActionsDescription,
  QuickActionsTitle,
  QuickActionsWrapper,
} from "@/features/quick-actions/quick-actions-components";
import { disableQuickActionsAtom } from "@/features/quick-actions/quick-actions-state";

export function GlobalSearch() {
  const [globalSearchIsOpen, setGlobalSearchIsOpen] = useAtom(globalSearchIsOpenAtom);
  const setDisableQuickActions = useSetAtom(disableQuickActionsAtom);
  const navigate = useNavigate();
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const teams = useTeamsCollection({ churchId: activeChurch?.id ?? null });
  const users = useChurchUsersCollection({ churchId: activeChurch?.id ?? null });
  const tasks = useTasksCollection({
    churchId: activeChurch?.id ?? null,
    currentUserId: activeChurch?.currentUserId ?? null,
  });

  useEffect(() => {
    const handler = createHotkeyHandler(
      GLOBAL_SEARCH_SHORTCUT,
      (event) => {
        if (event.repeat || isEditableKeyboardTarget(event.target)) return;
        setGlobalSearchIsOpen((isOpen) => !isOpen);
      },
      { preventDefault: true },
    );

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [setGlobalSearchIsOpen]);

  useEffect(() => {
    setDisableQuickActions(globalSearchIsOpen);
  }, [globalSearchIsOpen, setDisableQuickActions]);

  const selectAndClose = (action: () => void) => () => {
    setGlobalSearchIsOpen(false);
    action();
  };

  const results = useMemo<readonly GlobalSearchResult[]>(() => {
    const routeResults: GlobalSearchResult[] = [
      {
        id: "route:my-work",
        type: "route",
        title: "My Work",
        description: "Tasks assigned to you.",
        keywords: ["tasks", "assigned", "todo"],
        icon: ListTodoIcon,
        actionText: "Open Page",
        details: [
          { label: "Route", value: "/my-work" },
          { label: "Scope", value: "Tasks assigned to you" },
        ],
        onSelect: selectAndClose(() => void navigate({ to: "/my-work" })),
      },
      {
        id: "route:our-work",
        type: "route",
        title: "Our Work",
        description: "Church-wide tasks and shared work.",
        keywords: ["tasks", "church", "shared"],
        icon: UsersIcon,
        actionText: "Open Page",
        details: [
          { label: "Route", value: "/our-work" },
          { label: "Scope", value: "Church-wide work" },
        ],
        onSelect: selectAndClose(() => void navigate({ to: "/our-work" })),
      },
      {
        id: "route:settings",
        type: "route",
        title: "Settings",
        description: "Profile, Church, Team, and invitation settings.",
        keywords: ["profile", "church", "team", "members", "invitations"],
        icon: SettingsIcon,
        actionText: "Open Page",
        details: [
          { label: "Route", value: "/settings" },
          { label: "Sections", value: "Profile, Church, Team, Invitations" },
        ],
        onSelect: selectAndClose(() => void navigate({ to: "/settings" })),
      },
    ];

    const churchResult: GlobalSearchResult[] = activeChurch
      ? [
          {
            id: `church:${activeChurch.id}`,
            type: "church",
            title: activeChurch.name,
            description: "Active Church profile and settings.",
            keywords: ["church", "org", activeChurch.slug ?? ""],
            icon: Building2Icon,
            actionText: "Open Settings",
            details: [
              { label: "Church", value: activeChurch.name },
              { label: "Slug", value: activeChurch.slug ?? "Not set" },
            ],
            onSelect: selectAndClose(() => void navigate({ to: "/settings/workspace/general" })),
          },
        ]
      : [];

    const teamResults = teams.teamsCollection.map((team) => ({
      id: `team:${team.id}`,
      type: "team" as const,
      title: team.name,
      description: "Team work queue.",
      keywords: ["team", "work"],
      icon: UsersIcon,
      actionText: "Open Team",
      details: [
        { label: "Team", value: team.name },
        { label: "Route", value: `/team/${team.identifier}` },
      ],
      onSelect: selectAndClose(
        () =>
          void navigate({
            params: { teamIdentifier: team.identifier },
            to: "/team/$teamIdentifier",
          }),
      ),
    }));

    const memberResults = users.usersCollection.map((user) => ({
      id: `member:${user.id}`,
      type: "member" as const,
      title: user.name || user.email || "Church member",
      description: user.email ? `${user.email} - ${user.role}` : `Church member - ${user.role}`,
      keywords: ["member", "user", "person", user.email ?? "", user.role],
      icon: UserIcon,
      actionText: "Open Members",
      details: [
        { label: "Member", value: user.name || user.email || "Church member" },
        { label: "Role", value: user.role },
      ],
      onSelect: selectAndClose(() => void navigate({ to: "/settings/workspace/members" })),
    }));

    const taskResults = tasks.tasksCollection.map((task) => ({
      id: `task:${task.id}`,
      type: "task" as const,
      title: task.title,
      description: `Church task - ${task.taskState}`,
      keywords: ["task", "work", task.taskState, task.teamId],
      icon: ListTodoIcon,
      actionText: "Open Work",
      details: [
        { label: "Task", value: task.title },
        { label: "Status", value: task.taskState },
      ],
      onSelect: selectAndClose(() => void navigate({ to: "/our-work" })),
    }));

    return [...routeResults, ...churchResult, ...teamResults, ...memberResults, ...taskResults];
  }, [
    activeChurch,
    navigate,
    setGlobalSearchIsOpen,
    tasks.tasksCollection,
    teams.teamsCollection,
    users.usersCollection,
  ]);

  return (
    <QuickActionsWrapper
      dialogContentClassName="min-h-[min(calc(100vh-clamp(16px,calc((100vh-512px)/2),192px)*2),512px)]"
      onOpenChange={setGlobalSearchIsOpen}
      open={globalSearchIsOpen}
    >
      <div className="sr-only">
        <QuickActionsTitle>Global Search</QuickActionsTitle>
        <QuickActionsDescription>
          A menu that lets you search Church Task entities and routes.
        </QuickActionsDescription>
      </div>
      <GlobalSearchWindow results={results} setOpenState={setGlobalSearchIsOpen} />
    </QuickActionsWrapper>
  );
}
