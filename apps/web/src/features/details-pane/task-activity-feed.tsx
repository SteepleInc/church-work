import {
  Ban,
  Bell,
  BellOff,
  CalendarIcon,
  CircleDot,
  CirclePlus,
  CornerDownRight,
  Copy,
  Link as LinkIcon,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  RotateCcw,
  Tag,
  Trash2,
  Triangle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  useActivitiesForEntityCollection,
  type ActivityCollectionItem,
} from "@/data/activities/activitiesData.app";
import {
  useCreateTaskCommentMutation,
  useDeleteTaskCommentMutation,
  useSubscribeTaskCommentThreadMutation,
  useTaskCommentSubscriptionsForTaskCollection,
  useTaskCommentModerationViewer,
  useTaskCommentsForTaskCollection,
  useUnsubscribeTaskCommentThreadMutation,
  useUpdateTaskCommentMutation,
  type TaskCommentCollectionItem,
} from "@/data/task-comments/taskCommentsData.app";
import {
  canModerateTaskComment,
  type TaskCommentModerationViewer,
} from "@/data/task-comments/taskCommentModeration-utils";
import { UserAvatar } from "@/components/avatars/userAvatar";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

const TASK_COMMENT_FRAGMENT_PREFIX = "task-comment-";
const TASK_COMMENT_HIGHLIGHT_MS = 2200;

function getTaskCommentFragment(commentId: string) {
  return `${TASK_COMMENT_FRAGMENT_PREFIX}${commentId}`;
}

function getTaskCommentIdFromHash(hash: string) {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  return fragment.startsWith(TASK_COMMENT_FRAGMENT_PREFIX)
    ? fragment.slice(TASK_COMMENT_FRAGMENT_PREFIX.length)
    : null;
}

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
  const { taskCommentSubscriptionsCollection } = useTaskCommentSubscriptionsForTaskCollection({
    churchId: props.churchId,
    currentUserId: props.currentUserId,
    taskId: props.taskEntityId,
  });
  const createComment = useCreateTaskCommentMutation({
    churchId: props.churchId,
    taskId: props.taskEntityId,
  });
  const updateComment = useUpdateTaskCommentMutation({ churchId: props.churchId });
  const deleteComment = useDeleteTaskCommentMutation({ churchId: props.churchId });
  const subscribeThread = useSubscribeTaskCommentThreadMutation({ churchId: props.churchId });
  const unsubscribeThread = useUnsubscribeTaskCommentThreadMutation({ churchId: props.churchId });
  const moderationViewer = useTaskCommentModerationViewer({
    currentUserId: props.currentUserId,
  });
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const clearHighlightTimeoutRef = useRef<number | null>(null);

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
  const subscribedRootCommentIds = useMemo(
    () =>
      new Set(
        taskCommentSubscriptionsCollection.map((subscription) => subscription.root_comment_id),
      ),
    [taskCommentSubscriptionsCollection],
  );

  // The query returns newest-first; the feed reads oldest-first like Linear.
  const ordered = useMemo(() => [...activitiesCollection].reverse(), [activitiesCollection]);

  useEffect(() => {
    const highlightHashTarget = () => {
      const commentId = getTaskCommentIdFromHash(window.location.hash);
      if (!commentId) return;
      if (!commentsById.has(commentId)) return;

      if (clearHighlightTimeoutRef.current !== null) {
        window.clearTimeout(clearHighlightTimeoutRef.current);
      }

      setHighlightedCommentId(commentId);
      window.requestAnimationFrame(() => {
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        document.getElementById(getTaskCommentFragment(commentId))?.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "center",
        });
      });
      clearHighlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedCommentId(null);
        clearHighlightTimeoutRef.current = null;
      }, TASK_COMMENT_HIGHLIGHT_MS);
    };

    highlightHashTarget();
    window.addEventListener("hashchange", highlightHashTarget);
    return () => {
      window.removeEventListener("hashchange", highlightHashTarget);
      if (clearHighlightTimeoutRef.current !== null) {
        window.clearTimeout(clearHighlightTimeoutRef.current);
        clearHighlightTimeoutRef.current = null;
      }
    };
  }, [commentsById]);

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[15px]">Activity</h3>
        {/* Activity header Subscribe button remains a task-level notification
            stub, separate from persisted comment thread subscriptions. */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                className="flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-muted-foreground"
                disabled
                type="button"
              />
            }
          >
            <Bell className="size-3.5" />
            Subscribe
          </TooltipTrigger>
          <TooltipContent>Task notifications are coming soon</TooltipContent>
        </Tooltip>
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
              deleteComment={deleteComment}
              highlightedCommentId={highlightedCommentId}
              moderationViewer={moderationViewer}
              resolveActorName={props.resolveActorName}
              repliesByParentCommentId={repliesByParentCommentId}
              resolvers={props.resolvers}
              subscribedRootCommentIds={subscribedRootCommentIds}
              subscribeThread={subscribeThread}
              unsubscribeThread={unsubscribeThread}
              updateComment={updateComment}
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
  deleteComment,
  highlightedCommentId,
  moderationViewer,
  resolvers,
  resolveActorName,
  repliesByParentCommentId,
  subscribedRootCommentIds,
  subscribeThread,
  unsubscribeThread,
  updateComment,
}: {
  readonly activity: ActivityCollectionItem;
  readonly commentsById: ReadonlyMap<string, TaskCommentCollectionItem>;
  readonly createComment: (body: string, parentCommentId?: string | null) => Promise<void>;
  readonly currentUserId: string | null;
  readonly deleteComment: (commentId: string) => Promise<void>;
  readonly highlightedCommentId: string | null;
  readonly moderationViewer: TaskCommentModerationViewer;
  readonly now: number;
  readonly resolvers: ActivityResolvers;
  readonly resolveActorName: (userId: string) => string | null;
  readonly repliesByParentCommentId: ReadonlyMap<string, readonly TaskCommentCollectionItem[]>;
  readonly updateComment: (commentId: string, body: string) => Promise<void>;
  readonly subscribedRootCommentIds: ReadonlySet<string>;
  readonly subscribeThread: (rootCommentId: string) => Promise<void>;
  readonly unsubscribeThread: (rootCommentId: string) => Promise<void>;
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
        highlighted={highlightedCommentId === comment.id}
        highlightedCommentId={highlightedCommentId}
        moderationViewer={moderationViewer}
        now={now}
        onReply={(body) => createComment(body, comment.id)}
        onSubscribeThread={() => subscribeThread(comment.id)}
        onUnsubscribeThread={() => unsubscribeThread(comment.id)}
        onDelete={deleteComment}
        onUpdate={updateComment}
        replies={repliesByParentCommentId.get(comment.id) ?? []}
        resolveActorName={resolveActorName}
        subscribed={subscribedRootCommentIds.has(comment.id)}
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
  highlighted,
  highlightedCommentId,
  moderationViewer,
  now,
  onDelete,
  onReply,
  onSubscribeThread,
  onUnsubscribeThread,
  onUpdate,
  replies,
  resolveActorName,
  subscribed,
  title,
}: {
  readonly comment: TaskCommentCollectionItem;
  readonly currentUserId: string | null;
  readonly highlighted: boolean;
  readonly highlightedCommentId: string | null;
  readonly moderationViewer: TaskCommentModerationViewer;
  readonly now: number;
  readonly onReply: (body: string) => Promise<void>;
  readonly onDelete: (commentId: string) => Promise<void>;
  readonly onUpdate: (commentId: string, body: string) => Promise<void>;
  readonly onSubscribeThread: () => Promise<void>;
  readonly onUnsubscribeThread: () => Promise<void>;
  readonly replies: readonly TaskCommentCollectionItem[];
  readonly resolveActorName: (userId: string) => string | null;
  readonly subscribed: boolean;
  readonly title: string;
}) {
  const actorName = resolveActorName(comment.authored_by_user_id) ?? "Unknown user";
  const createdAt = comment.created_at ?? now;
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState(false);
  const canReply = currentUserId !== null;
  const hasReplies = replies.length > 0;
  const isDeleted = comment.deleted_at !== null;
  const canModerate =
    !isDeleted &&
    canModerateTaskComment({
      viewer: moderationViewer,
      authoredByUserId: comment.authored_by_user_id,
    });
  const isEdited =
    !isDeleted && comment.updated_at !== null && comment.updated_at !== comment.created_at;

  return (
    <li
      className="group/comment flex items-start gap-2.5 py-0.5"
      id={getTaskCommentFragment(comment.id)}
    >
      <UserAvatar
        className="mt-0.5 shrink-0"
        name={actorName}
        size={28}
        userId={comment.authored_by_user_id}
      />
      <article
        className={cn(
          "min-w-0 flex-1 rounded-lg border bg-card shadow-xs transition-[box-shadow,background-color] duration-500",
          highlighted &&
            "border-primary/40 bg-primary/5 ring-2 ring-primary/45 ring-offset-2 ring-offset-background",
        )}
      >
        <header className="flex items-center gap-2 border-b px-3 py-1.5 text-sm">
          <span className="min-w-0 truncate font-medium text-foreground">{actorName}</span>
          {!isDeleted && subscribed ? <SubscribedIndicator /> : null}
          <span className="ml-auto shrink-0 text-muted-foreground text-xs" title={title}>
            {formatActivityTime(createdAt, now)}
          </span>
          {isEdited ? <EditedMarker editedAt={comment.updated_at} now={now} /> : null}
          {!isDeleted ? (
            <CommentActions
              entity="comment"
              isEditing={editing}
              subscribed={subscribed}
              onCopyMarkdown={() => copyCommentMarkdown(comment.body)}
              onCopyLink={() => copyTaskCommentLink(comment.id)}
              onDelete={() => onDelete(comment.id)}
              onStartEdit={() => setEditing(true)}
              onSubscribe={onSubscribeThread}
              onUnsubscribe={onUnsubscribeThread}
              canModerate={canModerate}
            />
          ) : null}
        </header>
        {isDeleted ? (
          <CommentTombstone label="This comment was deleted." />
        ) : editing ? (
          <CommentEditComposer
            initialBody={comment.body}
            onCancel={() => setEditing(false)}
            onSubmit={async (body) => {
              await onUpdate(comment.id, body);
              setEditing(false);
            }}
          />
        ) : (
          <p className="whitespace-pre-wrap break-words px-3 py-2.5 text-foreground/90 text-sm leading-relaxed">
            {comment.body}
          </p>
        )}

        {hasReplies ? (
          <ol aria-label="Replies" className="grid border-t">
            {replies.map((reply) => (
              <TaskCommentReply
                key={reply.id}
                moderationViewer={moderationViewer}
                now={now}
                reply={reply}
                onDelete={onDelete}
                onUpdate={onUpdate}
                onCopyMarkdown={() => copyCommentMarkdown(reply.body)}
                onCopyLink={() => copyTaskCommentLink(reply.id, "reply")}
                resolveActorName={resolveActorName}
                highlighted={highlightedCommentId === reply.id}
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
  highlighted,
  moderationViewer,
  now,
  onCopyLink,
  onCopyMarkdown,
  onDelete,
  onUpdate,
  reply,
  resolveActorName,
}: {
  readonly now: number;
  readonly reply: TaskCommentCollectionItem;
  readonly moderationViewer: TaskCommentModerationViewer;
  readonly onDelete: (commentId: string) => Promise<void>;
  readonly onUpdate: (commentId: string, body: string) => Promise<void>;
  readonly onCopyMarkdown: () => Promise<void>;
  readonly onCopyLink: () => Promise<void>;
  readonly resolveActorName: (userId: string) => string | null;
  readonly highlighted: boolean;
}) {
  const actorName = resolveActorName(reply.authored_by_user_id) ?? "Unknown user";
  const createdAt = reply.created_at ?? now;
  const [editing, setEditing] = useState(false);
  const isDeleted = reply.deleted_at !== null;
  const canModerate =
    !isDeleted &&
    canModerateTaskComment({
      viewer: moderationViewer,
      authoredByUserId: reply.authored_by_user_id,
    });
  const isEdited = !isDeleted && reply.updated_at !== null && reply.updated_at !== reply.created_at;

  return (
    <li
      className={cn(
        "group/reply flex items-start gap-2.5 px-3 py-2 transition-[box-shadow,background-color] duration-500 not-last:border-b",
        highlighted && "bg-primary/5 ring-2 ring-primary/45 ring-inset",
      )}
      id={getTaskCommentFragment(reply.id)}
    >
      <UserAvatar
        className="mt-0.5 shrink-0"
        name={actorName}
        size={22}
        userId={reply.authored_by_user_id}
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm leading-5">
          <span className="min-w-0 truncate font-medium text-foreground">{actorName}</span>
          <span
            className="shrink-0 text-muted-foreground text-xs"
            title={new Date(createdAt).toLocaleString()}
          >
            {formatActivityTime(createdAt, now)}
          </span>
          {isEdited ? <EditedMarker editedAt={reply.updated_at} now={now} /> : null}
          {!isDeleted ? (
            <CommentActions
              entity="reply"
              isEditing={editing}
              onCopyMarkdown={onCopyMarkdown}
              onCopyLink={onCopyLink}
              onDelete={() => onDelete(reply.id)}
              onStartEdit={() => setEditing(true)}
              canModerate={canModerate}
            />
          ) : null}
        </p>
        {isDeleted ? (
          <CommentTombstone className="mt-1 px-0 py-0" label="This reply was deleted." />
        ) : editing ? (
          <CommentEditComposer
            className="mt-1.5"
            initialBody={reply.body}
            onCancel={() => setEditing(false)}
            onSubmit={async (body) => {
              await onUpdate(reply.id, body);
              setEditing(false);
            }}
          />
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-foreground/90 text-sm leading-relaxed">
            {reply.body}
          </p>
        )}
      </div>
    </li>
  );
}

function CommentTombstone({
  className,
  label,
}: {
  readonly className?: string;
  readonly label: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-3 py-2.5 text-muted-foreground text-sm italic",
        className,
      )}
    >
      <Ban className="size-3.5 shrink-0 not-italic" />
      <span>{label}</span>
    </div>
  );
}

/**
 * A quiet, always-visible badge marking a thread the current User is subscribed
 * to, so subscription state reads at a glance without opening the overflow menu.
 */
function SubscribedIndicator() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            aria-label="Subscribed to this thread"
            className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground"
          />
        }
      >
        <Bell className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>You&rsquo;re subscribed to this thread</TooltipContent>
    </Tooltip>
  );
}

/** The quiet "edited" marker with an absolute-time tooltip, Linear-style. */
function EditedMarker({
  editedAt,
  now,
}: {
  readonly editedAt: number | null;
  readonly now: number;
}) {
  const editedTitle =
    editedAt !== null
      ? `Edited ${formatActivityTime(editedAt, now)} (${new Date(editedAt).toLocaleString()})`
      : "Edited";
  return (
    <span className="shrink-0 text-muted-foreground text-xs" title={editedTitle}>
      (edited)
    </span>
  );
}

async function copyCommentMarkdown(body: string) {
  try {
    await navigator.clipboard.writeText(body);
    toast.success("Copied comment as Markdown.");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Could not copy comment.");
  }
}

async function copyTaskCommentLink(commentId: string, entity: "comment" | "reply" = "comment") {
  try {
    const url = new URL(window.location.href);
    url.hash = getTaskCommentFragment(commentId);
    await navigator.clipboard.writeText(url.toString());
    toast.success(`Copied ${entity} link.`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : `Could not copy ${entity} link.`);
  }
}

function handleCommentAttachmentStub() {
  // TODO(attachments): open an upload picker once attachment storage exists.
  toast.info("Attachments are coming soon.");
}

/**
 * The composer paperclip affordance. Always visible so the surface reads as a
 * real composer, but a safe no-op for now: it surfaces a "coming soon" toast
 * and a tooltip rather than failing or hiding. See `handleCommentAttachmentStub`.
 */
function AttachmentStubButton({
  ariaLabel,
  size,
}: {
  readonly ariaLabel: string;
  readonly size: "icon-xs" | "icon-sm";
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={ariaLabel}
            className="text-muted-foreground"
            onClick={handleCommentAttachmentStub}
            size={size}
            type="button"
            variant="ghost"
          />
        }
      >
        <Paperclip />
      </TooltipTrigger>
      <TooltipContent>Attachments are coming soon</TooltipContent>
    </Tooltip>
  );
}

/**
 * The per-comment moderation menu: a hover-revealed kebab opening Edit + Delete.
 * Editing happens inline (via `onStartEdit`); deletion is gated behind an
 * AlertDialog so a soft-delete tombstone is never one stray click away. Both
 * authors and Church moderators reach this affordance (see
 * `canModerateTaskComment`).
 */
function CommentActions({
  canModerate,
  entity,
  isEditing,
  onCopyMarkdown,
  onCopyLink,
  onDelete,
  onStartEdit,
  onSubscribe,
  onUnsubscribe,
  subscribed,
}: {
  readonly canModerate: boolean;
  readonly entity: "comment" | "reply";
  readonly isEditing: boolean;
  readonly onCopyMarkdown: () => Promise<void>;
  readonly onCopyLink: () => Promise<void>;
  readonly onDelete: () => Promise<void>;
  readonly onStartEdit: () => void;
  readonly onSubscribe?: () => Promise<void>;
  readonly onUnsubscribe?: () => Promise<void>;
  readonly subscribed?: boolean;
}) {
  // Reveal the kebab only for the row it belongs to, so hovering a parent
  // comment never lights up every nested reply's menu at once.
  const revealOnHover =
    entity === "reply"
      ? "opacity-0 group-hover/reply:opacity-100"
      : "opacity-0 group-hover/comment:opacity-100";
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingSubscription, setTogglingSubscription] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
      setConfirmingDelete(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not delete ${entity}.`);
    } finally {
      setDeleting(false);
    }
  };

  const toggleSubscription = async () => {
    const action = subscribed ? onUnsubscribe : onSubscribe;
    if (!action) return;
    setTogglingSubscription(true);
    try {
      await action();
      toast.success(subscribed ? "Unsubscribed from this thread." : "Subscribed to this thread.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update thread subscription.");
    } finally {
      setTogglingSubscription(false);
    }
  };

  return (
    <>
      <DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`${entity === "reply" ? "Reply" : "Comment"} actions`}
              // Quiet until the row is hovered or the menu is open, matching the
              // row-action affordances used elsewhere in the app.
              className={cn(
                "-mr-1 ml-0.5 shrink-0 text-muted-foreground aria-expanded:opacity-100",
                revealOnHover,
              )}
              size="icon-xs"
              type="button"
              variant="ghost"
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-36">
          <DropdownMenuItem onClick={() => void onCopyLink()}>
            <LinkIcon />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void onCopyMarkdown()}>
            <Copy />
            Copy content as Markdown
          </DropdownMenuItem>
          {entity === "comment" ? (
            <DropdownMenuItem
              disabled={togglingSubscription || (!onSubscribe && !onUnsubscribe)}
              onClick={() => void toggleSubscription()}
            >
              {subscribed ? <BellOff /> : <Bell />}
              {subscribed ? "Unsubscribe from thread" : "Subscribe to thread"}
            </DropdownMenuItem>
          ) : null}
          {canModerate ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={isEditing}
                onClick={() => {
                  onStartEdit();
                  setMenuOpen(false);
                }}
              >
                <Pencil />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmingDelete(true);
                }}
                variant="destructive"
              >
                <Trash2 />
                Delete...
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog onOpenChange={setConfirmingDelete} open={confirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete this {entity}?</AlertDialogTitle>
            <AlertDialogDescription>
              The {entity} will be removed from the conversation and replaced with a
              &ldquo;deleted&rdquo; placeholder. This can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              loading={deleting}
              onClick={() => void handleDelete()}
              variant="destructive"
            >
              {deleting ? "Deleting..." : `Delete ${entity}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Inline editor for an existing Task Comment or reply. Mirrors the composer
 * affordances (focus ring, ⌘/Ctrl+Enter to save, Escape to cancel) and only
 * saves when the body actually changed.
 */
function CommentEditComposer({
  className,
  initialBody,
  onCancel,
  onSubmit,
}: {
  readonly className?: string;
  readonly initialBody: string;
  readonly onCancel: () => void;
  readonly onSubmit: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState(initialBody);
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);
  const trimmed = body.trim();
  const isUnchanged = trimmed === initialBody.trim();
  const canSubmit = trimmed.length > 0 && !isUnchanged && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save changes.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={cn("px-3 py-2.5", className)}>
      <div
        className={cn(
          "rounded-md border bg-background/60 px-2 py-1.5 transition-colors",
          focused && "border-ring ring-3 ring-ring/50",
        )}
      >
        <Textarea
          aria-label="Edit comment"
          autoFocus
          className="min-h-16 resize-y border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          onBlur={() => setFocused(false)}
          onChange={(event) => setBody(event.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void submit();
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
          value={body}
        />
        <div className="mt-1 flex items-center justify-end gap-1">
          <Button disabled={submitting} onClick={onCancel} size="sm" type="button" variant="ghost">
            Cancel
          </Button>
          <Button
            aria-label="Save"
            disabled={!canSubmit}
            loading={submitting}
            onClick={() => void submit()}
            size="sm"
            type="button"
          >
            Save
            <Kbd className="ml-1.5">mod enter</Kbd>
          </Button>
        </div>
      </div>
    </div>
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
        <div className="mt-1 flex items-center justify-between gap-1">
          <AttachmentStubButton ariaLabel="Attach file to reply" size="icon-xs" />
          <div className="flex items-center justify-end gap-1">
            <Button onClick={onCancel} size="sm" type="button" variant="ghost">
              Cancel
            </Button>
            <Button
              aria-label="Reply"
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
        <div className="mt-2 flex items-center justify-between gap-2">
          <AttachmentStubButton ariaLabel="Attach file to comment" size="icon-sm" />
          <Button
            aria-label="Comment"
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
