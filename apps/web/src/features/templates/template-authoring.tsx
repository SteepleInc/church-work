import {
  CalendarDays,
  Check,
  Flag,
  Layers,
  Plus,
  Repeat,
  Repeat2,
  Trash2,
  Triangle,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  buildPeriodPlacementFrame,
  defaultTemplateScheduleForPlacementShape,
  resolvePeriodPlacementDueDate,
  type PeriodPlacementFrame,
  type PeriodTemplatePlacementShape,
} from "@church-task/domain";

import { TeamAvatar } from "@/components/avatars/teamAvatar";
import {
  AssigneeAvatar,
  AssigneeComboboxSelector,
  EstimateComboboxSelector,
  getEstimateMeta,
  LabelsComboboxSelector,
  labelDotClassName,
  TeamComboboxSelector,
  type TaskEstimate,
} from "@/components/tasks/task-card-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useLabelsCollection, type LabelItem } from "@/data/labels/labelsData.app";
import {
  useTeamMembershipsCollection,
  useTeamsCollection,
  type TeamCollectionItem,
} from "@/data/teams/teamsData.app";
import { getUserDisplayName, useChurchUsersCollection } from "@/data/users/usersData.app";
import {
  useCreatePeriodTemplate,
  useCreateWeeklyServiceTemplate,
} from "@/data/templates/templatesData.app";
import { cn } from "@/lib/utils";

// --- Weekday model ----------------------------------------------------------
// JS getDay() weekdays (0 = Sunday). The Cycle calendar always renders
// Monday-first per CONTEXT.md "Cycle" (Monday-to-Sunday).

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Monday-first ordering of JS weekday indices.
const MONDAY_FIRST: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

type DraftTask = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly teamId: string;
  readonly assigneeId: string | null;
  readonly labelIds: readonly string[];
  readonly estimate: TaskEstimate;
  /** JS weekday (0 = Sunday) the Template Task is due on within its Cycle. */
  readonly placementWeekday: number;
  /**
   * For period shapes only: which Cycle of the normalized frame the Template
   * Task lives in, indexed from 0. Ignored for the weekly service shape.
   */
  readonly cycleIndex: number;
};

type TemplateAuthoringShape = "weekly_service" | PeriodTemplatePlacementShape;

const ESTIMATE_TO_KEY: Record<TaskEstimate, string | null> = {
  no_estimate: null,
  xs: "xs",
  s: "s",
  m: "m",
  l: "l",
  xl: "xl",
};

const newDraftTask = (placementWeekday: number, teamId: string, cycleIndex = 0): DraftTask => ({
  assigneeId: null,
  cycleIndex,
  description: "",
  estimate: "no_estimate",
  id: crypto.randomUUID(),
  labelIds: [],
  placementWeekday,
  teamId,
  title: "",
});

const MONDAY_FIRST_INDEX = (jsWeekday: number) => (jsWeekday + 6) % 7;

/** Per-shape copy used across the authoring surface. */
const SHAPE_META: Record<
  TemplateAuthoringShape,
  { readonly title: string; readonly badge: string }
> = {
  monthly: { badge: "Monthly", title: "monthly" },
  quarterly: { badge: "Quarterly", title: "quarterly" },
  weekly_service: { badge: "Weekly service", title: "weekly service" },
  yearly: { badge: "Yearly", title: "yearly" },
};

type AssigneeOption = { readonly id: string; readonly label: string };

/** Shared Template Task picker context reused by every Template Task card. */
type TaskFieldProps = {
  readonly teams: readonly TeamCollectionItem[];
  readonly teamPickerOptions: readonly { id: string; name: string; color: string | null }[];
  readonly memberTeamIds: ReadonlySet<string>;
  readonly assigneeOptions: readonly AssigneeOption[];
  readonly churchLabels: readonly LabelItem[];
  readonly memberships: readonly { teamId: string; userId: string }[];
  readonly currentUserId: string | null;
};

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "template"
  );
}

/** The next calendar date (YYYY-MM-DD) that falls on the given JS weekday. */
function nextWeekdayDate(weekday: number) {
  const date = new Date();
  const diff = (weekday - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + diff);
  return formatLocalDate(date);
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatLongDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function nextPeriodStartDate(shape: PeriodTemplatePlacementShape) {
  const today = new Date();
  if (shape === "monthly")
    return formatLocalDate(new Date(today.getFullYear(), today.getMonth() + 1, 1));
  if (shape === "quarterly") {
    const nextQuarterMonth = Math.floor(today.getMonth() / 3) * 3 + 3;
    return formatLocalDate(new Date(today.getFullYear(), nextQuarterMonth, 1));
  }
  return formatLocalDate(new Date(today.getFullYear() + 1, 0, 1));
}

/**
 * The weekly service Template authoring flow. A single guided surface that
 * mirrors Church Task's planning language: pick the Template shape, choose the
 * service weekday, place Template Tasks on a vertical Monday–Sunday Cycle
 * calendar, preview the first projected Week, and save (optionally creating a
 * repeating weekly Template Schedule). Template Tasks carry planning fields
 * only — no Workflow Status or Task State (see CONTEXT.md "Template Task").
 */
export function TemplateAuthoring() {
  const { currentOrgOpt: activeChurch, loading: churchLoading } = useCurrentOrgOpt();
  const churchId = activeChurch?.id ?? null;
  const currentUserId = activeChurch?.currentUserId ?? null;

  const teams = useTeamsCollection({ churchId });
  const users = useChurchUsersCollection({ churchId });
  const labels = useLabelsCollection({ churchId });
  const memberships = useTeamMembershipsCollection({ churchId });
  const createTemplate = useCreateWeeklyServiceTemplate();
  const createPeriodTemplate = useCreatePeriodTemplate();

  const teamsCollection = teams.teamsCollection;
  const defaultTeamId = teamsCollection[0]?.id ?? "";

  const [name, setName] = useState("Weekly Service");
  const [shape, setShape] = useState<TemplateAuthoringShape>("weekly_service");
  const [serviceWeekday, setServiceWeekday] = useState(0); // Sunday default
  const [schedule, setSchedule] = useState(true);
  const [repeatYearly, setRepeatYearly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tasks, setTasks] = useState<readonly DraftTask[]>([]);

  const startDate = useMemo(() => nextWeekdayDate(serviceWeekday), [serviceWeekday]);
  const periodStartDate = useMemo(
    () => (shape === "weekly_service" ? startDate : nextPeriodStartDate(shape)),
    [shape, startDate],
  );
  const periodFrame = useMemo(
    () =>
      shape === "weekly_service"
        ? null
        : buildPeriodPlacementFrame({ periodStartLocalDate: periodStartDate, shape }),
    [shape, periodStartDate],
  );

  const memberTeamIds = useMemo(
    () =>
      new Set(
        memberships.teamMembershipsCollection
          .filter((membership) => membership.userId === currentUserId)
          .map((membership) => membership.teamId),
      ),
    [memberships.teamMembershipsCollection, currentUserId],
  );

  const teamPickerOptions = useMemo(
    () =>
      teamsCollection.map((team) => ({
        id: team.id,
        name: team.name,
        color: team.color as string | null,
      })),
    [teamsCollection],
  );

  const assigneeOptions = useMemo(
    () => users.usersCollection.map((user) => ({ id: user.id, label: getUserDisplayName(user) })),
    [users.usersCollection],
  );

  const placedCount = tasks.filter((task) => task.title.trim() && task.teamId).length;

  // The Template Task picker context (Teams, assignees, Labels, memberships)
  // shared by every Template Task card across both authoring surfaces.
  const taskFieldProps = useMemo<TaskFieldProps>(
    () => ({
      assigneeOptions,
      churchLabels: labels.labelsCollection,
      currentUserId,
      memberTeamIds,
      memberships: memberships.teamMembershipsCollection,
      teamPickerOptions,
      teams: teamsCollection,
    }),
    [
      assigneeOptions,
      labels.labelsCollection,
      currentUserId,
      memberTeamIds,
      memberships.teamMembershipsCollection,
      teamPickerOptions,
      teamsCollection,
    ],
  );

  const updateTask = (id: string, patch: Partial<DraftTask>) => {
    setSaved(false);
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  };

  const addTask = (placementWeekday: number, cycleIndex = 0) => {
    setSaved(false);
    setTasks((current) => [...current, newDraftTask(placementWeekday, defaultTeamId, cycleIndex)]);
  };

  const removeTask = (id: string) => {
    setSaved(false);
    setTasks((current) => current.filter((task) => task.id !== id));
  };

  const save = async () => {
    if (!churchId) return;
    const validTasks = tasks.filter((task) => task.title.trim() && task.teamId);
    if (validTasks.length === 0) {
      setError("Add at least one Template Task with a title and Team.");
      return;
    }
    setError(null);
    setSaving(true);
    const templateTeams = Array.from(new Set(validTasks.map((task) => task.teamId))).flatMap(
      (teamId) => {
        const team = teamsCollection.find((candidate) => candidate.id === teamId);
        return team ? [{ key: team.identifier, mapped_team_id: team.id, name: team.name }] : [];
      },
    );
    const common = {
      churchId,
      key: slugify(name),
      name: name.trim() || "Weekly Service",
      schedule,
      tasks: validTasks.map((task, index) => {
        const team = teamsCollection.find((candidate) => candidate.id === task.teamId);
        return {
          assignedUserId: task.assigneeId,
          description: task.description.trim() || null,
          estimate: ESTIMATE_TO_KEY[task.estimate],
          key: `task-${index + 1}-${slugify(task.title)}`,
          labelIds: [...task.labelIds],
          placementCycleOffset: 0,
          placementWeekday: task.placementWeekday,
          templateTeamKey: team?.identifier ?? templateTeams[0]?.key ?? "team",
          title: task.title.trim(),
        };
      }),
      templateTeams,
    };
    const frameSize = periodFrame?.cycles.length ?? 1;
    const result =
      shape === "weekly_service"
        ? await createTemplate({ ...common, serviceWeekday, startDate })
        : await createPeriodTemplate({
            ...common,
            name: name.trim() || `${shape[0]?.toUpperCase()}${shape.slice(1)} Template`,
            periodStartDate,
            scheduleDefaults: defaultTemplateScheduleForPlacementShape(shape, { repeatYearly }),
            shape,
            // Period placement: anchor each Template Task to its Cycle in the
            // normalized frame (offset from the frame's last Cycle) and its
            // Monday-first weekday within that Cycle.
            tasks: validTasks.map((task, index) => {
              const team = teamsCollection.find((candidate) => candidate.id === task.teamId);
              return {
                assignedUserId: task.assigneeId,
                description: task.description.trim() || null,
                estimate: ESTIMATE_TO_KEY[task.estimate],
                key: `task-${index + 1}-${slugify(task.title)}`,
                labelIds: [...task.labelIds],
                placementCycleOffset:
                  Math.min(Math.max(task.cycleIndex, 0), frameSize - 1) - (frameSize - 1),
                placementWeekday: MONDAY_FIRST_INDEX(task.placementWeekday),
                templateTeamKey: team?.identifier ?? templateTeams[0]?.key ?? "team",
                title: task.title.trim(),
              };
            }),
          });
    setSaving(false);
    if (result.ok) {
      setSaved(true);
    } else {
      setError(result.error.message);
    }
  };

  const dataLoading = churchLoading;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Layers className="size-4" />
          <span>Templates</span>
        </div>
        <h1 className="font-semibold text-2xl tracking-tight">
          New {SHAPE_META[shape].title} Template
        </h1>
        <p className="max-w-2xl text-muted-foreground text-sm">
          Author a reusable Template, place its Template Tasks across normalized Cycle frames, and
          schedule it to project work into upcoming Cycles.
        </p>
      </header>

      <ShapeStep
        name={name}
        onNameChange={(next) => {
          setSaved(false);
          setName(next);
        }}
        onShapeChange={(next) => {
          setSaved(false);
          setShape(next);
          setSchedule(next === "yearly" ? false : true);
        }}
        shape={shape}
      />

      {shape === "weekly_service" ? (
        <ScheduleStep
          onWeekdayChange={(next) => {
            setSaved(false);
            setServiceWeekday(next);
          }}
          serviceWeekday={serviceWeekday}
          startDate={startDate}
        />
      ) : (
        <PeriodScheduleStep
          frame={periodFrame}
          onRepeatYearlyChange={(next) => {
            setSaved(false);
            setRepeatYearly(next);
          }}
          repeatYearly={repeatYearly}
          shape={shape}
          startDate={periodStartDate}
        />
      )}

      {shape === "weekly_service" ? (
        <CycleCalendarStep
          addTask={addTask}
          fieldProps={taskFieldProps}
          loading={dataLoading}
          removeTask={removeTask}
          serviceWeekday={serviceWeekday}
          tasks={tasks}
          updateTask={updateTask}
        />
      ) : (
        <PeriodFrameStep
          addTask={addTask}
          fieldProps={taskFieldProps}
          frame={periodFrame}
          loading={dataLoading}
          removeTask={removeTask}
          shape={shape}
          tasks={tasks}
          teamsAvailable={teamsCollection.length > 0}
          updateTask={updateTask}
        />
      )}

      <SaveStep
        canSave={Boolean(churchId) && placedCount > 0}
        error={error}
        frame={periodFrame}
        onSave={save}
        onScheduleChange={(next) => {
          setSaved(false);
          setSchedule(next);
        }}
        placedCount={placedCount}
        repeatYearly={repeatYearly}
        saved={saved}
        saving={saving}
        schedule={schedule}
        serviceWeekday={serviceWeekday}
        shape={shape}
        startDate={shape === "weekly_service" ? startDate : periodStartDate}
        templateName={name}
      />
    </div>
  );
}

// --- Step shell -------------------------------------------------------------

function StepSection({
  step,
  title,
  description,
  children,
  action,
}: {
  readonly step: number;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly action?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground text-xs">
            {step}
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 className="font-medium text-sm">{title}</h2>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="pl-9">{children}</div>
    </section>
  );
}

// --- Step 1: Shape ----------------------------------------------------------

const SHAPES = [
  {
    key: "weekly_service",
    label: "Weekly service",
    description: "Monday–Sunday Cycle, placed by weekday",
    available: true,
  },
  {
    key: "monthly",
    label: "Monthly",
    description: "Five-Cycle month frame",
    available: true,
  },
  {
    key: "quarterly",
    label: "Quarterly",
    description: "Thirteen-Cycle quarter frame",
    available: true,
  },
  {
    key: "yearly",
    label: "Yearly",
    description: "Fifty-two-Cycle year frame",
    available: true,
  },
] as const;

function ShapeStep({
  name,
  onNameChange,
  onShapeChange,
  shape: selectedShape,
}: {
  readonly name: string;
  readonly onNameChange: (next: string) => void;
  readonly onShapeChange: (next: TemplateAuthoringShape) => void;
  readonly shape: TemplateAuthoringShape;
}) {
  return (
    <StepSection
      description="Choose the authoring frame. Period shapes use normalized Cycle frames."
      step={1}
      title="Template shape"
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SHAPES.map((shape) => (
            <button
              aria-current={selectedShape === shape.key ? "true" : undefined}
              aria-disabled={!shape.available}
              aria-label={`${shape.label} Template shape${selectedShape === shape.key ? " selected" : ""}`}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
                selectedShape === shape.key
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-border hover:bg-muted/60",
              )}
              disabled={!shape.available}
              key={shape.key}
              onClick={() => onShapeChange(shape.key)}
              type="button"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm text-foreground">{shape.label}</span>
                {selectedShape === shape.key ? (
                  <span className="inline-flex items-center gap-1 font-medium text-[10px] text-primary uppercase tracking-wide">
                    <Check className="size-3.5" />
                    Selected
                  </span>
                ) : !shape.available ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    Soon
                  </span>
                ) : null}
              </div>
              <span className="text-muted-foreground text-xs">{shape.description}</span>
            </button>
          ))}
        </div>
        <div className="flex max-w-md flex-col gap-1.5">
          <label className="font-medium text-sm" htmlFor="template-name">
            Template name
          </label>
          <Input
            id="template-name"
            onChange={(event) => onNameChange(event.currentTarget.value)}
            placeholder="Weekly Service"
            value={name}
          />
        </div>
      </div>
    </StepSection>
  );
}

function PeriodScheduleStep({
  frame,
  onRepeatYearlyChange,
  repeatYearly,
  shape,
  startDate,
}: {
  readonly frame: PeriodPlacementFrame | null;
  readonly onRepeatYearlyChange: (next: boolean) => void;
  readonly repeatYearly: boolean;
  readonly shape: PeriodTemplatePlacementShape;
  readonly startDate: string;
}) {
  const label = SHAPE_META[shape].badge;
  const cycles = frame?.cycles ?? [];
  return (
    <StepSection
      description="The period start anchors the normalized Cycle frame. Each Cycle is owned by the period it mostly covers; boundary Cycles are marked."
      step={2}
      title={`${label} frame`}
    >
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-foreground text-sm">
            <CalendarDays className="size-4 text-muted-foreground" />
            <span className="font-medium">{ownedPeriodLabel(frame?.periodKey ?? "")}</span>
            <span className="text-muted-foreground">
              · {cycles.length} {cycles.length === 1 ? "Cycle" : "Cycles"} · starts{" "}
              {formatShortDate(startDate)}
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex h-3 overflow-hidden rounded-full bg-muted/60">
            {cycles.map((cycle, index) => {
              const hasBoundary = cycle.days.some((day) => day.isPeriodBoundary);
              const prev = cycles[index - 1];
              // A period seam sits where the owned period changes between two
              // adjacent Cycles — the moment one month/quarter hands off to the
              // next inside the normalized frame.
              const startsNewPeriod =
                index > 0 && prev !== undefined && prev.ownedPeriodKey !== cycle.ownedPeriodKey;
              return (
                <Tooltip key={cycle.startLocalDate}>
                  <TooltipTrigger
                    className={cn(
                      "h-full flex-1 transition-colors",
                      cycle.isInFocusPeriod ? "bg-primary" : "bg-muted-foreground/25",
                      startsNewPeriod && "border-card border-l-2",
                      hasBoundary && "bg-amber-500 dark:bg-amber-400",
                    )}
                  />
                  <TooltipContent>
                    Cycle of {formatShortDate(cycle.startLocalDate)} · owns{" "}
                    {ownedPeriodLabel(cycle.ownedPeriodKey)}
                    {hasBoundary ? " · period boundary" : ""}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" />
              In period
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-muted-foreground/25" />
              Carried Cycle
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-500 dark:bg-amber-400" />
              Boundary Cycle
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-px bg-foreground/40" />
              Period seam
            </span>
          </div>
        </div>

        {shape === "yearly" ? (
          <label className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
            <span className="flex items-start gap-2.5">
              <Repeat2 className="mt-0.5 size-4 text-muted-foreground" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-sm">Repeat every year</span>
                <span className="text-muted-foreground text-xs">
                  Yearly Templates default to a single one-off for this year.
                </span>
              </span>
            </span>
            <Switch checked={repeatYearly} onCheckedChange={onRepeatYearlyChange} />
          </label>
        ) : (
          <p className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <Repeat2 className="size-3.5" />
            {shape === "monthly" ? "Monthly" : "Quarterly"} schedules repeat by default.
          </p>
        )}
      </div>
    </StepSection>
  );
}

// --- Step 2: Weekday scheduling --------------------------------------------

function ScheduleStep({
  serviceWeekday,
  startDate,
  onWeekdayChange,
}: {
  readonly serviceWeekday: number;
  readonly startDate: string;
  readonly onWeekdayChange: (next: number) => void;
}) {
  return (
    <StepSection
      description="The service day anchors the Cycle. Template Tasks placed on it are due that day."
      step={2}
      title="Service day"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Service weekday">
          {MONDAY_FIRST.map((weekday) => {
            const selected = weekday === serviceWeekday;
            return (
              <button
                aria-pressed={selected}
                className={cn(
                  "rounded-md border px-3 py-1.5 font-medium text-sm transition-colors",
                  selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
                key={weekday}
                onClick={() => onWeekdayChange(weekday)}
                type="button"
              >
                {WEEKDAY_SHORT[weekday]}
              </button>
            );
          })}
        </div>
        <p className="flex items-center gap-2 text-muted-foreground text-sm">
          <CalendarDays className="size-4" />
          First projected service: {formatLongDate(startDate)}
        </p>
      </div>
    </StepSection>
  );
}

// --- Step 3: Vertical Monday–Sunday Cycle calendar --------------------------

function CycleCalendarStep({
  tasks,
  fieldProps,
  serviceWeekday,
  loading,
  addTask,
  updateTask,
  removeTask,
}: {
  readonly tasks: readonly DraftTask[];
  readonly fieldProps: TaskFieldProps;
  readonly serviceWeekday: number;
  readonly loading: boolean;
  readonly addTask: (weekday: number) => void;
  readonly updateTask: (id: string, patch: Partial<DraftTask>) => void;
  readonly removeTask: (id: string) => void;
}) {
  const totalPlaced = tasks.filter((task) => task.title.trim() && task.teamId).length;

  return (
    <StepSection
      action={
        totalPlaced > 0 ? (
          <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground text-xs">
            {totalPlaced} Template {totalPlaced === 1 ? "Task" : "Tasks"}
          </span>
        ) : null
      }
      description="Place Template Tasks on the day they are due. No Workflow Status or Task State yet."
      step={3}
      title="Cycle calendar"
    >
      {loading ? (
        <CalendarSkeleton />
      ) : fieldProps.teams.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          Create a Team before authoring Template Tasks.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {MONDAY_FIRST.map((weekday, index) => {
            const dayTasks = tasks.filter((task) => task.placementWeekday === weekday);
            const isService = weekday === serviceWeekday;
            return (
              <div
                className={cn(
                  "flex gap-3 px-3 py-3 sm:px-4",
                  index !== 0 && "border-t",
                  isService &&
                    "border-l-2 border-l-primary bg-primary/[0.06] pl-[calc(0.75rem-2px)] sm:pl-[calc(1rem-2px)]",
                )}
                key={weekday}
              >
                <div className="flex w-24 shrink-0 flex-col gap-1 pt-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm">{WEEKDAY_NAMES[weekday]}</span>
                  </div>
                  {isService ? (
                    <span className="inline-flex w-fit items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary uppercase tracking-wide">
                      Service
                    </span>
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {dayTasks.map((task) => (
                    <TemplateTaskCard
                      fieldProps={fieldProps}
                      key={task.id}
                      onChange={(patch) => updateTask(task.id, patch)}
                      onRemove={() => removeTask(task.id)}
                      task={task}
                    />
                  ))}
                  <AddTaskButton onClick={() => addTask(weekday)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </StepSection>
  );
}

// --- Step 3 (period shapes): normalized Cycle frame -------------------------

/**
 * Period authoring surface. Renders the normalized 5/13/52-Cycle frame from the
 * domain, grouped by owned period (the month or quarter each Cycle belongs to),
 * with explicit period-boundary markers. Each Cycle row exposes a Monday-first
 * weekday picker so Template Tasks land on a precise (Cycle, weekday) cell, and
 * carries its real first-period due date in a Tooltip.
 */
function PeriodFrameStep({
  tasks,
  fieldProps,
  frame,
  shape,
  loading,
  teamsAvailable,
  addTask,
  updateTask,
  removeTask,
}: {
  readonly tasks: readonly DraftTask[];
  readonly fieldProps: TaskFieldProps;
  readonly frame: PeriodPlacementFrame | null;
  readonly shape: PeriodTemplatePlacementShape;
  readonly loading: boolean;
  readonly teamsAvailable: boolean;
  readonly addTask: (weekday: number, cycleIndex: number) => void;
  readonly updateTask: (id: string, patch: Partial<DraftTask>) => void;
  readonly removeTask: (id: string) => void;
}) {
  const totalPlaced = tasks.filter((task) => task.title.trim() && task.teamId).length;
  const cycles = frame?.cycles ?? [];
  const frameSize = cycles.length;

  // Group consecutive Cycles by their owned period so quarterly/yearly frames
  // read as the months they cover instead of a flat 13/52-row wall. The focus
  // period — the month/quarter the Template is actually for — is flagged so it
  // reads as primary against the carried boundary periods on either side.
  const groups = useMemo(() => {
    const result: {
      label: string;
      readonly entries: number[];
      readonly isFocusPeriod: boolean;
    }[] = [];
    cycles.forEach((cycle, index) => {
      const last = result.at(-1);
      if (last && last.label === ownedPeriodLabel(cycle.ownedPeriodKey)) {
        last.entries.push(index);
      } else {
        result.push({
          entries: [index],
          isFocusPeriod: cycle.isInFocusPeriod,
          label: ownedPeriodLabel(cycle.ownedPeriodKey),
        });
      }
    });
    return result;
  }, [cycles]);

  return (
    <StepSection
      action={
        totalPlaced > 0 ? (
          <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground text-xs">
            {totalPlaced} Template {totalPlaced === 1 ? "Task" : "Tasks"}
          </span>
        ) : null
      }
      description={`Place Template Tasks across the ${frameSize}-Cycle ${shape} frame. Each Cycle owns the period it covers; boundaries are marked. No Workflow Status or Task State yet.`}
      step={3}
      title="Cycle frame"
    >
      {loading ? (
        <CalendarSkeleton />
      ) : !teamsAvailable ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          Create a Team before authoring Template Tasks.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <div className="flex flex-col gap-2" key={group.label}>
              <div className="flex items-center gap-2 px-0.5">
                <span
                  className={cn(
                    "font-medium text-xs uppercase tracking-wide",
                    group.isFocusPeriod ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {group.label}
                </span>
                {group.isFocusPeriod ? (
                  <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary uppercase tracking-wide">
                    In period
                  </span>
                ) : (
                  <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
                    Carried
                  </span>
                )}
                <span
                  className={cn("h-px flex-1", group.isFocusPeriod ? "bg-primary/30" : "bg-border")}
                />
                <span className="text-muted-foreground text-xs">
                  {group.entries.length} {group.entries.length === 1 ? "Cycle" : "Cycles"}
                </span>
              </div>
              <div
                className={cn(
                  "overflow-hidden rounded-xl border bg-card",
                  group.isFocusPeriod && "border-primary/30 ring-1 ring-primary/10",
                )}
              >
                {group.entries.map((cycleIndex, rowInGroup) => {
                  const cycle = cycles[cycleIndex];
                  if (!cycle) return null;
                  const cycleTasks = tasks.filter((task) => task.cycleIndex === cycleIndex);
                  const boundaryDay = cycle.days.find((day) => day.isPeriodBoundary);
                  return (
                    <PeriodCycleRow
                      addTask={(weekday) => addTask(weekday, cycleIndex)}
                      boundaryLabel={
                        boundaryDay ? boundaryLabelFor(boundaryDay.localDate, frame) : null
                      }
                      cycle={cycle}
                      cycleIndex={cycleIndex}
                      endCycleStartLocalDate={frame?.endCycleStartLocalDate ?? cycle.startLocalDate}
                      fieldProps={fieldProps}
                      frameSize={frameSize}
                      isFirstRow={rowInGroup === 0}
                      key={cycle.startLocalDate}
                      label={`Week ${cycleIndex + 1}`}
                      removeTask={removeTask}
                      tasks={cycleTasks}
                      updateTask={updateTask}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </StepSection>
  );
}

/** Human label for an owned period key like `2026-02` or `2026-Q1`. */
function ownedPeriodLabel(periodKey: string) {
  const quarterMatch = /^(\d{4})-Q(\d)$/.exec(periodKey);
  if (quarterMatch) return `Q${quarterMatch[2]} ${quarterMatch[1]}`;
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }
  return periodKey;
}

/** A short "Period starts/ends" label for a boundary day inside a Cycle. */
function boundaryLabelFor(localDate: string, frame: PeriodPlacementFrame | null) {
  if (!frame) return null;
  const isStart = frame.cycles[0]?.days.some(
    (day) => day.isPeriodBoundary && day.localDate === localDate,
  );
  const short = formatShortDate(localDate);
  return isStart ? `Period starts ${short}` : `Period ends ${short}`;
}

function formatShortDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

/** One Cycle row in the period frame: weekday picker, due date, Template Tasks. */
function PeriodCycleRow({
  cycle,
  cycleIndex,
  label,
  boundaryLabel,
  endCycleStartLocalDate,
  frameSize,
  isFirstRow,
  tasks,
  fieldProps,
  addTask,
  updateTask,
  removeTask,
}: {
  readonly cycle: PeriodPlacementFrame["cycles"][number];
  readonly cycleIndex: number;
  readonly label: string;
  readonly boundaryLabel: string | null;
  readonly endCycleStartLocalDate: string;
  readonly frameSize: number;
  readonly isFirstRow: boolean;
  readonly tasks: readonly DraftTask[];
  readonly fieldProps: TaskFieldProps;
  readonly addTask: (weekday: number) => void;
  readonly updateTask: (id: string, patch: Partial<DraftTask>) => void;
  readonly removeTask: (id: string) => void;
}) {
  const cycleOffsetFromEnd = cycleIndex - (frameSize - 1);
  return (
    <div
      className={cn(
        "flex gap-3 px-3 py-3 sm:px-4",
        !isFirstRow && "border-t",
        boundaryLabel &&
          "border-l-2 border-l-amber-500 bg-amber-500/[0.05] pl-[calc(0.75rem-2px)] dark:border-l-amber-400 sm:pl-[calc(1rem-2px)]",
      )}
    >
      <div className="flex w-28 shrink-0 flex-col gap-1 pt-1.5">
        <span className="font-medium text-sm">{label}</span>
        <Tooltip>
          <TooltipTrigger
            className="w-fit text-muted-foreground text-xs tabular-nums"
            render={<span />}
          >
            {formatShortDate(cycle.startLocalDate)}
          </TooltipTrigger>
          <TooltipContent>
            Cycle of {formatLongDate(cycle.startLocalDate)} · owns{" "}
            {ownedPeriodLabel(cycle.ownedPeriodKey)}
          </TooltipContent>
        </Tooltip>
        {boundaryLabel ? (
          <span className="inline-flex w-fit items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-[10px] text-amber-700 uppercase tracking-wide dark:text-amber-400">
            <Flag className="size-2.5" />
            Boundary
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {boundaryLabel ? (
          <span className="inline-flex items-center gap-1.5 text-amber-700 text-xs dark:text-amber-400">
            <Flag className="size-3" />
            {boundaryLabel}
          </span>
        ) : null}
        {tasks.map((task) => (
          <TemplateTaskCard
            dueDate={resolvePeriodPlacementDueDate({
              endCycleStartLocalDate,
              placement: {
                cycleOffsetFromEnd,
                weekday: MONDAY_FIRST_INDEX(task.placementWeekday),
              },
            })}
            fieldProps={fieldProps}
            key={task.id}
            onChange={(patch) => updateTask(task.id, patch)}
            onRemove={() => removeTask(task.id)}
            showWeekday
            task={task}
          />
        ))}
        <AddTaskButton onClick={() => addTask(1)} />
      </div>
    </div>
  );
}

function AddTaskButton({ onClick }: { readonly onClick: () => void }) {
  return (
    <button
      className="flex w-fit items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
      onClick={onClick}
      type="button"
    >
      <Plus className="size-3.5" />
      Add Template Task
    </button>
  );
}

function CalendarSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {MONDAY_FIRST.map((weekday, index) => (
        <div className={cn("flex gap-3 px-4 py-3", index !== 0 && "border-t")} key={weekday}>
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-7 w-36" />
        </div>
      ))}
    </div>
  );
}

// --- Template Task card -----------------------------------------------------

function TemplateTaskCard({
  task,
  fieldProps,
  dueDate,
  showWeekday = false,
  onChange,
  onRemove,
}: {
  readonly task: DraftTask;
  readonly fieldProps: TaskFieldProps;
  readonly dueDate?: string;
  readonly showWeekday?: boolean;
  readonly onChange: (patch: Partial<DraftTask>) => void;
  readonly onRemove: () => void;
}) {
  const {
    teams,
    teamPickerOptions,
    memberTeamIds,
    assigneeOptions,
    churchLabels,
    memberships,
    currentUserId,
  } = fieldProps;
  const selectedTeam = teams.find((team) => team.id === task.teamId) ?? null;
  const selectedAssignee = assigneeOptions.find((option) => option.id === task.assigneeId) ?? null;
  const estimateMeta = getEstimateMeta(task.estimate);

  // Members of the selected Team feed the assignee picker's "Team members".
  const teamMemberUserIds = useMemo(
    () =>
      new Set(
        memberships
          .filter((membership) => membership.teamId === task.teamId)
          .map((membership) => membership.userId),
      ),
    [memberships, task.teamId],
  );

  // Church Labels plus the selected Team's Labels are applicable.
  const labelOptions = useMemo(
    () => churchLabels.filter((label) => label.teamId === null || label.teamId === task.teamId),
    [churchLabels, task.teamId],
  );
  const selectedLabels = useMemo(
    () =>
      task.labelIds
        .map((id) => labelOptions.find((option) => option.id === id))
        .filter((option): option is LabelItem => option !== undefined),
    [task.labelIds, labelOptions],
  );

  const changeTeam = (nextTeamId: string) => {
    const nextLabelIds = task.labelIds.filter((labelId) => {
      const label = churchLabels.find((candidate) => candidate.id === labelId);

      return label?.teamId === null || label?.teamId === nextTeamId;
    });

    onChange({ labelIds: nextLabelIds, teamId: nextTeamId });
  };

  return (
    <div className="group/task flex flex-col gap-2 rounded-lg border bg-background p-2.5 shadow-xs">
      <div className="flex items-start gap-2">
        <Input
          className="h-8 flex-1 border-transparent bg-transparent px-1.5 font-medium shadow-none focus-visible:border-input focus-visible:bg-background"
          onChange={(event) => onChange({ title: event.currentTarget.value })}
          placeholder="Template Task title"
          value={task.title}
        />
        <Button
          aria-label="Remove Template Task"
          className="opacity-0 group-hover/task:opacity-100 focus-visible:opacity-100"
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Trash2 />
        </Button>
      </div>

      <Textarea
        className="min-h-0 resize-none border-transparent bg-transparent px-1.5 py-1 text-sm shadow-none focus-visible:border-input focus-visible:bg-background"
        onChange={(event) => onChange({ description: event.currentTarget.value })}
        placeholder="Add a description…"
        rows={1}
        value={task.description}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {showWeekday ? (
          <WeekdaySelector
            onChange={(next) => onChange({ placementWeekday: next })}
            weekday={task.placementWeekday}
          />
        ) : null}

        <TeamComboboxSelector
          memberTeamIds={memberTeamIds}
          onValueChange={changeTeam}
          options={teamPickerOptions}
          trigger={
            <FieldPill muted={selectedTeam === null}>
              {selectedTeam ? (
                <>
                  <TeamAvatar color={selectedTeam.color} name={selectedTeam.name} size={14} />
                  {selectedTeam.name}
                </>
              ) : (
                "Team"
              )}
            </FieldPill>
          }
          value={task.teamId || null}
        />

        <AssigneeComboboxSelector
          align="start"
          currentUserId={currentUserId}
          onValueChange={(next) => onChange({ assigneeId: next })}
          options={assigneeOptions}
          teamMemberIds={teamMemberUserIds}
          trigger={
            <FieldPill muted={selectedAssignee === null}>
              <AssigneeAvatar assignee={selectedAssignee} size={14} />
              {selectedAssignee?.label ?? "Assignee"}
            </FieldPill>
          }
          value={task.assigneeId}
        />

        <EstimateComboboxSelector
          onValueChange={(next) => onChange({ estimate: next })}
          trigger={
            <FieldPill muted={task.estimate === "no_estimate"}>
              <Triangle className="size-3.5" />
              {task.estimate === "no_estimate" ? "Estimate" : estimateMeta.label}
            </FieldPill>
          }
          value={task.estimate}
        />

        <LabelsComboboxSelector
          onValueChange={(next) => onChange({ labelIds: next })}
          options={labelOptions}
          trigger={
            <FieldPill muted={selectedLabels.length === 0}>
              {selectedLabels.length === 0 ? (
                "Labels"
              ) : (
                <>
                  <span className="flex items-center -space-x-1">
                    {selectedLabels.map((option) => (
                      <span
                        className={cn(
                          "size-2.5 rounded-full ring-2 ring-background",
                          labelDotClassName(option),
                        )}
                        key={option.id}
                      />
                    ))}
                  </span>
                  {selectedLabels.length === 1
                    ? selectedLabels[0]?.name
                    : `${selectedLabels.length} labels`}
                </>
              )}
            </FieldPill>
          }
          value={task.labelIds}
        />

        {dueDate ? (
          <Tooltip>
            <TooltipTrigger
              className="ml-auto inline-flex items-center gap-1 text-muted-foreground text-xs tabular-nums"
              render={<span />}
            >
              <CalendarDays className="size-3.5" />
              {formatShortDate(dueDate)}
            </TooltipTrigger>
            <TooltipContent>First projected due date · {formatLongDate(dueDate)}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}

/** Monday-first weekday picker pill for period Template Tasks. */
function WeekdaySelector({
  weekday,
  onChange,
}: {
  readonly weekday: number;
  readonly onChange: (next: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        aria-label="Set Cycle weekday"
        className="inline-flex cursor-pointer items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        type="button"
      >
        <FieldPill>
          <CalendarDays className="size-3.5" />
          {WEEKDAY_SHORT[weekday]}
        </FieldPill>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-1.5">
        <div className="flex gap-1">
          {MONDAY_FIRST.map((day) => (
            <button
              aria-pressed={day === weekday}
              className={cn(
                "rounded-md px-2 py-1 font-medium text-xs transition-colors",
                day === weekday
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
              key={day}
              onClick={() => {
                onChange(day);
                setOpen(false);
              }}
              type="button"
            >
              {WEEKDAY_SHORT[day]}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The Linear-style property pill used as picker triggers. */
function FieldPill({
  children,
  muted = false,
}: {
  readonly children: ReactNode;
  readonly muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border bg-background px-2 font-medium text-xs transition-colors hover:bg-accent",
        muted && "text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

// --- Step 4: Preview and save ----------------------------------------------

function SaveStep({
  templateName,
  shape,
  serviceWeekday,
  startDate,
  frame,
  repeatYearly,
  placedCount,
  schedule,
  saving,
  saved,
  canSave,
  error,
  onScheduleChange,
  onSave,
}: {
  readonly templateName: string;
  readonly shape: TemplateAuthoringShape;
  readonly serviceWeekday: number;
  readonly startDate: string;
  readonly frame: PeriodPlacementFrame | null;
  readonly repeatYearly: boolean;
  readonly placedCount: number;
  readonly schedule: boolean;
  readonly saving: boolean;
  readonly saved: boolean;
  readonly canSave: boolean;
  readonly error: string | null;
  readonly onScheduleChange: (next: boolean) => void;
  readonly onSave: () => void;
}) {
  const isWeekly = shape === "weekly_service";
  const fallbackName = isWeekly ? "Weekly Service" : `${SHAPE_META[shape].badge} Template`;
  const cadence = (() => {
    if (isWeekly) return schedule ? "Repeats every week" : "Saved, not scheduled";
    if (!schedule) return "Saved, not scheduled";
    if (shape === "monthly") return "Repeats every month";
    if (shape === "quarterly") return "Repeats every quarter";
    return repeatYearly ? "Repeats every year" : "Nearest one-off this year";
  })();
  const scheduleCopy = (() => {
    if (isWeekly)
      return {
        title: "Repeating weekly Template Schedule",
        body: `Project this Template into every upcoming Week on ${WEEKDAY_NAMES[serviceWeekday]}.`,
      };
    if (shape === "monthly")
      return {
        title: "Repeating monthly Template Schedule",
        body: "Project this Template into the matching Cycles every month.",
      };
    if (shape === "quarterly")
      return {
        title: "Repeating quarterly Template Schedule",
        body: "Project this Template into the matching Cycles every quarter.",
      };
    return {
      title: "Yearly Template Schedule",
      body: repeatYearly
        ? "Project this Template into the matching Cycles every year."
        : "Project this Template once into this year's Cycles.",
    };
  })();

  return (
    <StepSection
      description="Confirm how the Template projects into Cycles, then save."
      step={4}
      title="Preview and save"
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-sm">{templateName.trim() || fallbackName}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                {SHAPE_META[shape].badge}
              </span>
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {isWeekly ? (
                <>
                  <PreviewRow label="Service day" value={WEEKDAY_NAMES[serviceWeekday]} />
                  <PreviewRow label="Template Tasks" value={`${placedCount} placed`} />
                  <PreviewRow label="First service" value={formatLongDate(startDate)} />
                  <PreviewRow label="Projection" value={cadence} />
                </>
              ) : (
                <>
                  <PreviewRow label="Frame" value={`${frame?.cycles.length ?? "—"} Cycles`} />
                  <PreviewRow label="Template Tasks" value={`${placedCount} placed`} />
                  <PreviewRow label="First period" value={formatLongDate(startDate)} />
                  <PreviewRow label="Projection" value={cadence} />
                </>
              )}
            </dl>
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
          <span className="flex items-start gap-2.5">
            <Repeat className="mt-0.5 size-4 text-muted-foreground" />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium text-sm">{scheduleCopy.title}</span>
              <span className="text-muted-foreground text-xs">{scheduleCopy.body}</span>
            </span>
          </span>
          <Switch checked={schedule} onCheckedChange={onScheduleChange} />
        </label>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex items-center gap-3">
          <Button disabled={saving || !canSave} onClick={onSave} type="button">
            {schedule ? "Save and schedule" : "Save Template"}
          </Button>
          {saved ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700 text-sm dark:text-emerald-400">
              <Check className="size-4" />
              {schedule
                ? isWeekly
                  ? `Template saved and scheduled for ${WEEKDAY_NAMES[serviceWeekday]}s.`
                  : "Template saved and scheduled."
                : "Template saved."}
            </span>
          ) : !canSave ? (
            <span className="text-muted-foreground text-sm">
              Add at least one Template Task to save.
            </span>
          ) : null}
        </div>
      </div>
    </StepSection>
  );
}

function PreviewRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed pb-2 last:border-0 sm:last:border-b sm:[&:nth-last-child(2)]:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
