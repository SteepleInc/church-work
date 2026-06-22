import { formatDistanceToNow } from "date-fns";
import {
  AtSignIcon,
  ClockIcon,
  InboxIcon,
  MailIcon,
  MailOpenIcon,
  MessageSquareTextIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { UserAvatar } from "@/components/avatars/userAvatar";
import { useOpenTaskDetailsPaneUrl } from "@/components/details-pane/details-pane-helpers";
import { MainContainer, PageContainer } from "@/components/pageComponents";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useMarkNotificationReadMutation,
  useMarkNotificationUnreadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
  useDeleteReadNotificationsMutation,
  useSnoozeNotificationMutation,
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

export function isNotificationSnoozed(
  notification: Pick<NotificationCollectionItem, "snoozed_until">,
  now: Date,
) {
  return notification.snoozed_until != null && new Date(notification.snoozed_until) > now;
}

export function filterInboxNotifications(
  notifications: readonly NotificationCollectionItem[],
  options: { readonly showRead: boolean; readonly showSnoozed: boolean; readonly now: Date },
) {
  return notifications.filter((notification) => {
    if (!options.showRead && notification.read_at != null) return false;
    if (!options.showSnoozed && isNotificationSnoozed(notification, options.now)) return false;
    return true;
  });
}

function snoozeInOneHour(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

function snoozeUntilTomorrowMorning(): Date {
  const target = new Date();
  target.setDate(target.getDate() + 1);
  target.setHours(9, 0, 0, 0);
  return target;
}

function snoozeUntilNextWeek(): Date {
  const target = new Date();
  target.setDate(target.getDate() + 7);
  target.setHours(9, 0, 0, 0);
  return target;
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

function hiddenSnoozedDescription(snoozedCount: number): string {
  if (snoozedCount === 1) {
    return "1 notification is snoozed for later. Turn on Snoozed in Display to see it.";
  }

  return `${snoozedCount} notifications are snoozed for later. Turn on Snoozed in Display to see them.`;
}

function emptyFilteredDescription({
  snoozedCount,
  showSnoozed,
}: {
  readonly snoozedCount: number;
  readonly showSnoozed: boolean;
}): string {
  if (snoozedCount > 0 && !showSnoozed) return hiddenSnoozedDescription(snoozedCount);

  return "Everything matching your Display options is cleared. Adjust Display to widen this view.";
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
  const readCount = notificationsCollection.filter(
    (notification) => notification.read_at != null,
  ).length;
  const hasReadNotifications = readCount > 0;
  const [deleteReadOpen, setDeleteReadOpen] = useState(false);
  const [showRead, setShowRead] = useState(true);
  const [showSnoozed, setShowSnoozed] = useState(false);
  const now = new Date();
  const snoozedCount = notificationsCollection.filter((notification) =>
    isNotificationSnoozed(notification, now),
  ).length;
  const hasSnoozedNotifications = snoozedCount > 0;
  const visibleNotifications = filterInboxNotifications(notificationsCollection, {
    now,
    showRead,
    showSnoozed,
  });

  const membersByUserId = new Map<string, MemberItem>(
    membersCollection.map((member) => [member.userId, member]),
  );

  const handleMarkAllRead = () => {
    if (!activeChurch || unreadCount === 0) return;
    void markAllRead({ churchId: activeChurch.id });
    toast.success(
      unreadCount === 1
        ? "Marked 1 notification as read."
        : `Marked ${unreadCount} notifications as read.`,
    );
  };

  const handleDeleteRead = () => {
    if (!activeChurch || !hasReadNotifications) return;
    const removed = readCount;
    void deleteRead({ churchId: activeChurch.id });
    setDeleteReadOpen(false);
    toast.success(
      removed === 1 ? "Deleted 1 read notification." : `Deleted ${removed} read notifications.`,
    );
  };

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
            <div className="flex flex-wrap items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button size="sm" variant="outline">
                      <SlidersHorizontalIcon />
                      Display
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Show in Inbox</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={showRead}
                    onCheckedChange={(checked) => setShowRead(checked === true)}
                  >
                    <MailOpenIcon className="text-muted-foreground" />
                    <span className="flex-1">Read</span>
                    {readCount > 0 ? (
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {readCount}
                      </span>
                    ) : null}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={showSnoozed}
                    onCheckedChange={(checked) => setShowSnoozed(checked === true)}
                  >
                    <ClockIcon className="text-muted-foreground" />
                    <span className="flex-1">Snoozed</span>
                    {snoozedCount > 0 ? (
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {snoozedCount}
                      </span>
                    ) : null}
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                disabled={unreadCount === 0}
                onClick={handleMarkAllRead}
                size="sm"
                variant="outline"
              >
                <MailOpenIcon />
                Mark all read
              </Button>
              <Button
                disabled={!hasReadNotifications}
                onClick={() => setDeleteReadOpen(true)}
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

      <AlertDialog onOpenChange={setDeleteReadOpen} open={deleteReadOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2Icon />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {readCount === 1
                ? "Delete 1 read notification?"
                : `Delete ${readCount} read notifications?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Read notifications are cleared from your Inbox. The Tasks and conversations they point
              to stay exactly where they are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDeleteRead();
              }}
              variant="destructive"
            >
              Delete read
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
        ) : visibleNotifications.length === 0 ? (
          <Empty className="min-h-72 rounded-xl border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {hasSnoozedNotifications && !showSnoozed ? <ClockIcon /> : <InboxIcon />}
              </EmptyMedia>
              <EmptyTitle>Nothing left to read</EmptyTitle>
              <EmptyDescription>
                {emptyFilteredDescription({ snoozedCount, showSnoozed })}
              </EmptyDescription>
            </EmptyHeader>
            {hasSnoozedNotifications && !showSnoozed ? (
              <Button onClick={() => setShowSnoozed(true)} size="sm" variant="outline">
                <ClockIcon />
                Show snoozed
              </Button>
            ) : null}
          </Empty>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-xl border bg-card">
            {visibleNotifications.map((notification, index) => (
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
  const isSnoozed = isNotificationSnoozed(notification, new Date());
  const snoozedUntilLabel =
    isSnoozed && notification.snoozed_until != null
      ? formatDistanceToNow(notification.snoozed_until, { addSuffix: true })
      : null;
  const kind = kindForNotification(notification.type);
  const KindIcon = kind.icon;
  const navigate = useNavigate();
  const openTaskDetailsPaneUrl = useOpenTaskDetailsPaneUrl();
  const markNotificationRead = useMarkNotificationReadMutation();
  const markNotificationUnread = useMarkNotificationUnreadMutation();
  const deleteNotification = useDeleteNotificationMutation();
  const snoozeNotification = useSnoozeNotificationMutation();
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

  const snoozeUntil = (snoozedUntil: Date, label: string) => {
    void snoozeNotification({
      churchId: notification.church_id,
      notificationId: notification.id,
      snoozedUntil,
    });
    toast.success(`Snoozed ${label}.`);
  };

  return (
    <li
      className={cn(
        "group relative",
        !isFirst && "border-t",
        isUnread && "bg-primary/[0.03]",
        isSnoozed && "opacity-70 transition-opacity hover:opacity-100 focus-within:opacity-100",
      )}
    >
      {isUnread ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary" />
      ) : null}

      <div className="relative flex items-stretch">
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
              {snoozedUntilLabel ? (
                <Badge
                  className="shrink-0 gap-1"
                  data-icon="inline-start"
                  title={`Snoozed, returns ${snoozedUntilLabel}`}
                  variant="secondary"
                >
                  <ClockIcon />
                  Snoozed {snoozedUntilLabel}
                </Badge>
              ) : (
                <Badge
                  className="shrink-0 gap-1 text-muted-foreground"
                  data-icon="inline-start"
                  variant="outline"
                >
                  <KindIcon />
                  {kind.label}
                </Badge>
              )}
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
        <div className="absolute inset-y-0 right-0 flex items-center gap-1 bg-gradient-to-l from-card via-card to-transparent pr-3 pl-8 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-md:static max-md:bg-none max-md:pl-3 max-md:opacity-100">
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    render={
                      <Button
                        aria-label="Snooze notification"
                        className={cn(isSnoozed && "text-foreground")}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <ClockIcon />
                      </Button>
                    }
                  />
                }
              />
              <TooltipContent>{isSnoozed ? "Reschedule snooze" : "Snooze"}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Snooze until</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => snoozeUntil(snoozeInOneHour(), "for an hour")}>
                <ClockIcon className="text-muted-foreground" />
                In 1 hour
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => snoozeUntil(snoozeUntilTomorrowMorning(), "until tomorrow morning")}
              >
                <ClockIcon className="text-muted-foreground" />
                Tomorrow morning
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => snoozeUntil(snoozeUntilNextWeek(), "until next week")}
              >
                <ClockIcon className="text-muted-foreground" />
                Next week
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
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
              }
            />
            <TooltipContent>{isUnread ? "Mark read" : "Mark unread"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Delete notification"
                  className="text-muted-foreground hover:text-destructive"
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
              }
            />
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
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
