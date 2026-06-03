import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { cn } from "@/lib/utils";

type TabConfig = {
  readonly label: string;
  readonly to: "/settings/team/$teamTab";
  readonly params: { readonly teamTab: "members" | "invites" };
  readonly value: "members" | "invites";
};

const tabs: readonly TabConfig[] = [
  {
    label: "Members",
    params: { teamTab: "members" },
    to: "/settings/team/$teamTab",
    value: "members",
  },
  {
    label: "Invites",
    params: { teamTab: "invites" },
    to: "/settings/team/$teamTab",
    value: "invites",
  },
];

export function TeamTabs({ className }: { readonly className?: string }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const pendingInvitationsCount =
    activeChurch?.invitations.filter((invitation) => invitation.status === "pending").length ?? 0;
  const currentTab = pathname.endsWith("/invites") ? "invites" : "members";
  const [activeTab, setActiveTab] = useState(currentTab);

  useEffect(() => {
    setActiveTab(currentTab);
  }, [currentTab]);

  return (
    <div
      aria-label="Team settings sections"
      className={cn(
        "relative flex h-14 items-center gap-0 border-zinc-200 border-b bg-transparent px-3 dark:border-zinc-700",
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.value;

        return (
          <Link
            aria-selected={isActive}
            className={cn(
              "relative z-20 flex items-center justify-center rounded-md px-3 py-2 font-medium text-muted-foreground text-sm transition-colors duration-300 ease-in-out hover:text-foreground",
              isActive ? "text-foreground" : null,
            )}
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            params={tab.params}
            preload="intent"
            replace
            role="tab"
            to={tab.to}
          >
            {tab.label}
            {tab.value === "invites" && pendingInvitationsCount > 0 ? (
              <Badge className="ml-1.5" variant="secondary">
                {pendingInvitationsCount}
              </Badge>
            ) : null}
            {isActive ? (
              <span className="absolute right-3 bottom-0 left-3 h-1 rounded-t-md bg-foreground" />
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
