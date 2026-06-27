import type { LabelColor, TaskStatus } from "@church-work/domain";
import { CalendarIcon, LibraryBig, Tag, Triangle } from "lucide-react";
import type { ReactNode } from "react";

import { AssigneeAvatar, getPriorityMeta, type TaskPriority } from "./task-card-fields";
import { WorkflowStatusIcon } from "./task-card-fields";
import { UserAvatar } from "@/components/avatars/userAvatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Read-only Task presentation primitives.
 *
 * These render a Task exactly the way the live Board and List surfaces do —
 * same Workflow Status icon, same row/card chrome, same priority/label/cycle
 * chips — but from plain static data, with none of the form/keyboard/Zero
 * machinery the interactive surfaces carry. They are the single source of truth
 * for "what a Task looks like", shared between the live app and the marketing
 * product imagery so the two never drift.
 */

// Label Color token -> dot class, mirroring task-card-fields' private map so a
// presentational caller can color a Label dot without a full Label option.
const LABEL_DOT_CLASS: Record<LabelColor, string> = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  pink: "bg-pink-500",
};

export type PresentationLabel = {
  readonly name: string;
  readonly color: LabelColor;
};

export type PresentationAssignee = {
  readonly id: string;
  readonly name: string;
  // Optional avatar image URL. When present, the avatar renders this photo;
  // otherwise it falls back to the app's generated geometric avatar.
  readonly image?: string | null;
};

export type PresentationTask = {
  readonly identifier: string;
  readonly title: string;
  readonly state: TaskStatus;
  readonly priority?: TaskPriority;
  readonly labels?: readonly PresentationLabel[];
  readonly estimate?: string | null;
  readonly cycleLabel?: string | null;
  readonly assignee?: PresentationAssignee | null;
};

function LabelBadge({ label }: { readonly label: PresentationLabel }) {
  return (
    <Badge className="text-muted-foreground" variant="outline">
      <span className={cn("size-1.5 rounded-full", LABEL_DOT_CLASS[label.color])} />
      {label.name}
    </Badge>
  );
}

/**
 * The assignee avatar for a presentational Task. When the assignee carries an
 * image URL we render it as a real photo (the same `UserAvatar` image path the
 * live app uses); otherwise we fall back to the app's generated avatar via
 * `AssigneeAvatar`, so an assignee without a photo still looks like the product.
 */
function PresentationAssigneeAvatar({
  assignee,
}: {
  readonly assignee: PresentationAssignee | null | undefined;
}) {
  if (assignee?.image) {
    return (
      <UserAvatar avatar={assignee.image} name={assignee.name} size={20} userId={assignee.id} />
    );
  }
  return (
    <AssigneeAvatar
      assignee={assignee ? { id: assignee.id, label: assignee.name } : null}
      size={20}
    />
  );
}

function ChipShell({ children }: { readonly children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center justify-center gap-1 rounded-md border bg-background px-1.5">
      {children}
    </span>
  );
}

/**
 * A Task as a single List row — the same layout the live List surface renders:
 * priority icon, identifier, Workflow Status icon, title, then right-aligned
 * labels, cycle chip and assignee avatar.
 */
export function TaskRowPresentation({ task }: { readonly task: PresentationTask }) {
  // Fall back to the no-priority meta so a Task with no priority still shows the
  // app's muted "no priority" dashes — the same empty-state affordance the live
  // rows use — keeping the priority slot filled so identifiers stay aligned.
  const priorityMeta = getPriorityMeta(task.priority ?? "no_priority");
  const PriorityIcon = priorityMeta.icon;
  const hasPriority = task.priority != null && task.priority !== "no_priority";
  return (
    <div
      aria-label={`Task ${task.title}`}
      className={cn(
        "mx-1 my-0.5 flex h-9 items-center gap-2 rounded-md px-2",
        task.state === "canceled" && "opacity-70",
      )}
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        <PriorityIcon
          className={cn("size-4", hasPriority ? priorityMeta.className : "text-muted-foreground")}
        />
      </span>
      <span className="w-14 shrink-0 truncate font-medium text-muted-foreground text-xs">
        {task.identifier}
      </span>
      <span className="flex size-5 shrink-0 items-center justify-center">
        <WorkflowStatusIcon taskState={task.state} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {(task.labels ?? []).map((label) => (
          <LabelBadge key={label.name} label={label} />
        ))}
        {task.cycleLabel ? (
          <ChipShell>
            <CalendarIcon className="size-3.5" />
            <span className="text-muted-foreground text-xs">{task.cycleLabel}</span>
          </ChipShell>
        ) : null}
        <span className="flex size-5 items-center justify-center">
          <PresentationAssigneeAvatar assignee={task.assignee} />
        </span>
      </div>
    </div>
  );
}

/**
 * A Task as a Board card — the same Card chrome and chip row the live Board
 * renders: identifier + assignee header, Workflow Status icon beside the title,
 * then a priority/estimate/label/cycle chip row.
 */
export function TaskCardPresentation({ task }: { readonly task: PresentationTask }) {
  const priorityMeta = task.priority ? getPriorityMeta(task.priority) : null;
  const PriorityIcon = priorityMeta?.icon;
  return (
    <Card
      aria-label={`Task card ${task.title}`}
      className={cn(
        "gap-0 rounded-md py-0 shadow-xs ring-foreground/10",
        task.state === "canceled" && "opacity-70",
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-3 pt-3 pb-0">
        <span className="truncate font-medium text-muted-foreground text-xs">
          {task.identifier}
        </span>
        <span className="flex size-5 items-center justify-center">
          <PresentationAssigneeAvatar assignee={task.assignee} />
        </span>
      </CardHeader>
      <CardContent className="px-3 py-2">
        <div className="flex items-start gap-1.5">
          <span className="flex shrink-0 items-center pt-px">
            <span className="flex size-5 items-center justify-center">
              <WorkflowStatusIcon taskState={task.state} />
            </span>
          </span>
          <CardTitle className="line-clamp-2 font-semibold text-sm leading-snug">
            {task.title}
          </CardTitle>
        </div>
      </CardContent>
      <CardContent className="flex flex-wrap items-center gap-1.5 px-3 pt-0 pb-3">
        {priorityMeta && PriorityIcon ? (
          <span className="flex size-6 items-center justify-center rounded-md border bg-background">
            <PriorityIcon className={cn("size-3.5", priorityMeta.className)} />
          </span>
        ) : null}
        {task.estimate ? (
          <ChipShell>
            <Triangle className="size-3.5" />
            <span className="font-medium text-muted-foreground text-xs">{task.estimate}</span>
          </ChipShell>
        ) : null}
        {(task.labels ?? []).map((label) => (
          <LabelBadge key={label.name} label={label} />
        ))}
        {task.cycleLabel ? (
          <ChipShell>
            <CalendarIcon className="size-3.5" />
            <span className="text-muted-foreground text-xs">{task.cycleLabel}</span>
          </ChipShell>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * A read-only Board column — the same bg-muted/50 well, status-icon header and
 * count the live Board renders, with its cards stacked inside.
 */
export function BoardColumnPresentation({
  state,
  title,
  tasks,
}: {
  readonly state: TaskStatus;
  readonly title: string;
  readonly tasks: readonly PresentationTask[];
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg bg-muted/50">
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        <WorkflowStatusIcon taskState={state} />
        <span className="truncate font-medium text-sm">{title}</span>
        <span className="text-muted-foreground text-sm tabular-nums">{tasks.length}</span>
      </div>
      <div className="flex flex-col gap-2 px-2 pt-1.5 pb-2">
        {tasks.map((task) => (
          <TaskCardPresentation key={task.identifier} task={task} />
        ))}
      </div>
    </div>
  );
}

/**
 * The thin window-chrome frame the marketing imagery wraps a surface in, so a
 * presentation reads as an in-app screenshot. Lives here beside the surfaces it
 * frames; the live app renders these surfaces without it.
 */
export function ProductFrame({
  title,
  trailing,
  children,
  className,
  bodyClassName,
}: {
  readonly title: string;
  readonly trailing?: ReactNode;
  readonly children: ReactNode;
  // Pass `h-full` to make the frame fill its grid cell so sibling cards align.
  readonly className?: string;
  // The body region; pass `flex flex-1 flex-col` to let content fill height.
  readonly bodyClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-background shadow-xs",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <span className="size-2 rounded-full bg-red-400/80" />
        <span className="size-2 rounded-full bg-amber-400/80" />
        <span className="size-2 rounded-full bg-emerald-400/80" />
        <span className="ml-1 font-medium text-muted-foreground text-xs">{title}</span>
        {trailing ? <span className="ml-auto">{trailing}</span> : null}
      </div>
      <div className={cn("min-h-0", bodyClassName)}>{children}</div>
    </div>
  );
}

/** The empty-Labels affordance chip, for surfaces that show the "add labels" slot. */
export function EmptyLabelChip() {
  return (
    <span
      aria-label="Labels"
      className="flex size-6 items-center justify-center rounded-md border bg-background"
    >
      <Tag className="size-3.5" />
    </span>
  );
}

// --- Template projection ----------------------------------------------------

/**
 * A single Template Task chip on the projection rail. When `projected`, it's the
 * app's dashed, muted "ghost" placeholder for planned-but-not-yet-created work;
 * otherwise it's a live Task already in this week's Cycle — the same contrast
 * the live surfaces draw between projected rows and real ones.
 */
export function ProjectedTaskChip({
  label,
  color,
  projected = true,
}: {
  readonly label: string;
  readonly color: LabelColor;
  readonly projected?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
        projected
          ? "border-dashed border-foreground/20 bg-muted/20 text-muted-foreground"
          : "bg-background text-foreground shadow-xs",
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          LABEL_DOT_CLASS[color],
          projected && "opacity-70",
        )}
      />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

export type TemplateProjectionWeek = {
  readonly label: string;
  readonly relative?: string;
  // When false, this Week's Tasks are already live in its Cycle (solid chips);
  // when true/omitted, they're still projected ghosts waiting to be created.
  readonly projected?: boolean;
  readonly tasks: readonly {
    readonly label: string;
    readonly color: LabelColor;
  }[];
};

/**
 * The signature Templates view: one Template at the top, fanning its recurring
 * work across a rail of Weeks — the prep before, the work during, and the
 * follow-up after a service — each Task projected onto the right Cycle. Built
 * from the same icon tile, Shape badge and dashed-projection language the live
 * Templates surface uses. The current Week reads as live; the rest are
 * projected (ghost) Tasks waiting to be created.
 */
export function TemplateProjectionPresentation({
  name,
  shape,
  cadence,
  weeks,
}: {
  readonly name: string;
  readonly shape: string;
  readonly cadence: string;
  readonly weeks: readonly TemplateProjectionWeek[];
}) {
  return (
    <div className="flex h-full flex-col">
      {/* The Template — name, Shape badge, cadence. */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <LibraryBig className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate font-medium text-sm">{name}</span>
        <Badge variant="secondary">{shape}</Badge>
        <span className="hidden items-center gap-1 text-muted-foreground text-xs sm:flex">
          <CalendarIcon className="size-3.5" />
          {cadence}
        </span>
      </div>

      {/* The service lifecycle → before, during and after, each on its Week. */}
      <div className="border-t bg-muted/30 px-4 py-1.5 text-muted-foreground text-[11px] uppercase tracking-wide">
        Projects across the service
      </div>
      <div className="grid flex-1 grid-cols-3 gap-2 p-3">
        {weeks.map((week) => {
          const isLive = week.projected === false;
          return (
            <div
              className={cn(
                "flex min-w-0 flex-col rounded-lg p-2",
                isLive ? "bg-primary/5 ring-1 ring-primary/30" : "bg-muted/50",
              )}
              key={week.label}
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-1 px-0.5">
                <span className="truncate font-medium text-xs">{week.label}</span>
                {week.relative ? (
                  <span
                    className={cn(
                      "shrink-0 text-[11px]",
                      isLive ? "font-medium text-primary" : "text-muted-foreground",
                    )}
                  >
                    {week.relative}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                {week.tasks.map((task) => (
                  <ProjectedTaskChip
                    color={task.color}
                    key={task.label}
                    label={task.label}
                    projected={!isLive}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
