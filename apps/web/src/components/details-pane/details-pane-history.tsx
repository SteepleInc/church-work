import { Link } from "@tanstack/react-router";
import { Array, Boolean, Match, pipe } from "effect";
import { BuildingIcon, CheckSquareIcon, UserIcon, UsersIcon } from "lucide-react";
import type { ReactNode } from "react";

import { useOpenDetailsPaneUrl } from "@/components/details-pane/details-pane-helpers";
import type { DetailsPaneParams } from "@/components/details-pane/details-pane-types";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { useOrgData } from "@/data/orgs/orgData.app";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useTaskData } from "@/data/tasks/taskData.app";
import { useTeamData } from "@/data/teams/teamData.app";
import { useUserData } from "@/data/users/userData.app";
import { cn } from "@/lib/utils";

type DetailsPaneHistoryProps = {
  readonly history: DetailsPaneParams;
};

export function DetailsPaneHistory({ history }: DetailsPaneHistoryProps) {
  const openDetailsPaneUrl = useOpenDetailsPaneUrl({ replace: true });

  return pipe(
    history,
    Array.match({
      onEmpty: () => null,
      onNonEmpty: (entries) =>
        pipe(
          entries.length > 1,
          Boolean.match({
            onFalse: () => null,
            onTrue: () => (
              <Breadcrumb className="px-4 pt-4">
                <BreadcrumbList>
                  {pipe(
                    entries,
                    Array.map((entry, index) => {
                      const linkProps = openDetailsPaneUrl(
                        pipe(entries, Array.take(index + 1)) as DetailsPaneParams,
                      );
                      const isCurrentPage = entries.length - 1 === index;

                      return pipe(
                        Match.type<typeof entry>(),
                        Match.tag("org", (org) => (
                          <OrgBreadCrumb
                            isCurrentPage={isCurrentPage}
                            key={`${org._tag}-${org.id}-${index}`}
                            linkProps={linkProps}
                            orgId={org.id}
                          />
                        )),
                        Match.tag("task", (task) => (
                          <TaskBreadCrumb
                            isCurrentPage={isCurrentPage}
                            key={`${task._tag}-${task.id}-${index}`}
                            linkProps={linkProps}
                            taskId={task.id}
                          />
                        )),
                        Match.tag("team", (team) => (
                          <TeamBreadCrumb
                            isCurrentPage={isCurrentPage}
                            key={`${team._tag}-${team.id}-${index}`}
                            linkProps={linkProps}
                            teamId={team.id}
                          />
                        )),
                        Match.tag("user", (user) => (
                          <UserBreadCrumb
                            isCurrentPage={isCurrentPage}
                            key={`${user._tag}-${user.id}-${index}`}
                            linkProps={linkProps}
                            userId={user.id}
                          />
                        )),
                        Match.exhaustive,
                      )(entry);
                    }),
                  )}
                </BreadcrumbList>
              </Breadcrumb>
            ),
          }),
        ),
    }),
  );
}

type DetailsPaneLinkProps = ReturnType<ReturnType<typeof useOpenDetailsPaneUrl>>;

type HistoryBreadCrumbProps = {
  readonly linkProps: DetailsPaneLinkProps;
  readonly isCurrentPage: boolean;
  readonly Icon: ReactNode;
  readonly title: ReactNode;
};

function HistoryBreadCrumb({ linkProps, Icon, title, isCurrentPage }: HistoryBreadCrumbProps) {
  return (
    <BreadcrumbItem>
      <BreadcrumbLink
        className={cn(
          "inline-flex flex-row items-center",
          pipe(
            isCurrentPage,
            Boolean.match({
              onFalse: () => "text-muted-foreground",
              onTrue: () => "",
            }),
          ),
        )}
        render={<Link {...linkProps} />}
      >
        <span className="mr-1 inline-flex size-3 items-center justify-center">{Icon}</span>
        {title}
      </BreadcrumbLink>
    </BreadcrumbItem>
  );
}

function OrgBreadCrumb({
  orgId,
  ...props
}: Pick<HistoryBreadCrumbProps, "linkProps" | "isCurrentPage"> & { readonly orgId: string }) {
  const { orgOpt } = useOrgData({ orgId });

  return (
    <HistoryBreadCrumb Icon={<BuildingIcon className="size-3" />} title={orgOpt?.name} {...props} />
  );
}

function TaskBreadCrumb({
  taskId,
  ...props
}: Pick<HistoryBreadCrumbProps, "linkProps" | "isCurrentPage"> & { readonly taskId: string }) {
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const { taskOpt } = useTaskData({
    churchId: activeChurch?.id ?? null,
    currentUserId: activeChurch?.currentUserId ?? null,
    taskId,
  });

  return (
    <HistoryBreadCrumb
      Icon={<CheckSquareIcon className="size-3" />}
      title={taskOpt?.title}
      {...props}
    />
  );
}

function TeamBreadCrumb({
  teamId,
  ...props
}: Pick<HistoryBreadCrumbProps, "linkProps" | "isCurrentPage"> & { readonly teamId: string }) {
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const { teamOpt } = useTeamData({ churchId: activeChurch?.id ?? null, teamId });

  return (
    <HistoryBreadCrumb Icon={<UsersIcon className="size-3" />} title={teamOpt?.name} {...props} />
  );
}

function UserBreadCrumb({
  userId,
  ...props
}: Pick<HistoryBreadCrumbProps, "linkProps" | "isCurrentPage"> & { readonly userId: string }) {
  const { userOpt } = useUserData({ userId });

  return (
    <HistoryBreadCrumb Icon={<UserIcon className="size-3" />} title={userOpt?.name} {...props} />
  );
}
