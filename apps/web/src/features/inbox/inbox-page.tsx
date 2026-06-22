import { formatDistanceToNow } from "date-fns";
import { AtSignIcon, InboxIcon, MessageSquareTextIcon } from "lucide-react";
import type { ComponentType } from "react";

import { MainContainer, PageContainer } from "@/components/pageComponents";
import { Badge } from "@/components/ui/badge";
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
  useNotificationsCollection,
  type NotificationCollectionItem,
} from "@/data/notifications/notificationsData.app";
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

export function InboxPage() {
  const { currentOrgOpt: activeChurch, loading: orgLoading } = useCurrentOrgOpt();
  const {
    loading: notificationsLoading,
    notificationsCollection,
    unreadCount,
  } = useNotificationsCollection({
    churchId: activeChurch?.id ?? null,
  });
  const loading = orgLoading || notificationsLoading;

  return (
    <MainContainer>
      <div className="flex flex-col gap-1 px-4 pt-0 pb-3 md:pt-1">
        <div className="flex items-center gap-2.5">
          <h1 className="font-semibold text-2xl tracking-tight">Inbox</h1>
          {!loading && unreadCount > 0 ? (
            <Badge className="tabular-nums" variant="secondary">
              {unreadCount} unread
            </Badge>
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
  isFirst,
  notification,
}: {
  readonly isFirst: boolean;
  readonly notification: NotificationCollectionItem;
}) {
  const isUnread = notification.read_at == null;
  const kind = kindForNotification(notification.type);
  const KindIcon = kind.icon;

  return (
    <li
      className={cn(
        "relative flex gap-3 px-4 py-3.5",
        !isFirst && "border-t",
        isUnread && "bg-primary/[0.03]",
      )}
    >
      {isUnread ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary" />
      ) : null}

      <div
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
          isUnread ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <KindIcon className="size-3.5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 text-sm",
              isUnread ? "font-medium text-foreground" : "text-foreground/90",
            )}
          >
            {notification.display_title}
          </p>
          {notification.created_at ? (
            <time className="mt-0.5 shrink-0 text-muted-foreground text-xs tabular-nums">
              {formatDistanceToNow(notification.created_at, { addSuffix: true })}
            </time>
          ) : null}
        </div>
        {notification.display_body ? (
          <p className="mt-1 line-clamp-2 text-muted-foreground text-sm/relaxed">
            {notification.display_body}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function InboxSkeleton() {
  return (
    <ul className="flex flex-col overflow-hidden rounded-xl border bg-card">
      {Array.from({ length: 5 }).map((_, index) => (
        <li className={cn("flex gap-3 px-4 py-3.5", index !== 0 && "border-t")} key={index}>
          <Skeleton className="mt-0.5 size-7 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        </li>
      ))}
    </ul>
  );
}
