import type { KeyDateRule } from "@church-task/domain";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  CalendarHeart,
  Check,
  ChevronsUpDown,
  Flag,
  Layers,
  Plus,
  Repeat,
  Repeat2,
  Sparkles,
  Trash2,
  Triangle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  getPriorityMeta,
  LabelsComboboxSelector,
  labelDotClassName,
  PriorityComboboxSelector,
  TeamComboboxSelector,
  type TaskEstimate,
  type TaskPriority,
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
  describeKeyDateSchedule,
  formatKeyDateOccurrence,
  KEY_DATE_PRESET_OPTIONS,
  keyDateKindLabel,
  useCreateKeyDate,
  useKeyDatesCollection,
  type KeyDateItem,
  type KeyDateScheduleKind,
} from "@/data/templates/keyDatesData.app";
import {
  useCreateKeyDateTemplate,
  useCreatePeriodTemplate,
  useCreateWeeklyServiceTemplate,
} from "@/data/templates/templatesData.app";
import { BigActionFooter } from "@/features/big-actions/big-action-components";
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
  readonly priority: TaskPriority;
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

const PRIORITY_TO_KEY: Record<TaskPriority, string | null> = {
  no_priority: null,
  urgent: "urgent",
  high: "high",
  medium: "medium",
  low: "low",
};

const newDraftTask = (placementWeekday: number, teamId: string, cycleIndex = 0): DraftTask => ({
  assigneeId: null,
  cycleIndex,
  description: "",
  estimate: "no_estimate",
  priority: "no_priority",
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

type TemplateShape = "key_date" | TemplateAuthoringShape;

/**
 * The Template authoring surface. Picks the Template Placement Shape, then
 * renders the matching guided flow: a weekly service Cycle, or a Key Date
 * anchored flow. Both flows mirror Church Task's planning language and produce
 * Template Tasks that carry planning fields only — no Workflow Status or Task
 * State (see CONTEXT.md "Template Task").
 */
export function TemplateAuthoring() {
  const [shape, setShape] = useState<TemplateShape>("weekly_service");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Layers className="size-4" />
          <span>Templates</span>
        </div>
        <h1 className="font-semibold text-2xl tracking-tight">
          {shape === "key_date"
            ? "New Key Date Template"
            : `New ${SHAPE_META[shape].title} Template`}
        </h1>
        <p className="max-w-2xl text-muted-foreground text-sm">
          {shape === "key_date"
            ? "Anchor a reusable Template to a named Church Key Date, place its Template Tasks around the occurrence, and schedule it to project work into the right Week each year."
            : "Author a reusable weekly service Template, place its Template Tasks across a Monday–Sunday Cycle, and schedule it to project work into upcoming Weeks."}
        </p>
      </header>

      <ShapeStep onSelect={setShape} shape={shape} />

      {shape === "key_date" ? (
        <KeyDateAuthoring />
      ) : (
        <WeeklyServiceAuthoring initialShape={shape} onShapeChange={setShape} />
      )}
    </div>
  );
}

// --- Big-action stepper flow -----------------------------------------------

/** Labels and descriptions for each step of each authoring shape's stepper. */
export const TEMPLATE_FLOW_STEPS: Record<
  TemplateShape,
  readonly { readonly label: string; readonly description: string }[]
> = {
  key_date: [
    { description: "Pick the authoring frame", label: "Shape" },
    { description: "Name this Template", label: "Name" },
    { description: "Anchor to a Key Date", label: "Key Date" },
    { description: "Place Template Tasks", label: "Tasks" },
    { description: "Preview and save", label: "Save" },
  ],
  monthly: PERIOD_FLOW_STEPS_LABELS("monthly"),
  quarterly: PERIOD_FLOW_STEPS_LABELS("quarterly"),
  weekly_service: [
    { description: "Pick the authoring frame", label: "Shape" },
    { description: "Name this Template", label: "Details" },
    { description: "Choose the service weekday", label: "Schedule" },
    { description: "Place Template Tasks", label: "Tasks" },
    { description: "Preview and save", label: "Save" },
  ],
  yearly: PERIOD_FLOW_STEPS_LABELS("yearly"),
};

function PERIOD_FLOW_STEPS_LABELS(
  shape: PeriodTemplatePlacementShape,
): readonly { readonly label: string; readonly description: string }[] {
  return [
    { description: "Pick the authoring frame", label: "Shape" },
    { description: "Name this Template", label: "Details" },
    { description: `${SHAPE_META[shape].badge} cadence`, label: "Schedule" },
    { description: "Place Template Tasks", label: "Tasks" },
    { description: "Preview and save", label: "Save" },
  ];
}

export function templateFlowStepCount(shape: TemplateShape): number {
  return TEMPLATE_FLOW_STEPS[shape].length;
}

/**
 * Footer navigation for a single stepper screen inside the create-Template big
 * action. Renders Back/Next on the left/right, with an optional primary action
 * (Save) on the final screen supplied by the step itself.
 */
function StepNav({
  canAdvance = true,
  isFirst,
  isLast,
  nextLabel = "Next",
  onBack,
  onNext,
  primary,
}: {
  readonly canAdvance?: boolean;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly nextLabel?: string;
  readonly onBack: () => void;
  readonly onNext: () => void;
  readonly primary?: ReactNode;
}) {
  return (
    <BigActionFooter className="-mx-6 -mb-6 mt-auto justify-between bg-background px-3 py-2">
      <Button disabled={isFirst} onClick={onBack} type="button" variant="ghost">
        Back
      </Button>
      {isLast ? (
        primary
      ) : (
        <Button disabled={!canAdvance} onClick={onNext} type="button">
          {nextLabel}
        </Button>
      )}
    </BigActionFooter>
  );
}

/**
 * The create-Template flow, rendered one stepper screen at a time. Step 0 is the
 * shared shape picker; subsequent steps delegate to the per-shape orchestrator,
 * which holds all authoring state and renders only its active screen.
 */
export function TemplateAuthoringFlow({
  shape,
  step,
  onShapeChange,
  onStepChange,
  onClose,
}: {
  readonly shape: TemplateShape;
  readonly step: number;
  readonly onShapeChange: (shape: TemplateShape) => void;
  readonly onStepChange: (step: number) => void;
  readonly onClose: () => void;
}) {
  const goBack = () => onStepChange(Math.max(step - 1, 0));
  const goForward = () => onStepChange(step + 1);

  if (step === 0) {
    return (
      <div className="flex min-h-full flex-col">
        <div className="flex flex-col gap-6 pb-6">
          <ShapeStep onSelect={onShapeChange} shape={shape} />
        </div>
        <StepNav isFirst isLast={false} onBack={goBack} onNext={goForward} />
      </div>
    );
  }

  return shape === "key_date" ? (
    <KeyDateAuthoring goBack={goBack} goForward={goForward} onClose={onClose} step={step} />
  ) : (
    <WeeklyServiceAuthoring
      goBack={goBack}
      goForward={goForward}
      initialShape={shape}
      onClose={onClose}
      onShapeChange={onShapeChange}
      step={step}
    />
  );
}

/**
 * The weekly service Template authoring flow. A single guided surface that
 * mirrors Church Task's planning language: choose the service weekday, place
 * Template Tasks on a vertical Monday–Sunday Cycle calendar, preview the first
 * projected Week, and save (optionally creating a repeating weekly Template
 * Schedule). Template Tasks carry planning fields only — no Workflow Status or
 * Task State (see CONTEXT.md "Template Task").
 */
function WeeklyServiceAuthoring({
  initialShape,
  onShapeChange,
  step = 4,
  goBack,
  goForward,
  onClose,
}: {
  readonly initialShape: TemplateAuthoringShape;
  readonly onShapeChange: (shape: TemplateAuthoringShape) => void;
  /**
   * The active stepper screen (1-based; step 0 is the shared shape picker handled
   * by the parent flow). When omitted, the legacy stacked layout renders all
   * steps at once (used by the standalone authoring page).
   */
  readonly step?: number;
  readonly goBack?: () => void;
  readonly goForward?: () => void;
  readonly onClose?: () => void;
}) {
  const stepped = step !== undefined;
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
  const [shape, setShape] = useState<TemplateAuthoringShape>(initialShape);
  const [serviceWeekday, setServiceWeekday] = useState(0); // Sunday default
  const [schedule, setSchedule] = useState(true);
  const [repeatYearly, setRepeatYearly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tasks, setTasks] = useState<readonly DraftTask[]>([]);

  const startDate = useMemo(() => nextWeekdayDate(serviceWeekday), [serviceWeekday]);

  useEffect(() => {
    setShape(initialShape);
  }, [initialShape]);

  const selectShape = (next: TemplateAuthoringShape) => {
    setShape(next);
    onShapeChange(next);
  };

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
          priority: PRIORITY_TO_KEY[task.priority],
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
                priority: PRIORITY_TO_KEY[task.priority],
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

  const shapeStep = (
    <PeriodShapeStep
      name={name}
      onNameChange={(next) => {
        setSaved(false);
        setName(next);
      }}
      onShapeChange={(next) => {
        setSaved(false);
        selectShape(next);
        setSchedule(true);
      }}
      shape={shape}
    />
  );

  const scheduleStep =
    shape === "weekly_service" ? (
      <ScheduleStep
        onWeekdayChange={(next) => {
          setSaved(false);
          setServiceWeekday(next);
        }}
        serviceWeekday={serviceWeekday}
        startDate={startDate}
        step={2}
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
    );

  const tasksStep =
    shape === "weekly_service" ? (
      <CycleCalendarStep
        addTask={addTask}
        fieldProps={taskFieldProps}
        loading={dataLoading}
        removeTask={removeTask}
        serviceWeekday={serviceWeekday}
        step={3}
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
    );

  const saveStep = (
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
      step={4}
      templateName={name}
    />
  );

  if (!stepped) {
    return (
      <div className="flex flex-col gap-8">
        {shapeStep}
        {scheduleStep}
        {tasksStep}
        {saveStep}
      </div>
    );
  }

  // Stepper screens (parent owns step 0, the shape picker). Steps here are
  // 1: shape/name, 2: schedule, 3: tasks, 4: preview & save.
  const screen = (() => {
    switch (step) {
      case 1:
        return { canAdvance: name.trim().length > 0, content: shapeStep };
      case 2:
        return { canAdvance: true, content: scheduleStep };
      case 3:
        return { canAdvance: placedCount > 0, content: tasksStep };
      default:
        return { canAdvance: true, content: saveStep };
    }
  })();

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col gap-6 pb-6">{screen.content}</div>
      <StepNav
        canAdvance={screen.canAdvance}
        isFirst={false}
        isLast={step >= 4}
        onBack={goBack ?? (() => undefined)}
        onNext={goForward ?? (() => undefined)}
        primary={
          saved ? (
            <Button onClick={onClose} type="button" variant="outline">
              Done
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

// --- Key Date authoring flow -----------------------------------------------

/** A short weekday-less date label (e.g. "Apr 5") for the Cycle calendar. */
function formatShortDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

/** Returns the Monday that opens the Cycle containing the given local date. */
function cycleMondayFor(localDate: string): Date {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  const mondayDelta = (date.getDay() + 6) % 7; // 0 = Monday
  date.setDate(date.getDate() - mondayDelta);
  return date;
}

/**
 * The Key Date Template authoring flow. Anchors a reusable Template to a named
 * Church Key Date (selected or created inline), previews the next occurrence,
 * places Template Tasks across the occurrence's Monday–Sunday Cycle with the
 * occurrence date highlighted, and saves — optionally as a yearly repeating
 * Template Schedule. Template Tasks carry planning fields only (see CONTEXT.md
 * "Template Task").
 */
function KeyDateAuthoring({
  step,
  goBack,
  goForward,
  onClose,
}: {
  readonly step?: number;
  readonly goBack?: () => void;
  readonly goForward?: () => void;
  readonly onClose?: () => void;
} = {}) {
  const stepped = step !== undefined;
  const { currentOrgOpt: activeChurch, loading: churchLoading } = useCurrentOrgOpt();
  const churchId = activeChurch?.id ?? null;
  const currentUserId = activeChurch?.currentUserId ?? null;

  const teams = useTeamsCollection({ churchId });
  const users = useChurchUsersCollection({ churchId });
  const labels = useLabelsCollection({ churchId });
  const memberships = useTeamMembershipsCollection({ churchId });
  const keyDates = useKeyDatesCollection({ churchId });
  const createKeyDate = useCreateKeyDate();
  const createTemplate = useCreateKeyDateTemplate();

  const teamsCollection = teams.teamsCollection;
  const defaultTeamId = teamsCollection[0]?.id ?? "";

  const [name, setName] = useState("");
  const [selectedKeyDateId, setSelectedKeyDateId] = useState<string | null>(null);
  const [pendingKeyDateKey, setPendingKeyDateKey] = useState<string | null>(null);
  const [repeatYearly, setRepeatYearly] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tasks, setTasks] = useState<readonly DraftTask[]>([]);

  // Auto-select a freshly created Key Date once it streams in from Zero.
  useEffect(() => {
    if (!pendingKeyDateKey) return;
    const created = keyDates.keyDatesCollection.find(
      (keyDate) => keyDate.key === pendingKeyDateKey,
    );
    if (created) {
      setSelectedKeyDateId(created.id);
      setPendingKeyDateKey(null);
    }
  }, [keyDates.keyDatesCollection, pendingKeyDateKey]);

  const selectedKeyDate = useMemo(
    () => keyDates.keyDatesCollection.find((keyDate) => keyDate.id === selectedKeyDateId) ?? null,
    [keyDates.keyDatesCollection, selectedKeyDateId],
  );

  const occurrenceDate = selectedKeyDate?.nextOccurrence ?? null;
  const occurrenceWeekday = useMemo(() => {
    if (!occurrenceDate) return null;
    const [year, month, day] = occurrenceDate.split("-").map(Number);
    return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1).getDay();
  }, [occurrenceDate]);

  // Resolve each Monday-first weekday slot to a concrete date in the
  // occurrence's Cycle so the calendar shows real, highlighted dates.
  const cycleDates = useMemo(() => {
    if (!occurrenceDate) return null;
    const monday = cycleMondayFor(occurrenceDate);
    return MONDAY_FIRST.reduce<Record<number, string>>((acc, weekday, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      acc[weekday] = formatLocalDate(date);
      return acc;
    }, {});
  }, [occurrenceDate]);

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

  const updateTask = (id: string, patch: Partial<DraftTask>) => {
    setSaved(false);
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  };

  const addTask = (placementWeekday: number) => {
    setSaved(false);
    setTasks((current) => [...current, newDraftTask(placementWeekday, defaultTeamId)]);
  };

  const removeTask = (id: string) => {
    setSaved(false);
    setTasks((current) => current.filter((task) => task.id !== id));
  };

  const selectKeyDate = (keyDate: KeyDateItem) => {
    setSaved(false);
    setError(null);
    setSelectedKeyDateId(keyDate.id);
    if (!name.trim()) setName(`${keyDate.name} prep`);
  };

  const createAndSelectKeyDate = async (keyDateName: string, schedule: KeyDateRule) => {
    if (!churchId) return;
    setError(null);
    const trimmed = keyDateName.trim();
    const key = slugify(trimmed);
    const result = await createKeyDate({ churchId, key, name: trimmed, schedule });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    // The new Key Date streams in via Zero; select it once present by matching
    // on the slug key, and pre-fill the Template name.
    setSaved(false);
    setPendingKeyDateKey(key);
    if (!name.trim()) setName(`${trimmed} prep`);
  };

  const save = async () => {
    if (!churchId || !selectedKeyDate || !occurrenceDate) {
      setError("Choose a Key Date to anchor this Template.");
      return;
    }
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
    const result = await createTemplate({
      churchId,
      key: slugify(name || selectedKeyDate.name),
      keyDateId: selectedKeyDate.id,
      name: name.trim() || `${selectedKeyDate.name} prep`,
      occurrenceDate,
      repeatYearly,
      tasks: validTasks.map((task, index) => {
        const team = teamsCollection.find((candidate) => candidate.id === task.teamId);
        return {
          assignedUserId: task.assigneeId,
          description: task.description.trim() || null,
          estimate: ESTIMATE_TO_KEY[task.estimate],
          priority: PRIORITY_TO_KEY[task.priority],
          key: `task-${index + 1}-${slugify(task.title)}`,
          labelIds: [...task.labelIds],
          placementCycleOffset: 0,
          placementWeekday: task.placementWeekday,
          templateTeamKey: team?.identifier ?? templateTeams[0]?.key ?? "team",
          title: task.title.trim(),
        };
      }),
      templateTeams,
    });
    setSaving(false);
    if (result.ok) setSaved(true);
    else setError(result.error.message);
  };

  const nameStep = (
    <NameStep
      description="Name this Template — usually the Key Date plus what it prepares."
      label="Key Date Template name"
      name={name}
      onNameChange={(next) => {
        setSaved(false);
        setName(next);
      }}
      placeholder="Easter prep"
      step={1}
    />
  );

  const keyDateStep = (
    <KeyDateStep
      churchId={churchId}
      keyDates={keyDates.keyDatesCollection}
      loading={churchLoading || keyDates.loading}
      occurrenceDate={occurrenceDate}
      onCreateKeyDate={createAndSelectKeyDate}
      onSelect={selectKeyDate}
      selectedKeyDate={selectedKeyDate}
      step={2}
    />
  );

  const calendarStep = (
    <KeyDateCalendarStep
      addTask={addTask}
      assigneeOptions={assigneeOptions}
      churchLabels={labels.labelsCollection}
      currentUserId={currentUserId}
      cycleDates={cycleDates}
      loading={churchLoading}
      memberTeamIds={memberTeamIds}
      memberships={memberships.teamMembershipsCollection}
      occurrenceWeekday={occurrenceWeekday}
      removeTask={removeTask}
      selectedKeyDate={selectedKeyDate}
      step={3}
      tasks={tasks}
      teamPickerOptions={teamPickerOptions}
      teams={teamsCollection}
      updateTask={updateTask}
    />
  );

  const saveStep = (
    <KeyDateSaveStep
      canSave={Boolean(churchId) && Boolean(selectedKeyDate) && placedCount > 0}
      error={error}
      occurrenceDate={occurrenceDate}
      onRepeatChange={(next) => {
        setSaved(false);
        setRepeatYearly(next);
      }}
      onSave={save}
      placedCount={placedCount}
      repeatYearly={repeatYearly}
      saved={saved}
      saving={saving}
      selectedKeyDate={selectedKeyDate}
      step={4}
      templateName={name}
    />
  );

  if (!stepped) {
    return (
      <div className="flex flex-col gap-8">
        {nameStep}
        {keyDateStep}
        {calendarStep}
        {saveStep}
      </div>
    );
  }

  // Stepper screens (parent owns step 0, the shape picker). Steps here are
  // 1: name, 2: Key Date, 3: tasks, 4: preview & save.
  const screen = (() => {
    switch (step) {
      case 1:
        return { canAdvance: name.trim().length > 0, content: nameStep };
      case 2:
        return { canAdvance: Boolean(selectedKeyDate), content: keyDateStep };
      case 3:
        return { canAdvance: placedCount > 0, content: calendarStep };
      default:
        return { canAdvance: true, content: saveStep };
    }
  })();

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col gap-6 pb-6">{screen.content}</div>
      <StepNav
        canAdvance={screen.canAdvance}
        isFirst={false}
        isLast={step >= 4}
        onBack={goBack ?? (() => undefined)}
        onNext={goForward ?? (() => undefined)}
        primary={
          saved ? (
            <Button onClick={onClose} type="button" variant="outline">
              Done
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

// --- Key Date: Step 2: Key Date selection / inline creation ----------------

function KeyDateStep({
  step,
  churchId,
  keyDates,
  loading,
  occurrenceDate,
  selectedKeyDate,
  onSelect,
  onCreateKeyDate,
}: {
  readonly step: number;
  readonly churchId: string | null;
  readonly keyDates: readonly KeyDateItem[];
  readonly loading: boolean;
  readonly occurrenceDate: string | null;
  readonly selectedKeyDate: KeyDateItem | null;
  readonly onSelect: (keyDate: KeyDateItem) => void;
  readonly onCreateKeyDate: (name: string, schedule: KeyDateRule) => void;
}) {
  return (
    <StepSection
      action={
        selectedKeyDate ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary text-xs">
            <CalendarHeart className="size-3.5" />
            {selectedKeyDate.name}
          </span>
        ) : null
      }
      description="Anchor the Template to a named Church date. Pick an existing Key Date or create one."
      step={step}
      title="Key Date"
    >
      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full max-w-md rounded-lg" />
          <Skeleton className="h-5 w-48" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <KeyDatePicker
              keyDates={keyDates}
              onCreateKeyDate={onCreateKeyDate}
              onSelect={onSelect}
              selectedKeyDate={selectedKeyDate}
            />
            {selectedKeyDate ? (
              <span className="text-muted-foreground text-sm">
                {describeKeyDateSchedule(selectedKeyDate.schedule)}
              </span>
            ) : null}
          </div>

          {selectedKeyDate ? (
            <div className="flex items-center gap-2 rounded-lg border bg-primary/[0.04] px-3 py-2 text-sm">
              <CalendarHeart className="size-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">Next occurrence</span>
              <span className="font-medium tabular-nums">
                {formatKeyDateOccurrence(occurrenceDate)}
              </span>
            </div>
          ) : keyDates.length === 0 && churchId ? (
            <p className="text-muted-foreground text-sm">
              This Church has no Key Dates yet. Create one to anchor the Template.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Choose a Key Date to preview its next occurrence and place work around it.
            </p>
          )}
        </div>
      )}
    </StepSection>
  );
}

/** A Popover combobox for selecting an existing Key Date or creating one. */
function KeyDatePicker({
  keyDates,
  selectedKeyDate,
  onSelect,
  onCreateKeyDate,
}: {
  readonly keyDates: readonly KeyDateItem[];
  readonly selectedKeyDate: KeyDateItem | null;
  readonly onSelect: (keyDate: KeyDateItem) => void;
  readonly onCreateKeyDate: (name: string, schedule: KeyDateRule) => void;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  return (
    <Popover
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCreating(false);
      }}
      open={open}
    >
      <PopoverTrigger
        render={
          <Button className="w-full max-w-xs justify-between" type="button" variant="outline" />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarHeart className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {selectedKeyDate ? selectedKeyDate.name : "Select Key Date"}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        {creating ? (
          <InlineKeyDateCreator
            onCancel={() => setCreating(false)}
            onCreate={(name, schedule) => {
              onCreateKeyDate(name, schedule);
              setCreating(false);
              setOpen(false);
            }}
          />
        ) : (
          <div className="flex max-h-80 flex-col">
            <div className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
              {keyDates.length === 0 ? (
                <p className="px-2 py-3 text-center text-muted-foreground text-sm">
                  No Key Dates yet.
                </p>
              ) : (
                keyDates.map((keyDate) => {
                  const active = keyDate.id === selectedKeyDate?.id;
                  return (
                    <button
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                        active && "bg-accent",
                      )}
                      key={keyDate.id}
                      onClick={() => {
                        onSelect(keyDate);
                        setOpen(false);
                      }}
                      type="button"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{keyDate.name}</span>
                        <span className="truncate text-muted-foreground text-xs">
                          {formatKeyDateOccurrence(keyDate.nextOccurrence)}
                        </span>
                      </span>
                      {active ? <Check className="size-4 shrink-0 text-primary" /> : null}
                    </button>
                  );
                })
              )}
            </div>
            <div className="border-t p-1.5">
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                onClick={() => setCreating(true)}
                type="button"
              >
                <Plus className="size-4 text-muted-foreground" />
                Create new Key Date
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

const KEY_DATE_KINDS: readonly KeyDateScheduleKind[] = ["computedYearly", "fixedYearly", "oneTime"];

const defaultScheduleForKind = (kind: KeyDateScheduleKind): KeyDateRule => {
  if (kind === "computedYearly") return { kind: "computedYearly", rule: "easter" };
  if (kind === "fixedYearly") return { day: 25, kind: "fixedYearly", month: 12 };
  return { kind: "oneTime", localDate: formatLocalDate(new Date()) };
};

/** Compact inline Key Date creator used inside the picker Popover. */
function InlineKeyDateCreator({
  onCreate,
  onCancel,
}: {
  readonly onCreate: (name: string, schedule: KeyDateRule) => void;
  readonly onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState<KeyDateRule>(defaultScheduleForKind("computedYearly"));

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2 font-medium text-sm">
        <Sparkles className="size-4 text-muted-foreground" />
        New Key Date
      </div>
      <Input
        // biome-ignore lint/a11y/noAutofocus: inline create affordance
        autoFocus
        onChange={(event) => setName(event.currentTarget.value)}
        placeholder="Key Date name"
        value={name}
      />

      <div className="flex flex-wrap gap-1.5">
        {KEY_DATE_KINDS.map((kind) => (
          <button
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              schedule.kind === kind
                ? "border-primary bg-primary/10 font-medium text-foreground"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
            key={kind}
            onClick={() => setSchedule(defaultScheduleForKind(kind))}
            type="button"
          >
            {keyDateKindLabel(kind)}
          </button>
        ))}
      </div>

      {schedule.kind === "computedYearly" ? (
        <div className="grid grid-cols-2 gap-1.5">
          {KEY_DATE_PRESET_OPTIONS.map((option) => (
            <button
              className={cn(
                "flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
                option.rule === schedule.rule
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
              key={option.rule}
              onClick={() => setSchedule({ kind: "computedYearly", rule: option.rule })}
              type="button"
            >
              <span className="truncate">{option.label}</span>
              {option.rule === schedule.rule ? (
                <Check className="size-3.5 shrink-0 text-primary" />
              ) : null}
            </button>
          ))}
        </div>
      ) : schedule.kind === "fixedYearly" ? (
        <Input
          aria-label="Annual date"
          onChange={(event) => {
            const [, month, day] = event.currentTarget.value.split("-").map(Number);
            if (month && day) setSchedule({ day, kind: "fixedYearly", month });
          }}
          type="date"
          value={`2024-${String(schedule.month).padStart(2, "0")}-${String(schedule.day).padStart(2, "0")}`}
        />
      ) : (
        <Input
          aria-label="One-off date"
          onChange={(event) =>
            setSchedule({
              kind: "oneTime",
              localDate: event.currentTarget.value || schedule.localDate,
            })
          }
          type="date"
          value={schedule.localDate}
        />
      )}

      <div className="flex items-center justify-end gap-2">
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
        <Button
          disabled={!name.trim()}
          onClick={() => onCreate(name.trim(), schedule)}
          size="sm"
          type="button"
        >
          Create
        </Button>
      </div>
    </div>
  );
}

// --- Key Date: Step 3: Cycle calendar with occurrence highlight ------------

function KeyDateCalendarStep({
  step,
  tasks,
  teams,
  teamPickerOptions,
  memberTeamIds,
  assigneeOptions,
  churchLabels,
  memberships,
  currentUserId,
  occurrenceWeekday,
  cycleDates,
  selectedKeyDate,
  loading,
  addTask,
  updateTask,
  removeTask,
}: {
  readonly step: number;
  readonly tasks: readonly DraftTask[];
  readonly teams: readonly TeamCollectionItem[];
  readonly teamPickerOptions: readonly { id: string; name: string; color: string | null }[];
  readonly memberTeamIds: ReadonlySet<string>;
  readonly assigneeOptions: readonly AssigneeOption[];
  readonly churchLabels: readonly LabelItem[];
  readonly memberships: readonly { teamId: string; userId: string }[];
  readonly currentUserId: string | null;
  readonly occurrenceWeekday: number | null;
  readonly cycleDates: Record<number, string> | null;
  readonly selectedKeyDate: KeyDateItem | null;
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
      description="Place Template Tasks across the Cycle that contains the Key Date. The occurrence day is highlighted."
      step={step}
      title="Cycle calendar"
    >
      {loading ? (
        <CalendarSkeleton />
      ) : teams.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          Create a Team before authoring Template Tasks.
        </div>
      ) : !selectedKeyDate ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          Choose a Key Date above to place Template Tasks around its occurrence.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {MONDAY_FIRST.map((weekday, index) => {
            const dayTasks = tasks.filter((task) => task.placementWeekday === weekday);
            const isOccurrence = weekday === occurrenceWeekday;
            const dayDate = cycleDates?.[weekday] ?? null;
            return (
              <div
                className={cn(
                  "flex gap-3 px-3 py-3 sm:px-4",
                  index !== 0 && "border-t",
                  isOccurrence &&
                    "border-l-2 border-l-primary bg-primary/[0.06] pl-[calc(0.75rem-2px)] sm:pl-[calc(1rem-2px)]",
                )}
                key={weekday}
              >
                <div className="flex w-28 shrink-0 flex-col gap-1 pt-1.5">
                  <span className="font-medium text-sm">{WEEKDAY_NAMES[weekday]}</span>
                  {dayDate ? (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {formatShortDate(dayDate)}
                    </span>
                  ) : null}
                  {isOccurrence ? (
                    <span
                      className="inline-flex max-w-full items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-[11px] text-primary"
                      title={selectedKeyDate.name}
                    >
                      <CalendarHeart className="size-3 shrink-0" />
                      <span className="truncate">{selectedKeyDate.name}</span>
                    </span>
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {dayTasks.map((task) => (
                    <TemplateTaskCard
                      fieldProps={{
                        assigneeOptions,
                        churchLabels,
                        currentUserId,
                        memberTeamIds,
                        memberships,
                        teamPickerOptions,
                        teams,
                      }}
                      key={task.id}
                      onChange={(patch) => updateTask(task.id, patch)}
                      onRemove={() => removeTask(task.id)}
                      task={task}
                    />
                  ))}
                  <button
                    className="flex w-fit items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => addTask(weekday)}
                    type="button"
                  >
                    <Plus className="size-3.5" />
                    Add Template Task
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </StepSection>
  );
}

// --- Key Date: Step 4: Preview and save ------------------------------------

function KeyDateSaveStep({
  step,
  templateName,
  selectedKeyDate,
  occurrenceDate,
  placedCount,
  repeatYearly,
  saving,
  saved,
  canSave,
  error,
  onRepeatChange,
  onSave,
}: {
  readonly step: number;
  readonly templateName: string;
  readonly selectedKeyDate: KeyDateItem | null;
  readonly occurrenceDate: string | null;
  readonly placedCount: number;
  readonly repeatYearly: boolean;
  readonly saving: boolean;
  readonly saved: boolean;
  readonly canSave: boolean;
  readonly error: string | null;
  readonly onRepeatChange: (next: boolean) => void;
  readonly onSave: () => void;
}) {
  const resolvedName =
    templateName.trim() || (selectedKeyDate ? `${selectedKeyDate.name} prep` : "Key Date Template");
  return (
    <StepSection
      description="Confirm how the Template projects around the Key Date, then save."
      step={step}
      title="Preview and save"
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-sm">{resolvedName}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                <CalendarHeart className="size-3" />
                Key Date
              </span>
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <PreviewRow label="Key Date" value={selectedKeyDate?.name ?? "—"} />
              <PreviewRow label="Template Tasks" value={`${placedCount} placed`} />
              <PreviewRow label="Next occurrence" value={formatKeyDateOccurrence(occurrenceDate)} />
              <PreviewRow
                label="Projection"
                value={repeatYearly ? "Repeats every year" : "This occurrence only"}
              />
            </dl>
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
          <span className="flex items-start gap-2.5">
            <Repeat className="mt-0.5 size-4 text-muted-foreground" />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium text-sm">Repeat every year</span>
              <span className="text-muted-foreground text-xs">
                {selectedKeyDate
                  ? `Project this Template into the Week containing ${selectedKeyDate.name} each year.`
                  : "Project this Template each year the Key Date occurs."}
              </span>
            </span>
          </span>
          <Switch checked={repeatYearly} onCheckedChange={onRepeatChange} />
        </label>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex items-center gap-3">
          <Button disabled={saving || !canSave} onClick={onSave} type="button">
            {repeatYearly ? "Save and schedule" : "Save Template"}
          </Button>
          {saved ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700 text-sm dark:text-emerald-400">
              <Check className="size-4" />
              {repeatYearly && selectedKeyDate
                ? `Template saved and scheduled for ${selectedKeyDate.name}.`
                : "Template saved."}
            </span>
          ) : !canSave ? (
            <span className="text-muted-foreground text-sm">
              {selectedKeyDate
                ? "Add at least one Template Task to save."
                : "Choose a Key Date and add a Template Task to save."}
            </span>
          ) : null}
        </div>
      </div>
    </StepSection>
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
    key: "key_date",
    label: "Key Date",
    description: "Anchored to a named Church date",
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

/** Shared Template Placement Shape selector that drives the authoring flow. */
function ShapeStep({
  shape,
  onSelect,
}: {
  readonly shape: TemplateShape;
  readonly onSelect: (shape: TemplateShape) => void;
}) {
  return (
    <StepSection
      description="Choose the authoring frame. It sets the calendar and scheduling controls below."
      step={1}
      title="Template shape"
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SHAPES.map((entry) => {
          const selected = entry.available && entry.key === shape;
          return (
            <button
              aria-current={selected ? "true" : undefined}
              aria-disabled={!entry.available}
              aria-label={`${entry.label} Template shape${
                entry.available ? (selected ? " selected" : "") : " coming soon"
              }`}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
                !entry.available &&
                  "cursor-not-allowed border-dashed text-muted-foreground opacity-70",
                entry.available && selected && "border-primary bg-primary/5 shadow-xs",
                entry.available &&
                  !selected &&
                  "border-border hover:border-foreground/20 hover:bg-muted/40",
              )}
              disabled={!entry.available}
              key={entry.key}
              onClick={() => entry.available && onSelect(entry.key as TemplateShape)}
              type="button"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm text-foreground">{entry.label}</span>
                {!entry.available ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    Soon
                  </span>
                ) : selected ? (
                  <span className="inline-flex items-center gap-1 font-medium text-[10px] text-primary uppercase tracking-wide">
                    <Check className="size-3.5" />
                    Selected
                  </span>
                ) : null}
              </div>
              <span className="text-muted-foreground text-xs">{entry.description}</span>
            </button>
          );
        })}
      </div>
    </StepSection>
  );
}

function PeriodShapeStep({
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
      <div className="mb-4 flex max-w-md flex-col gap-1.5">
        <label className="sr-only" htmlFor="template-name">
          Template name
        </label>
        <Input
          id="template-name"
          onChange={(event) => onNameChange(event.currentTarget.value)}
          value={name}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SHAPES.filter((entry) => entry.key !== "key_date").map((entry) => (
          <button
            aria-current={selectedShape === entry.key ? "true" : undefined}
            className={cn(
              "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
              selectedShape === entry.key
                ? "border-primary bg-primary/5 shadow-xs"
                : "border-border hover:bg-muted/60",
            )}
            key={entry.key}
            onClick={() => onShapeChange(entry.key as TemplateAuthoringShape)}
            type="button"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm text-foreground">{entry.label}</span>
              {selectedShape === entry.key ? (
                <span className="inline-flex items-center gap-1 font-medium text-[10px] text-primary uppercase tracking-wide">
                  <Check className="size-3.5" />
                  Selected
                </span>
              ) : null}
            </div>
            <span className="text-muted-foreground text-xs">{entry.description}</span>
          </button>
        ))}
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
                      "relative h-full flex-1 transition-colors",
                      // Base fill keeps the in-period vs carried distinction
                      // legible even on boundary Cycles.
                      cycle.isInFocusPeriod ? "bg-primary" : "bg-muted-foreground/25",
                      startsNewPeriod && "border-card border-l-2",
                    )}
                  >
                    {hasBoundary ? (
                      // Boundary marker layers an amber notch over the base fill
                      // rather than replacing it, so "in period" and "boundary"
                      // read as the two independent dimensions the legend shows.
                      <span className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500 ring-1 ring-card dark:bg-amber-400" />
                    ) : null}
                  </TooltipTrigger>
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

/** Shared Template name field, rendered as its own numbered step per flow. */
function NameStep({
  step,
  name,
  label,
  description,
  placeholder,
  onNameChange,
}: {
  readonly step: number;
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly placeholder: string;
  readonly onNameChange: (next: string) => void;
}) {
  return (
    <StepSection description={description} step={step} title="Template name">
      <div className="flex max-w-md flex-col gap-1.5">
        <label className="sr-only" htmlFor="template-name">
          {label}
        </label>
        <Input
          aria-label={label}
          id="template-name"
          onChange={(event) => onNameChange(event.currentTarget.value)}
          placeholder={placeholder}
          value={name}
        />
      </div>
    </StepSection>
  );
}

// --- Weekly: Step 2: Weekday scheduling ------------------------------------

function ScheduleStep({
  step,
  serviceWeekday,
  startDate,
  onWeekdayChange,
}: {
  readonly step: number;
  readonly serviceWeekday: number;
  readonly startDate: string;
  readonly onWeekdayChange: (next: number) => void;
}) {
  return (
    <StepSection
      description="The service day anchors the Cycle. Template Tasks placed on it are due that day."
      step={step}
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

// --- Weekly: Step 3: Vertical Monday–Sunday Cycle calendar ------------------

function CycleCalendarStep({
  step,
  tasks,
  fieldProps,
  serviceWeekday,
  loading,
  addTask,
  updateTask,
  removeTask,
}: {
  readonly step: number;
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
      step={step}
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
                      label={`Cycle ${cycleIndex + 1}`}
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
  const priorityMeta = getPriorityMeta(task.priority);
  const PriorityIcon = priorityMeta.icon;

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

        <PriorityComboboxSelector
          onValueChange={(next) => onChange({ priority: next })}
          trigger={
            <FieldPill muted={task.priority === "no_priority"}>
              <PriorityIcon className={cn("size-3.5", priorityMeta.className)} />
              {task.priority === "no_priority" ? "Priority" : priorityMeta.label}
            </FieldPill>
          }
          value={task.priority}
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

// --- Weekly: Step 4: Preview and save --------------------------------------

function SaveStep({
  step,
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
  readonly step: number;
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
  const savedMessage = (() => {
    if (!schedule) return "Template saved.";
    if (isWeekly) return `Template saved and scheduled for ${WEEKDAY_NAMES[serviceWeekday]}s.`;
    return "Template saved and scheduled.";
  })();
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
      step={step}
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
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700 text-sm dark:text-emerald-400">
                <Check className="size-4" />
                {savedMessage}
              </span>
              <Button asChild size="sm" variant="outline">
                <Link to="/templates/library">Library</Link>
              </Button>
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
