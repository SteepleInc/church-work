import type { LinkProps } from "@tanstack/react-router";
import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { PageTabs, PageTabsList, PageTabsTrigger } from "@/components/ui/page-tabs";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { cn } from "@/lib/utils";

type TabConfig = {
  readonly label: string;
  readonly to: LinkProps["to"];
  readonly value: "members" | "invites";
};

const getTabs = (basePath: string): readonly TabConfig[] => [
  {
    label: "Members",
    to: `${basePath}/members` as LinkProps["to"],
    value: "members",
  },
  {
    label: "Invites",
    to: `${basePath}/invites` as LinkProps["to"],
    value: "invites",
  },
];

export function TeamTabs({
  basePath = "/settings/team",
  className,
}: {
  readonly basePath?: string;
  readonly className?: string;
}) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const pendingInvitationsCount =
    activeChurch?.invitations.filter((invitation) => invitation.status === "pending").length ?? 0;
  const currentTab = pathname.endsWith("/invites") ? "invites" : "members";
  const tabs = getTabs(basePath);
  const [activeTab, setActiveTab] = useState(currentTab);

  useEffect(() => {
    setActiveTab(currentTab);
  }, [currentTab]);

  return (
    <PageTabs
      className={cn("px-3", className)}
      defaultValue={currentTab}
      onValueChange={(value) => setActiveTab(value as "members" | "invites")}
      storageKey="team-tabs"
      value={activeTab}
    >
      <PageTabsList aria-label="Team settings sections">
        {tabs.map((tab) => (
          <PageTabsTrigger
            key={tab.value}
            render={<Link preload="intent" replace to={tab.to} />}
            value={tab.value}
          >
            {tab.label}
            {tab.value === "invites" && pendingInvitationsCount > 0 ? (
              <Badge className="ml-1.5" variant="secondary">
                {pendingInvitationsCount}
              </Badge>
            ) : null}
          </PageTabsTrigger>
        ))}
      </PageTabsList>
    </PageTabs>
  );
}
