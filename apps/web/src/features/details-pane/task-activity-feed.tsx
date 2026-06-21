import {
  Ban,
  CalendarIcon,
  CircleDot,
  CirclePlus,
  CornerDownRight,
  MessageSquare,
  RotateCcw,
  Tag,
  Triangle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  useActivitiesForEntityCollection,
  type ActivityCollectionItem,
} from "@/data/activities/activitiesData.app";
import {
  useCreateTaskCommentMutation,
  useTaskCommentsForTaskCollection,
  type TaskCommentCollectionItem,
} from "@/data/task-comments/taskCommentsData.app";
import { UserAvatar } from "@/components/avatars/userAvatar";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  describeActivity,
  formatActivityTime,
  type ActivityGlyph,
  type ActivityResolvers,
} from "./task-activity-feed-utils";

const GLYPH_ICON: Record<ActivityGlyph, LucideIcon> = {
  assignee: Users,
  canceled: Ban,
  completed: CircleDot,
  created: CirclePlus,
  cycle: CalendarIcon,
  due_date: CalendarIcon,
  estimate: Triangle,
  generic: CircleDot,
  labels: Tag,
  priority: CircleDot,
  reopened: RotateCcw,
  status: CircleDot,
  team: Users,
  title: CircleDot,
};

/** An actor's resolved display name + id, for the leading avatar of each line. */
export type ActivityActor = {
  readonly id: string;
  readonly name: string;
};

type ActivityFeedProps = {
  readonly churchId: string | null;
  readonly currentUserId: string | null;
  readonly taskEntityId: string;
  readonly resolvers: ActivityResolvers;
  /** Resolves an actor user id to a display name; null when the user is gone. */
  readonly resolveActorName: (userId: string) => string | null;
};

/**
 * The read-only Activity Feed shown at the bottom of the Task Details Pane.
 * Renders one reverse-chronological line per Activity, leading with the actor's
 * avatar, an event glyph, the human-readable phrase, and a compact relative
 * timestamp (absolute time in the line's `title`). Task Comments render inline
 * as cards with one-level replies; subscriptions are deferred.
 */
export function TaskActivityFeed(props: ActivityFeedProps) {
  const { activitiesCollection, loading } = useActivitiesForEntityCollection({
    churchId: props.churchId,
    entityId: props.taskEntityId,
    entityType: "task",
  });
  const { taskCommentsCollection } = useTaskCommentsForTaskCollection({
    churchId: props.churchId,
    taskId: props.taskEntityId,
  });
  const createComment = useCreateTaskCommentMutation({
    churchId: props.churchId,
    taskId: props.taskEntityId,
  });

  const now = Date.now();
  const commentsById = useMemo(
    () => new Map(taskCommentsCollection.map((comment) => [comment.id, comment])),
    [taskCommentsCollection],
  );
  const repliesByParentCommentId = useMemo(() => {
    const grouped = new Map<string, TaskCommentCollectionItem[]>();
    for (const comment of taskCommentsCollection) {
      const parentId = comment.parent_comment_id;
      if (!parentId) continue;
      const replies = grouped.get(parentId) ?? [];
      replies.push(comment);
      grouped.set(parentId, replies);
    }
    return grouped;
  }, [taskCommentsCollection]);

  // The query returns newest-first; the feed reads oldest-first like Linear.
  const ordered = useMemo(() => [...activitiesCollection].reverse(), [activitiesCollection]);

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[15px]">Activity</h3>
        {/* Subscribe + subscribers are visual stubs until the subscription
            backend exists; they are intentionally non-functional for now. */}
        <button
          className="text-muted-foreground text-sm transition-colors hover:text-foreground"
          disabled
          type="button"
        >
          Subscribe
        </button>
      </div>

      {loading ? (
        <ActivityFeedSkeleton />
      ) : ordered.length === 0 ? (
        <ActivityFeedEmpty />
      ) : (
        <ol aria-label="Activity" className="grid gap-2.5">
          {ordered.map((activity) => (
            <ActivityRow
              activity={activity}
              key={activity.id}
              now={now}
              commentsById={commentsById}
              createComment={createComment}
              currentUserId={props.currentUserId}
              resolveActorName={props.resolveActorName}
              repliesByParentCommentId={repliesByParentCommentId}
              resolvers={props.resolvers}
            />
          ))}
        </ol>
      )}

      <ActivityCommentComposer
        currentUserId={props.currentUserId}
        currentUserName={
          props.currentUserId ? (props.resolveActorName(props.currentUserId) ?? null) : null
        }
        onSubmit={createComment}
      />
    </section>
  );
}

function ActivityFeedEmpty() {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed py-6 text-center">
      <MessageSquare className="size-5 text-muted-foreground" />
      <p className="text-muted-foreground text-sm">No activity yet.</p>
      <p className="text-muted-foreground/70 text-xs">
        Leave the first comment to start the conversation.
      </p>
    </div>
  );
}

function ActivityRow({
  activity,
  now,
  commentsById,
  createComment,
  currentUserId,
  resolvers,
  resolveActorName,
  repliesByParentCommentId,
}: {
  readonly activity: ActivityCollectionItem;
  readonly commentsById: ReadonlyMap<string, TaskCommentCollectionItem>;
  readonly createComment: (body: string, parentCommentId?: string | null) => Promise<void>;
  readonly currentUserId: string | null;
  readonly now: number;
  readonly resolvers: ActivityResolvers;
  readonly resolveActorName: (userId: string) => string | null;
  readonly repliesByParentCommentId: ReadonlyMap<string, readonly TaskCommentCollectionItem[]>;
}) {
  const metadata = parseMetadata(activity.metadata);
  if (activity.event_type === "comment_created") {
    const commentId = getCommentId(metadata);
    const comment = commentId ? commentsById.get(commentId) : undefined;
    if (!comment) return null;
    if (comment.parent_comment_id) return null;

    return (
      <TaskCommentCard
        comment={comment}
        currentUserId={currentUserId}
        now={now}
        onReply={(body) => createComment(body, comment.id)}
        replies={repliesByParentCommentId.get(comment.id) ?? []}
        resolveActorName={resolveActorName}
        title={new Date(activity.occurred_at).toLocaleString()}
      />
    );
  }
  const line = describeActivity(activity.event_type, metadata, resolvers);
  if (!line) return null;

  const Icon = GLYPH_ICON[line.glyph];
  const actorId = activity.actor_id ?? null;
  const isUserActor = activity.actor_type === "user" && actorId !== null;
  const actorName = isUserActor ? (resolveActorName(actorId) ?? "Unknown user") : "Church Task";
  const occurredAt = activity.occurred_at;
  const absolute = new Date(occurredAt).toLocaleString();

  return (
    <li className="flex items-start gap-2.5 text-sm" title={absolute}>
      {isUserActor ? (
        <UserAvatar className="mt-0.5 shrink-0" name={actorName} size={20} userId={actorId} />
      ) : (
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-3" />
        </span>
      )}
      <p className="min-w-0 text-foreground/90 leading-5">
        <span className="font-medium text-foreground">{actorName}</span> <span>{line.text}</span>
        <span className="text-muted-foreground"> · {formatActivityTime(occurredAt, now)}</span>
      </p>
    </li>
  );
}

function getCommentId(metadata: unknown): string | null {
  if (metadata === null || typeof metadata !== "object") return null;

  const commentId = (metadata as { readonly comment_id?: unknown }).comment_id;
  return typeof commentId === "string" ? commentId : null;
}

function TaskCommentCard({
  comment,
  currentUserId,
  now,
  onReply,
  replies,
  resolveActorName,
  title,
}: {
  readonly comment: TaskCommentCollectionItem;
  readonly currentUserId: string | null;
  readonly now: number;
  readonly onReply: (body: string) => Promise<void>;
  readonly replies: readonly TaskCommentCollectionItem[];
  readonly resolveActorName: (userId: string) => string | null;
  readonly title: string;
}) {
  const actorName = resolveActorName(comment.authored_by_user_id) ?? "Unknown user";
  const createdAt = comment.created_at ?? now;
  const [composing, setComposing] = useState(false);
  const canReply = currentUserId !== null;
  const hasReplies = replies.length > 0;

  return (
    <li className="flex items-start gap-2.5 py-0.5">
      <UserAvatar
        className="mt-0.5 shrink-0"
        name={actorName}
        size={28}
        userId={comment.authored_by_user_id}
      />
      <article className="min-w-0 flex-1 rounded-lg border bg-card shadow-xs">
        <header className="flex items-center gap-2 border-b px-3 py-1.5 text-sm">
          <span className="min-w-0 truncate font-medium text-foreground">{actorName}</span>
          <span className="ml-auto shrink-0 text-muted-foreground text-xs" title={title}>
            {formatActivityTime(createdAt, now)}
          </span>
        </header>
        <p className="whitespace-pre-wrap break-words px-3 py-2.5 text-foreground/90 text-sm leading-relaxed">
          {comment.body}
        </p>

        {hasReplies ? (
          <ol aria-label="Replies" className="grid border-t">
            {replies.map((reply) => (
              <TaskCommentReply
                key={reply.id}
                now={now}
                reply={reply}
                resolveActorName={resolveActorName}
              />
            ))}
          </ol>
        ) : null}

        <footer className="border-t px-3 py-1.5">
          {composing ? (
            <TaskCommentReplyComposer
              currentUserId={currentUserId}
              currentUserName={
                currentUserId ? (resolveActorName(currentUserId) ?? "Unknown user") : null
              }
              onCancel={() => setComposing(false)}
              onSubmit={async (reply) => {
                await onReply(reply);
                setComposing(false);
              }}
            />
          ) : (
            <button
              className={cn(
                "-mx-1 flex items-center gap-1.5 rounded-md px-1 py-0.5 font-medium text-muted-foreground text-xs transition-colors",
                canReply ? "hover:text-foreground" : "cursor-not-allowed opacity-60",
              )}
              disabled={!canReply}
              onClick={() => setComposing(true)}
              type="button"
            >
              <CornerDownRight className="size-3.5" />
              {canReply ? (hasReplies ? "Add a reply" : "Reply") : "Sign in to reply"}
            </button>
          )}
        </footer>
      </article>
    </li>
  );
}

function TaskCommentReply({
  now,
  reply,
  resolveActorName,
}: {
  readonly now: number;
  readonly reply: TaskCommentCollectionItem;
  readonly resolveActorName: (userId: string) => string | null;
}) {
  const actorName = resolveActorName(reply.authored_by_user_id) ?? "Unknown user";
  const createdAt = reply.created_at ?? now;

  return (
    <li className="flex items-start gap-2.5 px-3 py-2 not-last:border-b">
      <UserAvatar
        className="mt-0.5 shrink-0"
        name={actorName}
        size={22}
        userId={reply.authored_by_user_id}
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-1.5 text-sm leading-5">
          <span className="min-w-0 truncate font-medium text-foreground">{actorName}</span>
          <span
            className="shrink-0 text-muted-foreground text-xs"
            title={new Date(createdAt).toLocaleString()}
          >
            {formatActivityTime(createdAt, now)}
          </span>
        </p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-foreground/90 text-sm leading-relaxed">
          {reply.body}
        </p>
      </div>
    </li>
  );
}

function TaskCommentReplyComposer({
  currentUserId,
  currentUserName,
  onCancel,
  onSubmit,
}: {
  readonly currentUserId: string | null;
  readonly currentUserName: string | null;
  readonly onCancel: () => void;
  readonly onSubmit: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);
  const trimmed = body.trim();
  const canReply = currentUserId !== null;
  const canSubmit = canReply && trimmed.length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setBody("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-start gap-2 py-0.5">
      {currentUserId ? (
        <UserAvatar
          className="mt-1 shrink-0"
          name={currentUserName}
          size={22}
          userId={currentUserId}
        />
      ) : null}
      <div
        className={cn(
          "min-w-0 flex-1 rounded-md border bg-background/60 px-2 py-1.5 transition-colors",
          focused && "border-ring ring-3 ring-ring/50",
        )}
      >
        <Textarea
          aria-label="Add a reply"
          autoFocus
          className="min-h-9 resize-y border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          disabled={!canReply}
          onBlur={() => setFocused(false)}
          onChange={(event) => setBody(event.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void submit();
              return;
            }
            // Escape abandons the reply when the field is empty so the card
            // collapses back to its compact "Reply" affordance.
            if (event.key === "Escape" && trimmed.length === 0) {
              event.preventDefault();
              onCancel();
            }
          }}
          placeholder={canReply ? "Leave a reply..." : "Sign in to reply"}
          value={body}
        />
        <div className="mt-1 flex items-center justify-end gap-1">
          <Button onClick={onCancel} size="sm" type="button" variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={!canSubmit}
            loading={submitting}
            onClick={() => void submit()}
            size="sm"
            type="button"
          >
            Reply
            <Kbd className="ml-1.5">mod enter</Kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActivityCommentComposer({
  currentUserId,
  currentUserName,
  onSubmit,
}: {
  readonly currentUserId: string | null;
  readonly currentUserName: string | null;
  readonly onSubmit: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);
  const trimmed = body.trim();
  const canComment = currentUserId !== null;
  const canSubmit = canComment && trimmed.length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setBody("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-start gap-2.5">
      {currentUserId ? (
        <UserAvatar
          className="mt-0.5 hidden shrink-0 sm:block"
          name={currentUserName}
          size={28}
          userId={currentUserId}
        />
      ) : null}
      <div
        className={cn(
          "min-w-0 flex-1 rounded-lg border bg-card p-2 transition-colors",
          focused && "border-ring ring-3 ring-ring/50",
        )}
      >
        <Textarea
          aria-label="Add a comment"
          className="min-h-20 resize-y border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
          disabled={!canComment}
          onBlur={() => setFocused(false)}
          onChange={(event) => setBody(event.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={canComment ? "Leave a comment..." : "Sign in to leave a comment"}
          value={body}
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <Button
            disabled={!canSubmit}
            loading={submitting}
            onClick={() => void submit()}
            size="sm"
            type="button"
          >
            Comment
            <Kbd className="ml-1.5">mod enter</Kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActivityFeedSkeleton() {
  return (
    <div className="grid gap-2.5">
      {Array.from({ length: 3 }, (_, index) => (
        <div className="flex items-center gap-2.5" key={index}>
          <Skeleton className="size-5 shrink-0 rounded-full" />
          <Skeleton className={cn("h-4", index % 2 === 0 ? "w-2/3" : "w-1/2")} />
        </div>
      ))}
    </div>
  );
}

const parseMetadata = (raw: string | null | undefined): unknown => {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
};
