import { formatDistanceToNow } from "date-fns";
import {
  AtSignIcon,
  InboxIcon,
  MailIcon,
  MailOpenIcon,
  MessageSquareTextIcon,
  Trash2Icon,
} from "lucide-react";
import type { ComponentType } from "react";
import { useNavigate } from "@tanstack/react-router";

import { UserAvatar } from "@/components/avatars/userAvatar";
import { useOpenTaskDetailsPaneUrl } from "@/components/details-pane/details-pane-helpers";
import { MainContainer, PageContainer } from "@/components/pageComponents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMarkNotificationReadMutation,
  useMarkNotificationUnreadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
  useDeleteReadNotificationsMutation,
  useNotificationsCollection,
  type NotificationCollectionItem,
} from "@/data/notifications/notificationsData.app";
import { useMembersCollection, type MemberItem } from "@/data/members/membersData.app";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { cn } from "@/lib/utils";

const PAGE_DESCRIPTION = "Replies, mentions, and other updates that need your attention.";

type NotificationKind = {
  readonly icon: ComponentType<{ readonly className?: string }>;
  readonly label: string;
};

const NOTIFICATION_KINDS: Record<string, NotificationKind> = {
  mention_explicit_target: { icon: AtSignIcon, label: "Mention" },
  task_comment_reply: { icon: MessageSquareTextIcon, label: "Reply" },
};

const FALLBACK_KIND: NotificationKind = { icon: InboxIcon, label: "Update" };

function kindForNotification(type: string): NotificationKind {
  return NOTIFICATION_KINDS[type] ?? FALLBACK_KIND;
}

type NotificationDisplayMetadata = {
  readonly comment_excerpt?: string;
  readonly task_identifier?: string;
  readonly task_title?: string;
};

function getStringMetadataValue(
  metadata: Record<string, unknown>,
  key: keyof NotificationDisplayMetadata,
) {
  const value = metadata[key];
  return typeof value === "string" ? value : undefined;
}

function parseDisplayMetadata(metadata: string | null | undefined): NotificationDisplayMetadata {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const parsedMetadata = parsed as Record<string, unknown>;
    return {
      comment_excerpt: getStringMetadataValue(parsedMetadata, "comment_excerpt"),
      task_identifier: getStringMetadataValue(parsedMetadata, "task_identifier"),
      task_title: getStringMetadataValue(parsedMetadata, "task_title"),
    };
  } catch {
    return {};
  }
}

function getNotificationTaskReference(notification: NotificationCollectionItem) {
  return (
    parseDisplayMetadata(notification.display_metadata).task_identifier ?? notification.task_id
  );
}

/** The leading verb that describes what the actor did, paired with the type glyph. */
function actionLabelForType(type: string): string {
  switch (type) {
    case "mention_explicit_target":
      return "mentioned you";
    case "task_comment_reply":
      return "replied";
    default:
      return "sent an update";
  }
}

export function InboxPage() {
  const { currentOrgOpt: activeChurch, loading: orgLoading } = useCurrentOrgOpt();
  const {
    loading: notificationsLoading,
    notificationsCollection,
    unreadCount,
  } = useNotificationsCollection({
    churchId: activeChurch?.id ?? null,
  });
  const { membersCollection } = useMembersCollection({ churchId: activeChurch?.id ?? null });
  const loading = orgLoading || notificationsLoading;
  const markAllRead = useMarkAllNotificationsReadMutation();
  const deleteRead = useDeleteReadNotificationsMutation();
  const hasNotifications = notificationsCollection.length > 0;
  const hasReadNotifications = notificationsCollection.some(
    (notification) => notification.read_at != null,
  );

  const membersByUserId = new Map<string, MemberItem>(
    membersCollection.map((member) => [member.userId, member]),
  );

  return (
    <MainContainer>
      <div className="flex flex-col gap-1 px-4 pt-0 pb-3 md:pt-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="font-semibold text-2xl tracking-tight">Inbox</h1>
            {!loading && unreadCount > 0 ? (
              <Badge className="tabular-nums" variant="secondary">
                {unreadCount} unread
              </Badge>
            ) : null}
          </div>
          {!loading && hasNotifications ? (
            <div className="flex items-center gap-2">
              <Button
                disabled={unreadCount === 0}
                onClick={() => activeChurch && void markAllRead({ churchId: activeChurch.id })}
                size="sm"
                variant="outline"
              >
                <MailOpenIcon />
                Mark all read
              </Button>
              <Button
                disabled={!hasReadNotifications}
                onClick={() => activeChurch && void deleteRead({ churchId: activeChurch.id })}
                size="sm"
                variant="ghost"
              >
                <Trash2Icon />
                Delete read
              </Button>
            </div>
          ) : null}
        </div>
        <p className="text-balance text-muted-foreground text-sm">{PAGE_DESCRIPTION}</p>
      </div>

      <PageContainer className="flex-1" wrapperClassName="gap-0 pt-2 md:pt-2">
        {loading ? (
          <InboxSkeleton />
        ) : notificationsCollection.length === 0 ? (
          <Empty className="min-h-72 rounded-xl border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <InboxIcon />
              </EmptyMedia>
              <EmptyTitle>You&apos;re all caught up</EmptyTitle>
              <EmptyDescription>
                Replies, mentions, and other updates that need your attention will land here.
              </EmptyDescription>
            </EmptyHeader>
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <span>Jump back anytime with</span>
              <KbdGroup>
                <Kbd>G</Kbd>
                <Kbd>I</Kbd>
              </KbdGroup>
            </div>
          </Empty>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-xl border bg-card">
            {notificationsCollection.map((notification, index) => (
              <NotificationRow
                actor={
                  notification.actor_user_id
                    ? (membersByUserId.get(notification.actor_user_id) ?? null)
                    : null
                }
                isFirst={index === 0}
                key={notification.id}
                notification={notification}
              />
            ))}
          </ul>
        )}
      </PageContainer>
    </MainContainer>
  );
}

function NotificationRow({
  actor,
  isFirst,
  notification,
}: {
  readonly actor: MemberItem | null;
  readonly isFirst: boolean;
  readonly notification: NotificationCollectionItem;
}) {
  const isUnread = notification.read_at == null;
  const kind = kindForNotification(notification.type);
  const KindIcon = kind.icon;
  const navigate = useNavigate();
  const openTaskDetailsPaneUrl = useOpenTaskDetailsPaneUrl();
  const markNotificationRead = useMarkNotificationReadMutation();
  const markNotificationUnread = useMarkNotificationUnreadMutation();
  const deleteNotification = useDeleteNotificationMutation();
  const taskReference = getNotificationTaskReference(notification);

  const metadata = parseDisplayMetadata(notification.display_metadata);
  const taskIdentifier = metadata.task_identifier ?? null;
  const taskTitle = metadata.task_title ?? null;
  const excerpt = notification.display_body ?? metadata.comment_excerpt ?? null;

  const actorUserId = notification.actor_user_id ?? null;
  const actorName = actor?.name ?? "Someone";
  const actionLabel = actionLabelForType(notification.type);

  const openNotification = () => {
    if (!taskReference) return;

    void markNotificationRead({
      churchId: notification.church_id,
      notificationId: notification.id,
    });
    const url = openTaskDetailsPaneUrl({ id: taskReference });
    void navigate({ to: url.to, search: url.search });
  };

  return (
    <li className={cn("relative", !isFirst && "border-t", isUnread && "bg-primary/[0.03]")}>
      {isUnread ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary" />
      ) : null}

      <div className="flex items-stretch">
        <button
          aria-label={`Open notification: ${notification.display_title}`}
          className={cn(
            "relative flex min-w-0 flex-1 gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isUnread && "bg-primary/[0.03]",
            !taskReference && "cursor-default",
          )}
          disabled={!taskReference}
          onClick={openNotification}
          type="button"
        >
          <div className="relative mt-0.5 shrink-0">
            {actorUserId ? (
              <UserAvatar
                avatar={actor?.image ?? null}
                name={actorName}
                size={28}
                userId={actorUserId}
              />
            ) : (
              <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <KindIcon className="size-3.5" />
              </span>
            )}
            <span
              aria-hidden
              className="-bottom-0.5 -right-0.5 absolute flex size-4 items-center justify-center rounded-full bg-muted text-muted-foreground ring-2 ring-card"
            >
              <KindIcon className="size-2.5" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <p
                className={cn(
                  "min-w-0 flex-1 text-sm leading-5",
                  isUnread ? "text-foreground" : "text-foreground/90",
                )}
              >
                <span className={cn(isUnread ? "font-semibold" : "font-medium")}>{actorName}</span>{" "}
                <span className="text-muted-foreground">{actionLabel}</span>
              </p>
              <Badge
                className="shrink-0 gap-1 text-muted-foreground"
                data-icon="inline-start"
                variant="outline"
              >
                <KindIcon />
                {kind.label}
              </Badge>
              {notification.created_at ? (
                <time className="mt-0.5 shrink-0 text-muted-foreground text-xs tabular-nums">
                  {formatDistanceToNow(notification.created_at, { addSuffix: true })}
                </time>
              ) : null}
            </div>

            {taskIdentifier || taskTitle ? (
              <p className="mt-1 flex min-w-0 items-baseline gap-1.5 text-sm">
                {taskIdentifier ? (
                  <span className="shrink-0 font-medium text-muted-foreground text-xs tabular-nums">
                    {taskIdentifier}
                  </span>
                ) : null}
                {taskTitle ? (
                  <span className="min-w-0 truncate font-medium text-foreground">{taskTitle}</span>
                ) : null}
              </p>
            ) : (
              <p className="mt-1 min-w-0 truncate font-medium text-foreground text-sm">
                {notification.display_title}
              </p>
            )}

            {excerpt ? (
              <p className="mt-1 line-clamp-2 text-muted-foreground text-sm/relaxed">{excerpt}</p>
            ) : null}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1 px-3">
          <Button
            aria-label={isUnread ? "Mark notification read" : "Mark notification unread"}
            onClick={() =>
              void (isUnread ? markNotificationRead : markNotificationUnread)({
                churchId: notification.church_id,
                notificationId: notification.id,
              })
            }
            size="icon-sm"
            variant="ghost"
          >
            {isUnread ? <MailOpenIcon /> : <MailIcon />}
          </Button>
          <Button
            aria-label="Delete notification"
            onClick={() =>
              void deleteNotification({
                churchId: notification.church_id,
                notificationId: notification.id,
              })
            }
            size="icon-sm"
            variant="ghost"
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>
    </li>
  );
}

function InboxSkeleton() {
  return (
    <ul className="flex flex-col overflow-hidden rounded-xl border bg-card">
      {Array.from({ length: 5 }).map((_, index) => (
        <li className={cn("flex gap-3 px-4 py-3.5", index !== 0 && "border-t")} key={index}>
          <Skeleton className="mt-0.5 size-7 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        </li>
      ))}
    </ul>
  );
}
