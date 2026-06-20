import {
  Ban,
  CalendarIcon,
  CircleDot,
  CirclePlus,
  RotateCcw,
  Tag,
  Triangle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";

import {
  useActivitiesForEntityCollection,
  type ActivityCollectionItem,
} from "@/data/activities/activitiesData.app";
import { UserAvatar } from "@/components/avatars/userAvatar";
import { Skeleton } from "@/components/ui/skeleton";
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
              resolveActorName={props.resolveActorName}
              resolvers={props.resolvers}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function ActivityRow({
  activity,
  now,
  resolvers,
  resolveActorName,
}: {
  readonly activity: ActivityCollectionItem;
  readonly now: number;
  readonly resolvers: ActivityResolvers;
  readonly resolveActorName: (userId: string) => string | null;
}) {
  const metadata = parseMetadata(activity.metadata);
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
