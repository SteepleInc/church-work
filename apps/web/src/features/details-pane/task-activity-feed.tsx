import {
  Ban,
  CalendarIcon,
  CircleDot,
  CirclePlus,
  Paperclip,
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
  readonly taskEntityId: string;
  readonly resolvers: ActivityResolvers;
  /** Resolves an actor user id to a display name; null when the user is gone. */
  readonly resolveActorName: (userId: string) => string | null;
};

/**
 * The read-only Activity Feed shown at the bottom of the Task Details Pane.
 * Renders one reverse-chronological line per Activity, leading with the actor's
 * avatar, an event glyph, the human-readable phrase, and a compact relative
 * timestamp (absolute time in the line's `title`). Comments, replies, and
 * subscriptions are deferred.
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
        <p className="text-muted-foreground text-sm">No activity yet.</p>
      ) : (
        <ol aria-label="Activity" className="grid gap-2.5">
          {ordered.map((activity) => (
            <ActivityRow
              activity={activity}
              key={activity.id}
              now={now}
              comments={taskCommentsCollection}
              resolveActorName={props.resolveActorName}
              resolvers={props.resolvers}
            />
          ))}
        </ol>
      )}

      <ActivityCommentComposer onSubmit={createComment} />
    </section>
  );
}

function ActivityRow({
  activity,
  now,
  comments,
  resolvers,
  resolveActorName,
}: {
  readonly activity: ActivityCollectionItem;
  readonly comments: readonly TaskCommentCollectionItem[];
  readonly now: number;
  readonly resolvers: ActivityResolvers;
  readonly resolveActorName: (userId: string) => string | null;
}) {
  const metadata = parseMetadata(activity.metadata);
  if (activity.event_type === "comment_created") {
    const commentId =
      metadata !== null && typeof metadata === "object"
        ? ((metadata as { readonly comment_id?: unknown }).comment_id as string | undefined)
        : undefined;
    const comment = comments.find((item) => item.id === commentId);
    if (!comment) return null;

    return (
      <TaskCommentCard
        comment={comment}
        now={now}
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

function TaskCommentCard({
  comment,
  now,
  resolveActorName,
  title,
}: {
  readonly comment: TaskCommentCollectionItem;
  readonly now: number;
  readonly resolveActorName: (userId: string) => string | null;
  readonly title: string;
}) {
  const actorName = resolveActorName(comment.authored_by_user_id) ?? "Unknown user";

  return (
    <li className="flex items-start gap-2.5" title={title}>
      <UserAvatar
        className="mt-1 shrink-0"
        name={actorName}
        size={24}
        userId={comment.authored_by_user_id}
      />
      <article className="min-w-0 flex-1 rounded-lg border bg-card px-3 py-2.5 shadow-xs">
        <header className="mb-1.5 flex items-center gap-1.5 text-sm">
          <span className="font-medium text-foreground">{actorName}</span>
          <span className="text-muted-foreground">
            · {formatActivityTime(comment.created_at ?? now, now)}
          </span>
        </header>
        <p className="whitespace-pre-wrap break-words text-sm text-foreground/90 leading-5">
          {comment.body}
        </p>
      </article>
    </li>
  );
}

function ActivityCommentComposer({
  onSubmit,
}: {
  readonly onSubmit: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = body.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(body);
      setBody("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-2">
      <Textarea
        aria-label="Add a comment"
        className="min-h-24 resize-y border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
        }}
        placeholder="Leave a comment..."
        value={body}
      />
      <div className="mt-2 flex items-center justify-between">
        <Button disabled size="icon" type="button" variant="ghost">
          <Paperclip className="size-4" />
        </Button>
        <Button disabled={!canSubmit} onClick={() => void submit()} size="sm" type="button">
          Comment
        </Button>
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
