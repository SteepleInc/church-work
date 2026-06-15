import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { LinkProps } from "@tanstack/react-router";
import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { TeamAvatar } from "@/components/avatars/teamAvatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { COMPLETED_APP_LANDING_PATH } from "@/data/org-routing";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useTeamsCollection } from "@/data/teams/teamsData.app";
import { settingsNavGroups, type SettingsNavItem } from "@/features/settings/settings-nav-items";
import { cn } from "@/lib/utils";

function SettingsNavLink({
  to,
  title,
  icon,
  matchPath,
  params,
}: SettingsNavItem & { readonly params?: LinkProps["params"] }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const active = matchPath ? pathname.startsWith(matchPath) : pathname === to;

  return (
    <Link
      className={cn(
        "flex h-8 items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground/90 transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
      )}
      params={params}
      preload="intent"
      to={to}
    >
      <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="truncate">{title}</span>
    </Link>
  );
}

function SettingsNavSection({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="px-2 pt-3 pb-1 font-medium text-muted-foreground text-xs">{label}</span>
      {children}
    </div>
  );
}

function YourTeamsSection() {
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const teams = useTeamsCollection({ churchId: activeChurch?.id ?? null });

  return (
    <SettingsNavSection label="Your teams">
      {teams.loading ? (
        <>
          <Skeleton className="mx-2 my-1 h-5 w-32" />
          <Skeleton className="mx-2 my-1 h-5 w-24" />
        </>
      ) : teams.teamsCollection.length > 0 ? (
        teams.teamsCollection.map((team) => (
          <SettingsNavLink
            icon={<TeamAvatar color={team.color} name={team.name} size={16} />}
            key={team.id}
            matchPath={`/settings/teams/${team.id}`}
            params={{ teamId: team.id }}
            title={team.name}
            to={"/settings/teams/$teamId" as LinkProps["to"]}
          />
        ))
      ) : (
        <span className="px-2 py-1 text-muted-foreground text-sm">No Teams yet</span>
      )}
    </SettingsNavSection>
  );
}

export function SettingsSidebar() {
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col gap-1 border-sidebar-border border-r bg-sidebar px-2 py-3">
      <Link
        className={cn(
          "flex h-8 items-center gap-2 rounded-md px-2 text-muted-foreground text-sm transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
        preload="intent"
        to={COMPLETED_APP_LANDING_PATH}
      >
        <HugeiconsIcon className="size-4" icon={ArrowLeft01Icon} strokeWidth={2} />
        <span>Back to app</span>
      </Link>

      <div className="px-2 py-2 font-semibold text-sm">{activeChurch?.name ?? "Settings"}</div>

      <ScrollArea className="flex-1" viewportClassName="pr-1">
        {settingsNavGroups.map((group) => (
          <SettingsNavSection key={group.label} label={group.label}>
            {group.items.map((item) => (
              <SettingsNavLink key={item.to} {...item} />
            ))}
          </SettingsNavSection>
        ))}

        <YourTeamsSection />
      </ScrollArea>
    </aside>
  );
}
