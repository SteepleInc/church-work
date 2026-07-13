import type { KeyDateRule } from "@church-work/domain";
import {
  buildPeriodPlacementFrame,
  defaultTemplateScheduleForPlacementShape,
  type PeriodPlacementFrame,
  type PeriodTemplatePlacementShape,
} from "@church-work/domain";
import { revalidateLogic, useStore } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { Schema } from "effect";
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
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DescriptionEditor,
  type DescriptionEditorHandle,
} from "@/components/editor/description-editor";
import {
  parseDescriptionValue,
  serializeDescriptionValue,
} from "@/components/editor/description-value";
import { useAppForm } from "@/components/form/ts-form";
import {
  AssigneeComboboxSelector,
  EstimateComboboxSelector,
  LabelsComboboxSelector,
  PriorityComboboxSelector,
  TaskAssigneePillTrigger,
  type TaskEstimate,
  TaskEstimatePillTrigger,
  TaskLabelsPillTrigger,
  type TaskPriority,
  TaskPriorityPillTrigger,
  TaskTeamPillTrigger,
  TeamComboboxSelector,
} from "@/components/tasks/task-card-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollSections, type SectionRenderArgs } from "@/components/ui/scroll-sections";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type LabelItem, useLabelsCollection } from "@/data/labels/labelsData.app";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import {
  type TeamCollectionItem,
  useTeamMembershipsCollection,
  useTeamsCollection,
} from "@/data/teams/teamsData.app";
import {
  describeKeyDateSchedule,
  formatKeyDateOccurrence,
  KEY_DATE_PRESET_OPTIONS,
  type KeyDateItem,
  type KeyDateScheduleKind,
  keyDateKindLabel,
  useCreateKeyDate,
  useKeyDatesCollection,
} from "@/data/templates/keyDatesData.app";
import {
  useCreateKeyDateTemplate,
  useCreatePeriodTemplate,
  useCreateWeeklyServiceTemplate,
} from "@/data/templates/templatesData.app";
import { getUserDisplayName, useChurchUsersCollection } from "@/data/users/usersData.app";
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
   * The Template Task's week row, expressed as the Cycle offset from the
   * Template End Cycle (the unified placement coordinate, see CONTEXT.md
   * "Template Task Placement" and issue #219 story 17). 0 is the End Cycle; the
   * normalized focus frame occupies offsets [-(frameSize-1) … 0]; "before" rows
   * are more negative and "after" rows are positive. Weekly service and Key Date
   * shapes anchor their single focus Cycle at offset 0.
   */
  readonly cycleOffsetFromEnd: number;
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

const newDraftTask = (
  placementWeekday: number,
  teamId: string,
  cycleOffsetFromEnd = 0,
): DraftTask => ({
  assigneeId: null,
  cycleOffsetFromEnd,
  description: "",
  estimate: "no_estimate",
  priority: "no_priority",
  id: crypto.randomUUID(),
  labelIds: [],
  placementWeekday,
  teamId,
  title: "",
});

// The Template's own name and description, shared by every authoring shape. The
// label, placeholder, and validation are intentionally generic so switching the
// Template shape never relabels or rewrites what the user has already typed.
const TEMPLATE_NAME_LABEL = "Template name";
const TEMPLATE_NAME_PLACEHOLDER = "Name this Template";
const TEMPLATE_DESCRIPTION_LABEL = "Description";
const TEMPLATE_DESCRIPTION_PLACEHOLDER = "What is this Template for?";

const TemplateDetailsSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1, { message: "Give the Template a name." })),
  ),
  description: Schema.String,
});

type TemplateDetails = { name: string; description: string };

/**
 * The shared TanStack form behind every Template authoring shape: just the
 * Template's own name and description. Schedule, shape, and Template Tasks are
 * intentionally not form fields — they are selections and a collection editor,
 * not validated text inputs. Keeping the details in one form means the Name and
 * Description never relabel or reset when the Template shape changes.
 */
function useTemplateDetailsForm(onSave: (value: TemplateDetails) => void | Promise<void>) {
  return useAppForm({
    defaultValues: { name: "", description: "" } as TemplateDetails,
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: { onSubmit: Schema.toStandardSchemaV1(TemplateDetailsSchema) },
    onSubmit: ({ value }) => onSave(value),
  });
}

type TemplateDetailsForm = ReturnType<typeof useTemplateDetailsForm>;

/**
 * Renders the Template's Name and Description fields from the shared form. The
 * label, placeholder, and required-state are fixed regardless of Template shape.
 */
function TemplateDetailsFields({
  form,
  onChange,
}: {
  readonly form: TemplateDetailsForm;
  readonly onChange?: () => void;
}) {
  return (
    <div className="flex max-w-md flex-col gap-3">
      <form.AppField name="name">
        {(field) => (
          <field.InputField
            autoComplete="off"
            data-1p-ignore="true"
            label={TEMPLATE_NAME_LABEL}
            onInput={onChange}
            placeholder={TEMPLATE_NAME_PLACEHOLDER}
            required
          />
        )}
      </form.AppField>
      <form.AppField name="description">
        {(field) => (
          <field.TextareaField
            label={TEMPLATE_DESCRIPTION_LABEL}
            onInput={onChange}
            placeholder={TEMPLATE_DESCRIPTION_PLACEHOLDER}
            rows={2}
          />
        )}
      </form.AppField>
    </div>
  );
}

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
  readonly teamPickerOptions: readonly {
    id: string;
    name: string;
    color: string | null;
  }[];
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
 * anchored flow. Both flows mirror Church Work's planning language and produce
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

      {shape === "key_date" ? (
        <KeyDateAuthoring onShapeChange={setShape} />
      ) : (
        <WeeklyServiceAuthoring initialShape={shape} onShapeChange={setShape} />
      )}
    </div>
  );
}

// --- Big-action stepper flow -----------------------------------------------

/**
 * Stepper labels and descriptions. These are intentionally shape-agnostic so the
 * stepper title/description stay constant as the user picks a shape or schedule.
 */
export const TEMPLATE_FLOW_STEPS: readonly {
  readonly label: string;
  readonly description: string;
}[] = [
  { description: "Name and schedule the Template", label: "Setup" },
  { description: "Place Template Tasks", label: "Tasks" },
  { description: "Preview and save", label: "Save" },
];

export function templateFlowStepCount(): number {
  return TEMPLATE_FLOW_STEPS.length;
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
 * combined Setup screen (shape, name, and schedule) owned by the per-shape
 * orchestrator, which also holds all authoring state and renders only its active
 * screen.
 */
export function TemplateAuthoringFlow({
  shape,
  step,
  onShapeChange,
  onStepChange,
  onClose,
  onDirtyChange,
}: {
  readonly shape: TemplateShape;
  readonly step: number;
  readonly onShapeChange: (shape: TemplateShape) => void;
  readonly onStepChange: (step: number) => void;
  readonly onClose: () => void;
  /**
   * Reports whether the in-progress Template carries unsaved edits (a name,
   * description, or any placed Template Task) so the big action can confirm
   * before discarding on close. Pristine flows report `false` and close
   * without a prompt.
   */
  readonly onDirtyChange?: (dirty: boolean) => void;
}) {
  const goBack = () => onStepChange(Math.max(step - 1, 0));
  const goForward = () => onStepChange(step + 1);

  return shape === "key_date" ? (
    <KeyDateAuthoring
      goBack={goBack}
      goForward={goForward}
      onClose={onClose}
      onDirtyChange={onDirtyChange}
      onShapeChange={onShapeChange}
      step={step}
    />
  ) : (
    <WeeklyServiceAuthoring
      goBack={goBack}
      goForward={goForward}
      initialShape={shape}
      onClose={onClose}
      onDirtyChange={onDirtyChange}
      onShapeChange={onShapeChange}
      step={step}
    />
  );
}

/**
 * The weekly service Template authoring flow. A single guided surface that
 * mirrors Church Work's planning language: choose the service weekday, place
 * Template Tasks on a vertical Monday–Sunday Cycle calendar, preview the first
 * projected Week, and save (optionally creating a repeating weekly Template
 * Schedule). Template Tasks carry planning fields only — no Workflow Status or
 * Task State (see CONTEXT.md "Template Task").
 */
function WeeklyServiceAuthoring({
  initialShape,
  onShapeChange,
  step,
  goBack,
  goForward,
  onClose,
  onDirtyChange,
}: {
  readonly initialShape: TemplateAuthoringShape;
  /**
   * Switches the active Template shape. Selecting `key_date` swaps the whole
   * orchestrator (handled by the parent flow); period shapes stay in place.
   */
  readonly onShapeChange: (shape: TemplateShape) => void;
  /**
   * The active stepper screen (0-based: 0 = combined Setup, 1 = Tasks, 2 = Save).
   * When omitted, the legacy stacked layout renders all steps at once (used by
   * the standalone authoring page).
   */
  readonly step?: number;
  readonly goBack?: () => void;
  readonly goForward?: () => void;
  readonly onClose?: () => void;
  /** Reports unsaved-edit state up to the big action's close guard. */
  readonly onDirtyChange?: (dirty: boolean) => void;
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
  // Remembers the Team of the most recently created/edited Template Task so the
  // next blank Task seeds with it (chain-capture convenience).
  const lastTeamIdRef = useRef("");

  const [shape, setShape] = useState<TemplateAuthoringShape>(initialShape);
  const [serviceWeekday, setServiceWeekday] = useState(0); // Sunday default
  const [schedule, setSchedule] = useState(true);
  const [repeatYearly, setRepeatYearly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tasks, setTasks] = useState<readonly DraftTask[]>([]);

  // The Template's name and description are a TanStack form (see
  // useTemplateDetailsForm). save() is bound below before the form is created.
  const form = useTemplateDetailsForm((value) => save(value));

  // Reactive read of the Template name for step gating and the Save preview.
  const name = useStore(form.store, (state) => state.values.name);
  const description = useStore(form.store, (state) => state.values.description);

  // Any edit invalidates a prior "saved" confirmation so the Save step re-arms.
  const resetSaved = () => setSaved(false);

  // A flow is "dirty" once it carries a name, description, or a Template Task —
  // anything a close would throw away. A freshly saved Template is no longer
  // dirty, so the "Done" affordance closes without a prompt.
  const isDirty = !saved && (name.trim() !== "" || description.trim() !== "" || tasks.length > 0);
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
        : buildPeriodPlacementFrame({
            periodStartLocalDate: periodStartDate,
            shape,
          }),
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
    () =>
      users.usersCollection.map((user) => ({
        id: user.id,
        label: getUserDisplayName(user),
      })),
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
    if (patch.teamId) lastTeamIdRef.current = patch.teamId;
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  };

  const addTask = (placementWeekday: number, cycleOffsetFromEnd = 0) => {
    setSaved(false);
    // New Template Tasks inherit the Team of the most recently edited Task so a
    // coordinator can dump several Tasks for the same ministry without
    // re-picking the Team each time (see the chain-capture flow). The first Task
    // starts with no Team — we never auto-select one — so the coordinator picks
    // it deliberately.
    const seedTeamId = lastTeamIdRef.current;
    const draft = newDraftTask(placementWeekday, seedTeamId, cycleOffsetFromEnd);
    setTasks((current) => [...current, draft]);
    return draft.id;
  };

  const removeTask = (id: string) => {
    setSaved(false);
    setTasks((current) => current.filter((task) => task.id !== id));
  };

  const save = async ({ name, description }: { name: string; description: string }) => {
    if (!churchId) return;
    const trimmedName = name.trim();
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
      description: description.trim() || null,
      key: slugify(trimmedName),
      name: trimmedName,
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
          // Weekly service anchors its focus Cycle at offset 0; before/after
          // rows carry their signed offset from the Template End Cycle directly.
          placementCycleOffset: task.cycleOffsetFromEnd,
          placementWeekday: task.placementWeekday,
          templateTeamKey: team?.identifier ?? templateTeams[0]?.key ?? "team",
          title: task.title.trim(),
        };
      }),
      templateTeams,
    };
    const result =
      shape === "weekly_service"
        ? await createTemplate({ ...common, serviceWeekday, startDate })
        : await createPeriodTemplate({
            ...common,
            periodStartDate,
            scheduleDefaults: defaultTemplateScheduleForPlacementShape(shape, {
              repeatYearly,
            }),
            shape,
            // Period placement: each Template Task carries its signed Cycle
            // offset from the Template End Cycle (the focus frame occupies
            // [-(frameSize-1) … 0]; before/after rows extend past it) and its
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
                placementCycleOffset: task.cycleOffsetFromEnd,
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

  const scheduleStep =
    shape === "weekly_service" ? (
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
    );

  // The combined first step: pick the Template shape, name it, and configure its
  // schedule (service weekday or normalized period frame) in one screen.
  const setupStep = (
    <ShapeNameStep
      fields={<TemplateDetailsFields form={form} onChange={resetSaved} />}
      onSelect={(next) => {
        setSaved(false);
        if (next === "key_date") {
          onShapeChange(next);
          return;
        }
        selectShape(next);
        setSchedule(true);
      }}
      shape={shape}
    >
      {scheduleStep}
    </ShapeNameStep>
  );

  const gridDescriptor = useMemo<CycleGridDescriptor | null>(() => {
    if (shape === "weekly_service") {
      return buildAnchorGridDescriptor({
        anchorWeekday: serviceWeekday,
        focusLabel: "Service week",
        highlightLabel: "Service",
      });
    }
    return periodFrame ? buildPeriodGridDescriptor(periodFrame, shape) : null;
  }, [shape, serviceWeekday, periodFrame]);

  const tasksStep = (
    <CycleGridStep
      addTask={addTask}
      descriptor={gridDescriptor}
      emptyHint="Configure the schedule to place Template Tasks."
      fieldProps={taskFieldProps}
      loading={dataLoading}
      removeTask={removeTask}
      step={2}
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
      onSave={() => form.handleSubmit()}
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
      step={3}
      templateName={name}
    />
  );

  if (!stepped) {
    return (
      <div className="flex flex-col gap-8">
        {setupStep}
        {tasksStep}
        {saveStep}
      </div>
    );
  }

  // Stepper screens. Steps here are 0: shape/name/schedule (Setup),
  // 1: tasks, 2: preview & save.
  const screen = (() => {
    switch (step) {
      case 0:
        return { canAdvance: name.trim().length > 0, content: setupStep };
      case 1:
        return { canAdvance: placedCount > 0, content: tasksStep };
      default:
        return { canAdvance: true, content: saveStep };
    }
  })();

  // Step 2 (the Cycle grid) fills the available height so its internal scroll
  // container drives the before/focus/after scroll; the other steps flow
  // top-aligned as before.
  const fillContent = step === 1;

  return (
    <div className={cn("flex flex-col", fillContent ? "h-full min-h-0" : "min-h-full")}>
      <div className={cn("flex flex-col pb-6", fillContent ? "min-h-0 flex-1" : "gap-6")}>
        {screen.content}
      </div>
      <StepNav
        canAdvance={screen.canAdvance}
        isFirst={step <= 0}
        isLast={step >= 2}
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
  onShapeChange,
  onDirtyChange,
}: {
  readonly step?: number;
  readonly goBack?: () => void;
  readonly goForward?: () => void;
  readonly onClose?: () => void;
  /**
   * Switches the active Template shape. Selecting a period shape swaps the whole
   * orchestrator (handled by the parent flow).
   */
  readonly onShapeChange?: (shape: TemplateShape) => void;
  /** Reports unsaved-edit state up to the big action's close guard. */
  readonly onDirtyChange?: (dirty: boolean) => void;
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
  // Remembers the Team of the most recently created/edited Template Task so the
  // next blank Task seeds with it (chain-capture convenience).
  const lastTeamIdRef = useRef("");

  const [selectedKeyDateId, setSelectedKeyDateId] = useState<string | null>(null);
  const [pendingKeyDateKey, setPendingKeyDateKey] = useState<string | null>(null);
  const [repeatYearly, setRepeatYearly] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tasks, setTasks] = useState<readonly DraftTask[]>([]);

  // The Template's name and description are a TanStack form (see
  // useTemplateDetailsForm); generic fields that stay put no matter which Key
  // Date anchors the Template.
  const form = useTemplateDetailsForm((value) => save(value));

  const name = useStore(form.store, (state) => state.values.name);
  const description = useStore(form.store, (state) => state.values.description);
  const resetSaved = () => setSaved(false);

  // A flow is "dirty" once it carries a name, description, an anchoring Key
  // Date, or a Template Task — anything a close would throw away. A freshly
  // saved Template is no longer dirty, so "Done" closes without a prompt.
  const isDirty =
    !saved &&
    (name.trim() !== "" ||
      description.trim() !== "" ||
      selectedKeyDateId !== null ||
      tasks.length > 0);
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
    () =>
      users.usersCollection.map((user) => ({
        id: user.id,
        label: getUserDisplayName(user),
      })),
    [users.usersCollection],
  );

  const placedCount = tasks.filter((task) => task.title.trim() && task.teamId).length;

  const updateTask = (id: string, patch: Partial<DraftTask>) => {
    setSaved(false);
    if (patch.teamId) lastTeamIdRef.current = patch.teamId;
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  };

  const addTask = (placementWeekday: number, cycleOffsetFromEnd = 0) => {
    setSaved(false);
    // New Template Tasks inherit the Team of the most recently edited Task so a
    // coordinator can dump several Tasks for the same ministry without
    // re-picking the Team each time (see the chain-capture flow). The first Task
    // starts with no Team — we never auto-select one — so the coordinator picks
    // it deliberately.
    const seedTeamId = lastTeamIdRef.current;
    const draft = newDraftTask(placementWeekday, seedTeamId, cycleOffsetFromEnd);
    setTasks((current) => [...current, draft]);
    return draft.id;
  };

  const removeTask = (id: string) => {
    setSaved(false);
    setTasks((current) => current.filter((task) => task.id !== id));
  };

  const selectKeyDate = (keyDate: KeyDateItem) => {
    setSaved(false);
    setError(null);
    setSelectedKeyDateId(keyDate.id);
  };

  const createAndSelectKeyDate = async (keyDateName: string, schedule: KeyDateRule) => {
    if (!churchId) return;
    setError(null);
    const trimmed = keyDateName.trim();
    const key = slugify(trimmed);
    const result = await createKeyDate({
      key,
      name: trimmed,
      schedule,
    });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    // The new Key Date streams in via Zero; select it once present by matching
    // on the slug key. The Template name is left untouched — it is the user's to
    // set and never auto-derived from the Key Date.
    setSaved(false);
    setPendingKeyDateKey(key);
  };

  const save = async ({ name, description }: { name: string; description: string }) => {
    if (!churchId || !selectedKeyDate || !occurrenceDate) {
      setError("Choose a Key Date to anchor this Template.");
      return;
    }
    const trimmedName = name.trim();
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
      description: description.trim() || null,
      key: slugify(trimmedName),
      keyDateId: selectedKeyDate.id,
      name: trimmedName,
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
          // Key Date anchors its focus Cycle (the occurrence's Cycle) at offset
          // 0; before/after rows carry their signed offset from it directly.
          placementCycleOffset: task.cycleOffsetFromEnd,
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

  // The combined first step: pick the Template shape, name it, and anchor it to
  // a Key Date in one screen.
  const setupStep = (
    <ShapeNameStep
      fields={<TemplateDetailsFields form={form} onChange={resetSaved} />}
      onSelect={(next) => {
        if (next === "key_date") return;
        setSaved(false);
        onShapeChange?.(next);
      }}
      shape="key_date"
    >
      <KeyDatePickerField
        churchId={churchId}
        keyDates={keyDates.keyDatesCollection}
        loading={churchLoading || keyDates.loading}
        occurrenceDate={occurrenceDate}
        onCreateKeyDate={createAndSelectKeyDate}
        onSelect={selectKeyDate}
        selectedKeyDate={selectedKeyDate}
      />
    </ShapeNameStep>
  );

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

  const gridDescriptor = useMemo<CycleGridDescriptor | null>(() => {
    if (!occurrenceDate || occurrenceWeekday === null || !selectedKeyDate) return null;
    return buildAnchorGridDescriptor({
      anchorWeekday: occurrenceWeekday,
      focusLabel: `${selectedKeyDate.name} · ${formatKeyDateOccurrence(occurrenceDate)}`,
      highlightLabel: selectedKeyDate.name,
    });
  }, [occurrenceDate, occurrenceWeekday, selectedKeyDate]);

  const calendarStep = (
    <CycleGridStep
      addTask={addTask}
      descriptor={gridDescriptor}
      emptyHint="Choose a Key Date to place Template Tasks around its occurrence."
      fieldProps={taskFieldProps}
      loading={churchLoading}
      removeTask={removeTask}
      step={2}
      tasks={tasks}
      teamsAvailable={teamsCollection.length > 0}
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
      onSave={() => form.handleSubmit()}
      placedCount={placedCount}
      repeatYearly={repeatYearly}
      saved={saved}
      saving={saving}
      selectedKeyDate={selectedKeyDate}
      step={3}
      templateName={name}
    />
  );

  if (!stepped) {
    return (
      <div className="flex flex-col gap-8">
        {setupStep}
        {calendarStep}
        {saveStep}
      </div>
    );
  }

  // Stepper screens. Steps here are 0: shape/name/Key Date (Setup),
  // 1: tasks, 2: preview & save.
  const screen = (() => {
    switch (step) {
      case 0:
        return {
          canAdvance: name.trim().length > 0 && Boolean(selectedKeyDate),
          content: setupStep,
        };
      case 1:
        return { canAdvance: placedCount > 0, content: calendarStep };
      default:
        return { canAdvance: true, content: saveStep };
    }
  })();

  const fillContent = step === 1;

  return (
    <div className={cn("flex flex-col", fillContent ? "h-full min-h-0" : "min-h-full")}>
      <div className={cn("flex flex-col pb-6", fillContent ? "min-h-0 flex-1" : "gap-6")}>
        {screen.content}
      </div>
      <StepNav
        canAdvance={screen.canAdvance}
        isFirst={step <= 0}
        isLast={step >= 2}
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

// --- Key Date: anchor selection / inline creation --------------------------

/**
 * Key Date anchor controls — the picker (or inline creator) plus the next
 * occurrence preview. Rendered inside the combined Setup step, beneath the
 * shape cards and Template name field.
 */
function KeyDatePickerField({
  churchId,
  keyDates,
  loading,
  occurrenceDate,
  selectedKeyDate,
  onSelect,
  onCreateKeyDate,
}: {
  readonly churchId: string | null;
  readonly keyDates: readonly KeyDateItem[];
  readonly loading: boolean;
  readonly occurrenceDate: string | null;
  readonly selectedKeyDate: KeyDateItem | null;
  readonly onSelect: (keyDate: KeyDateItem) => void;
  readonly onCreateKeyDate: (name: string, schedule: KeyDateRule) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-sm">
        Anchor the Template to a named Church date. Pick an existing Key Date or create one.
      </p>
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
    </div>
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
                        "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
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
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
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

const InlineKeyDateCreatorSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1, { message: "Key Date name is required." })),
  ),
  schedule: Schema.Any,
});

type InlineKeyDateCreatorValues = {
  readonly name: string;
  readonly schedule: KeyDateRule;
};

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
  const form = useAppForm({
    defaultValues: {
      name: "",
      schedule: defaultScheduleForKind("computedYearly"),
    } satisfies InlineKeyDateCreatorValues,
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onSubmit: Schema.toStandardSchemaV1(InlineKeyDateCreatorSchema),
    },
    onSubmit: ({ value }) => {
      const name = value.name.trim();
      if (!name) return;

      onCreate(name, value.schedule);
    },
  });

  const schedule = useStore(form.store, (state) => state.values.schedule);
  const setSchedule = (next: KeyDateRule) => form.setFieldValue("schedule", next);

  return (
    <form
      className="flex flex-col gap-3 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <div className="flex items-center gap-2 font-medium text-sm">
        <Sparkles className="size-4 text-muted-foreground" />
        New Key Date
      </div>
      <form.Field name="name">
        {(field) => (
          <Input
            // biome-ignore lint/a11y/noAutofocus: inline create affordance
            autoComplete="off"
            autoFocus
            data-1p-ignore="true"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.currentTarget.value)}
            placeholder="Key Date name"
            value={field.state.value}
          />
        )}
      </form.Field>

      <div className="flex flex-wrap gap-1.5">
        {KEY_DATE_KINDS.map((kind) => (
          <button
            className={cn(
              "cursor-pointer rounded-md border px-2.5 py-1 text-xs transition-colors",
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
                "flex cursor-pointer items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
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
        <form.Subscribe selector={(state) => state.values.name.trim().length > 0}>
          {(hasName) => (
            <Button disabled={!hasName} size="sm" type="submit">
              Create
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
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
  fill = false,
}: {
  readonly step: number;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly action?: ReactNode;
  /**
   * When true, the section fills the available height and its content area is a
   * bounded, min-h-0 flex column — required so a nested scroll container (the
   * Cycle grid's ScrollSections) gets a real height to drive its scroll engine.
   */
  readonly fill?: boolean;
}) {
  return (
    <section className={cn("flex flex-col gap-4", fill && "min-h-0 flex-1")}>
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
      <div className={cn("pl-9", fill && "flex min-h-0 flex-1 flex-col")}>{children}</div>
    </section>
  );
}

// --- Step 0: Setup (shape + name + schedule) -------------------------------

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

/**
 * The combined first step (Setup): name and describe the Template, pick its
 * shape, and configure its schedule. The schedule controls vary by shape and are
 * supplied as `children` by each orchestrator (the service weekday, the period
 * frame, or the Key Date anchor).
 */
function ShapeNameStep({
  shape,
  onSelect,
  fields,
  children,
}: {
  readonly shape: TemplateShape;
  readonly onSelect: (shape: TemplateShape) => void;
  /** The Template Name + Description fields, supplied by the orchestrator's form. */
  readonly fields: ReactNode;
  readonly children?: ReactNode;
}) {
  return (
    <StepSection
      description="Name and describe the Template, pick its shape, and set its schedule."
      step={1}
      title="Template setup"
    >
      <div className="flex flex-col gap-5">
        {fields}

        <SubSection
          description="Choose the authoring frame. It sets the schedule and calendar controls."
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
                    entry.available && "cursor-pointer",
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
        </SubSection>

        {children}
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
    <SubSection
      description="The period start anchors the normalized Cycle frame. Each Cycle is owned by the period it mostly covers; boundary Cycles are marked."
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
    </SubSection>
  );
}

/**
 * Lightweight labelled sub-section for controls nested inside a combined step
 * (e.g. the schedule controls under the Setup step). Unlike `StepSection`, it
 * carries no numbered badge — the parent step owns the number.
 */
function SubSection({
  title,
  description,
  action,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t pt-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-medium text-sm">{title}</h3>
          {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// --- Weekly: schedule (service weekday) ------------------------------------

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
    <SubSection
      description="The service day anchors the Cycle. Template Tasks placed on it are due that day."
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
                  "cursor-pointer rounded-md border px-3 py-1.5 font-medium text-sm transition-colors",
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
    </SubSection>
  );
}

// --- Cycle grid descriptors -------------------------------------------------

/**
 * Builds the grid descriptor for a single-Cycle focus shape (weekly service or
 * Key Date): the focus window is one Cycle at offset 0, with the anchor weekday
 * highlighted in every row.
 */
function buildAnchorGridDescriptor(params: {
  readonly anchorWeekday: number;
  readonly focusLabel: string;
  readonly highlightLabel: string;
}): CycleGridDescriptor {
  return {
    focusLabel: params.focusLabel,
    focusMeta: new Map(),
    focusStartOffset: 0,
    weekdayHighlight: {
      label: params.highlightLabel,
      weekday: params.anchorWeekday,
    },
  };
}

/**
 * Builds the grid descriptor for a period shape (monthly/quarterly/yearly) from
 * the normalized placement frame: the focus window is the whole frame, offsets
 * [-(frameSize-1) … 0] measured from the End Cycle, each focus row carrying its
 * owned-period label, in-focus flag, and any boundary-day marker.
 */
function buildPeriodGridDescriptor(
  frame: PeriodPlacementFrame,
  shape: PeriodTemplatePlacementShape,
): CycleGridDescriptor {
  const frameSize = frame.cycles.length;
  const focusMeta = new Map<number, FocusCycleMeta>();
  frame.cycles.forEach((cycle, index) => {
    const offset = index - (frameSize - 1);
    const boundaryDay = cycle.days.find((day) => day.isPeriodBoundary);
    focusMeta.set(offset, {
      boundaryLabel: boundaryDay ? boundaryLabelFor(boundaryDay.localDate, frame) : null,
      isInFocusPeriod: cycle.isInFocusPeriod,
      ownedPeriodLabel: ownedPeriodLabel(cycle.ownedPeriodKey),
    });
  });
  return {
    focusLabel: `${ownedPeriodLabel(frame.periodKey)} · ${frameSize}-Cycle ${shape} frame`,
    focusMeta,
    focusStartOffset: -(frameSize - 1),
    weekdayHighlight: null,
  };
}

// --- Unified Cycle grid (before / focus window / after) --------------------

/**
 * Per-Cycle metadata for a week row that falls inside the normalized focus
 * frame. Rows outside the frame (before/after) have no meta — they are plain
 * week rows derived purely from the Template End Cycle offset.
 */
type FocusCycleMeta = {
  /** Owned-period label (e.g. "February 2026"); shown when it changes row-to-row. */
  readonly ownedPeriodLabel: string;
  readonly isInFocusPeriod: boolean;
  /** Monday-first weekday index of a period-boundary day in this Cycle, if any. */
  readonly boundaryLabel: string | null;
};

/**
 * A normalized description of the Cycle grid shared by every Template shape. The
 * focus window is the contiguous offset range `[focusStartOffset … 0]` measured
 * from the Template End Cycle (see CONTEXT.md "Template Task Placement"): weekly
 * service and Key Date are a single focus row at offset 0; monthly/quarterly/
 * yearly are the whole normalized 5/13/52-Cycle frame. "Before" and "after" are
 * open-ended week rows on either side of that window.
 */
type CycleGridDescriptor = {
  /** Most-negative focus offset (0 for weekly/Key Date, -(frameSize-1) for period). */
  readonly focusStartOffset: number;
  /** Rich label for the single focus Cycle of a weekly/Key Date shape. */
  readonly focusLabel: string;
  /** Per-offset focus metadata, keyed by Cycle offset from the End Cycle. */
  readonly focusMeta: ReadonlyMap<number, FocusCycleMeta>;
  /**
   * A weekday to highlight in every row (the weekly service day or the Key Date
   * occurrence weekday), as a JS weekday index, plus its short badge label.
   */
  readonly weekdayHighlight: {
    readonly weekday: number;
    readonly label: string;
  } | null;
};

/** How many extra week rows to render beyond the focus window on each side. */
const GRID_BUFFER_ROWS = 4;

/**
 * The unified Step 2 surface for every calendar shape. Renders one scrolling
 * column of week rows split into three sticky `ScrollSections` groups — Before,
 * the focus window, and After — each day of every row a real drop target for the
 * inline Template Task creator. Before/after rows extend infinitely as the user
 * scrolls, so work can be placed far outside the normalized frame without
 * explicitly adding Template Weeks (issue #219 stories 15–17).
 */
function CycleGridStep({
  step,
  descriptor,
  tasks,
  fieldProps,
  loading,
  teamsAvailable,
  emptyHint,
  addTask,
  updateTask,
  removeTask,
}: {
  readonly step: number;
  readonly descriptor: CycleGridDescriptor | null;
  readonly tasks: readonly DraftTask[];
  readonly fieldProps: TaskFieldProps;
  readonly loading: boolean;
  readonly teamsAvailable: boolean;
  /** Shown in place of the grid when there is no descriptor yet (e.g. no Key Date). */
  readonly emptyHint: string;
  readonly addTask: (weekday: number, cycleOffsetFromEnd: number) => string;
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
      description="Place Template Tasks on the day they are due. Scroll before or after the focus window to plan work outside it. No Workflow Status or Task State yet."
      fill
      step={step}
      title="Cycle calendar"
    >
      {loading ? (
        <CalendarSkeleton />
      ) : !teamsAvailable ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          Create a Team before authoring Template Tasks.
        </div>
      ) : !descriptor ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          {emptyHint}
        </div>
      ) : (
        <CycleGrid
          addTask={addTask}
          descriptor={descriptor}
          fieldProps={fieldProps}
          removeTask={removeTask}
          tasks={tasks}
          updateTask={updateTask}
        />
      )}
    </StepSection>
  );
}

/** The before / focus / after scrolling grid itself. */
function CycleGrid({
  descriptor,
  tasks,
  fieldProps,
  addTask,
  updateTask,
  removeTask,
}: {
  readonly descriptor: CycleGridDescriptor;
  readonly tasks: readonly DraftTask[];
  readonly fieldProps: TaskFieldProps;
  readonly addTask: (weekday: number, cycleOffsetFromEnd: number) => string;
  readonly updateTask: (id: string, patch: Partial<DraftTask>) => void;
  readonly removeTask: (id: string) => void;
}) {
  const { focusStartOffset } = descriptor;

  // The rendered offset window grows outward from the focus frame as the user
  // nears either edge. The focus range is always rendered; before/after grow.
  const [minOffset, setMinOffset] = useState(focusStartOffset - GRID_BUFFER_ROWS);
  const [maxOffset, setMaxOffset] = useState(GRID_BUFFER_ROWS);

  // A row whose tasks live outside the rendered window must keep the row mounted
  // so the task stays editable; widen the window to include any placed offset.
  const placedMin = tasks.reduce(
    (acc, task) => Math.min(acc, task.cycleOffsetFromEnd),
    focusStartOffset - GRID_BUFFER_ROWS,
  );
  const placedMax = tasks.reduce((acc, task) => Math.max(acc, task.cycleOffsetFromEnd), 0);
  useEffect(() => {
    setMinOffset((current) => Math.min(current, placedMin));
    setMaxOffset((current) => Math.max(current, placedMax));
  }, [placedMin, placedMax]);

  const lowerOffset = Math.min(minOffset, placedMin);
  const upperOffset = Math.max(maxOffset, placedMax);

  // Offsets split into the three groups. "before" is the most-negative first.
  const beforeOffsets = useMemo(() => {
    const result: number[] = [];
    for (let offset = lowerOffset; offset < focusStartOffset; offset++) result.push(offset);
    return result;
  }, [lowerOffset, focusStartOffset]);
  const focusOffsets = useMemo(() => {
    const result: number[] = [];
    for (let offset = focusStartOffset; offset <= 0; offset++) result.push(offset);
    return result;
  }, [focusStartOffset]);
  const afterOffsets = useMemo(() => {
    const result: number[] = [];
    for (let offset = 1; offset <= upperOffset; offset++) result.push(offset);
    return result;
  }, [upperOffset]);

  // Tasks bucketed by Cycle offset, then by JS weekday, so each (week row, day
  // column) cell can read its own Template Tasks directly.
  const tasksByOffset = useMemo(() => {
    const map = new Map<number, Map<number, DraftTask[]>>();
    for (const task of tasks) {
      let byWeekday = map.get(task.cycleOffsetFromEnd);
      if (!byWeekday) {
        byWeekday = new Map<number, DraftTask[]>();
        map.set(task.cycleOffsetFromEnd, byWeekday);
      }
      const bucket = byWeekday.get(task.placementWeekday);
      if (bucket) bucket.push(task);
      else byWeekday.set(task.placementWeekday, [task]);
    }
    return map;
  }, [tasks]);

  // The before/after groups grow as the user scrolls near a rendered edge.
  const sentinelTopRef = useRef<HTMLDivElement>(null);
  const sentinelBottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const top = sentinelTopRef.current;
    const bottom = sentinelBottomRef.current;
    if (!top || !bottom) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (entry.target === top) setMinOffset((current) => current - GRID_BUFFER_ROWS);
        if (entry.target === bottom) setMaxOffset((current) => current + GRID_BUFFER_ROWS);
      }
    });
    observer.observe(top);
    observer.observe(bottom);
    return () => observer.disconnect();
  }, []);

  const renderGroupRows = (offsets: readonly number[]) =>
    offsets.map((offset) => (
      <CycleGridRow
        addTask={addTask}
        descriptor={descriptor}
        fieldProps={fieldProps}
        key={offset}
        offset={offset}
        removeTask={removeTask}
        tasksByWeekday={tasksByOffset.get(offset) ?? EMPTY_WEEKDAY_TASKS}
        updateTask={updateTask}
      />
    ));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
      <CycleGridWeekdayHeader highlight={descriptor.weekdayHighlight} />
      <ScrollSections.Root initialSectionId="focus" scrollbarGutter>
        <ScrollSections.Section
          aria-label="Weeks before the focus window"
          header={(args) => (
            <CycleGroupHeader label="Before" subdued beaconLabel="Earlier weeks" {...args} />
          )}
          id="before"
          index={0}
        >
          <div ref={sentinelTopRef} aria-hidden className="h-px w-full" />
          {renderGroupRows(beforeOffsets)}
        </ScrollSections.Section>

        <ScrollSections.Section
          aria-label={descriptor.focusLabel}
          header={(args) => <CycleGroupHeader label={descriptor.focusLabel} {...args} />}
          id="focus"
          index={1}
        >
          {renderGroupRows(focusOffsets)}
        </ScrollSections.Section>

        <ScrollSections.Section
          aria-label="Weeks after the focus window"
          header={(args) => (
            <CycleGroupHeader label="After" subdued beaconLabel="Later weeks" {...args} />
          )}
          id="after"
          index={2}
        >
          {renderGroupRows(afterOffsets)}
          <div ref={sentinelBottomRef} aria-hidden className="h-px w-full" />
        </ScrollSections.Section>
      </ScrollSections.Root>
    </div>
  );
}

const EMPTY_DRAFT_TASKS: readonly DraftTask[] = [];
const EMPTY_WEEKDAY_TASKS: ReadonlyMap<number, readonly DraftTask[]> = new Map();

/**
 * Sticky group header for a Cycle grid section. It speaks the grid's own
 * vocabulary — a full-bleed band closed by a hairline, with the uppercase,
 * letter-spaced label the Cycle divider bands use — so it reads as part of the
 * ledger rather than a pill floating over it. The focus section ("Service week")
 * gets full-strength ink; the Before/After framing sections stay subdued.
 */
function CycleGroupHeader({
  label,
  beaconLabel,
  subdued = false,
  state,
  scrollIntoView,
}: SectionRenderArgs & {
  readonly label: string;
  readonly beaconLabel?: string;
  readonly subdued?: boolean;
}) {
  if (state === "below" && beaconLabel) {
    return (
      <button
        aria-label={`Scroll to ${label}`}
        className="flex h-9 w-full items-center justify-center gap-1.5 border-y bg-background/95 px-3 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.08em] backdrop-blur-sm transition-colors hover:bg-accent hover:text-foreground"
        onClick={scrollIntoView}
        type="button"
      >
        <span className="truncate">{beaconLabel}</span>
      </button>
    );
  }

  // The "above" overlay is the primitive's redundant copy of a section whose own
  // sticky in-flow header is already pinned at the top — rendering it too would
  // stack two identical bands. The pinned/in-view in-flow header is the single
  // source of truth, so the above-overlay slot renders nothing.
  if (state === "above") return null;

  return (
    <div
      className={cn(
        "flex h-9 items-center gap-3 border-y bg-card/95 px-3 backdrop-blur-sm",
        subdued && "bg-muted/30",
      )}
    >
      <span
        className={cn(
          "shrink-0 truncate font-medium text-[11px] uppercase tracking-[0.08em]",
          subdued ? "text-muted-foreground/70" : "text-foreground",
        )}
      >
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** The shared 7-column track: Mon–Sun cells (no real dates — this is a Template). */
const GRID_COLUMNS = "grid grid-cols-7";

/**
 * Sticky Mon–Sun column header. The anchor weekday (the service day or Key Date
 * occurrence) is the gravitational center of the whole Template, so its column
 * header alone carries the primary tint and ink — keeping every weekday label on
 * one baseline rather than annotating the anchor with an extra sublabel.
 */
function CycleGridWeekdayHeader({
  highlight,
}: {
  readonly highlight: CycleGridDescriptor["weekdayHighlight"];
}) {
  return (
    <div className={cn(GRID_COLUMNS, "border-b bg-card")}>
      {MONDAY_FIRST.map((weekday, index) => {
        const isAnchor = highlight?.weekday === weekday;
        return (
          <div
            className={cn(
              "flex items-center justify-center px-2 py-2 font-medium text-xs uppercase tracking-wide",
              index !== 0 && "border-l",
              isAnchor ? "bg-primary/[0.06] text-primary" : "text-muted-foreground",
            )}
            key={weekday}
          >
            {WEEKDAY_SHORT[weekday]}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The label for a Cycle row, expressed relative to the focus window rather than
 * a real date (this is a Template). Focus cycles count "Cycle 1 … N" from the
 * top of the focus window; before/after rows count outward from its edges.
 */
function cycleRowLabel(offset: number, descriptor: CycleGridDescriptor) {
  const { focusStartOffset } = descriptor;
  if (offset >= focusStartOffset && offset <= 0) {
    const focusSize = 1 - focusStartOffset;
    if (focusSize === 1) return descriptor.focusLabel;
    return `Cycle ${offset - focusStartOffset + 1}`;
  }
  if (offset < focusStartOffset) {
    const n = focusStartOffset - offset;
    return `${n} week${n === 1 ? "" : "s"} before`;
  }
  return `${offset} week${offset === 1 ? "" : "s"} after`;
}

/**
 * One Cycle row in the grid: a thin divider band carrying the relative-Cycle
 * label, then seven day cells (Monday–Sunday). Each cell holds the Template
 * Tasks due that weekday and its own add affordance — the square the user drops
 * work into.
 */
function CycleGridRow({
  offset,
  descriptor,
  tasksByWeekday,
  fieldProps,
  addTask,
  updateTask,
  removeTask,
}: {
  readonly offset: number;
  readonly descriptor: CycleGridDescriptor;
  /** Tasks placed in this Cycle, bucketed by JS weekday. */
  readonly tasksByWeekday: ReadonlyMap<number, readonly DraftTask[]>;
  readonly fieldProps: TaskFieldProps;
  readonly addTask: (weekday: number, cycleOffsetFromEnd: number) => string;
  readonly updateTask: (id: string, patch: Partial<DraftTask>) => void;
  readonly removeTask: (id: string) => void;
}) {
  const meta = descriptor.focusMeta.get(offset) ?? null;
  const highlightWeekday = descriptor.weekdayHighlight?.weekday ?? null;
  const isFocus = offset >= descriptor.focusStartOffset && offset <= 0;

  // When the focus window is a single Cycle (weekly service / Key Date shapes),
  // the section header already names it — repeating the same label on this row's
  // divider band would stack two identical "Service week" rules. Suppress the
  // band for that lone focus row; multi-Cycle frames keep their "Cycle 1…N"
  // bands because those carry distinct, real sequence information.
  const isLoneFocusCycle = isFocus && descriptor.focusStartOffset === 0;

  return (
    <div className="group/row flex flex-col">
      {/* Cycle divider band: the relative-Cycle label rides a hairline rule. The
          label encodes a real sequence (Cycle 1…N, weeks before/after), so it
          stays an explicit marker; focus Cycles read at full strength. */}
      {isLoneFocusCycle ? null : (
        <div className="flex items-center gap-2 border-t px-3 py-2">
          <span
            className={cn(
              "shrink-0 font-medium text-[11px] uppercase tracking-[0.08em]",
              isFocus ? "text-foreground" : "text-muted-foreground/70",
            )}
          >
            {cycleRowLabel(offset, descriptor)}
          </span>
          {meta?.ownedPeriodLabel ? (
            <span className="shrink-0 text-muted-foreground text-xs normal-case">
              {meta.ownedPeriodLabel}
            </span>
          ) : null}
          {meta?.boundaryLabel ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-[10px] text-amber-700 uppercase tracking-wide dark:text-amber-400">
              <Flag className="size-2.5" />
              {meta.boundaryLabel}
            </span>
          ) : null}
          <span className="h-px flex-1 bg-border" />
        </div>
      )}

      {/* Seven day cells, Monday → Sunday. Only the focus (service) Cycle marks
          its anchor day with the indigo tint and spine — on before/after rows
          that weekday is ordinary, so it stays plain. */}
      <div className={GRID_COLUMNS}>
        {MONDAY_FIRST.map((weekday, index) => {
          const cellTasks = tasksByWeekday.get(weekday) ?? EMPTY_DRAFT_TASKS;
          const isAnchor = isFocus && highlightWeekday === weekday;
          return (
            <DayCell
              addTask={() => addTask(weekday, offset)}
              fieldProps={fieldProps}
              isAnchor={isAnchor}
              isFirstColumn={index === 0}
              key={weekday}
              removeTask={removeTask}
              tasks={cellTasks}
              updateTask={updateTask}
            />
          );
        })}
      </div>
    </div>
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

/**
 * One weekday column inside a Cycle row. Following the Google Calendar quick-add
 * model, the cell is never the editor: placed Template Tasks render as compact
 * chips, and creating or editing happens in a popover that opens to the side of
 * the column (so the day stays visible while you type). The cell owns which Task
 * (if any) currently has its editor popover open.
 */
function DayCell({
  tasks,
  fieldProps,
  isAnchor,
  isFirstColumn,
  addTask,
  updateTask,
  removeTask,
}: {
  readonly tasks: readonly DraftTask[];
  readonly fieldProps: TaskFieldProps;
  readonly isAnchor: boolean;
  readonly isFirstColumn: boolean;
  readonly addTask: () => string;
  readonly updateTask: (id: string, patch: Partial<DraftTask>) => void;
  readonly removeTask: (id: string) => void;
}) {
  // The id of the Task whose editor popover is open in this cell, or null. New
  // captures and chip clicks both flow through this single piece of state so at
  // most one editor is open per cell.
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const openTask = tasks.find((task) => task.id === openTaskId) ?? null;
  const isEmpty = tasks.length === 0;

  // Start a fresh capture: drop a blank Task into this column and open its
  // editor immediately. The blank chip then fills in live as the user types.
  const startCapture = () => setOpenTaskId(addTask());

  // Closing an editor drops any Task left untitled — clicking the add
  // affordance, typing nothing, then dismissing should leave no empty chip.
  const closeEditor = (taskId: string) => {
    setOpenTaskId((current) => (current === taskId ? null : current));
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (task && !task.title.trim()) removeTask(taskId);
  };

  return (
    <div
      className={cn(
        "group/cell relative flex min-h-20 min-w-0 flex-col gap-1 p-1.5",
        !isFirstColumn && "border-l",
        isAnchor && "bg-primary/[0.035] shadow-[inset_2px_0_0_var(--primary)]",
      )}
    >
      {tasks.map((task) => (
        <TemplateTaskChip
          fieldProps={fieldProps}
          isOpen={openTaskId === task.id}
          key={task.id}
          onOpen={() => setOpenTaskId(task.id)}
          onRemove={() => {
            setOpenTaskId((current) => (current === task.id ? null : current));
            removeTask(task.id);
          }}
          task={task}
        />
      ))}

      {/* Capture affordance. The anchor day gets a standing dashed invitation;
          every other day stays quiet canvas that surfaces on hover/focus, so
          the grid isn't a wall of seven identical buttons. */}
      <AddTaskTrigger emphasized={isEmpty && isAnchor} onClick={startCapture} quiet={!isEmpty} />

      {/* The editor popover, pinned to this cell and opening to its side. It is
          rendered once per cell and re-targets whichever Task is currently
          open, so chaining to a fresh Task keeps it anchored here. */}
      {openTask ? (
        <TemplateTaskEditor
          fieldProps={fieldProps}
          onChange={(patch) => updateTask(openTask.id, patch)}
          onClose={() => closeEditor(openTask.id)}
          onCommitAndChain={startCapture}
          onRemove={() => {
            setOpenTaskId(null);
            removeTask(openTask.id);
          }}
          task={openTask}
        />
      ) : null}
    </div>
  );
}

/**
 * The capture affordance for a day cell. Empty anchor cells extend a gentle
 * full-width dashed invitation; cells that already hold work (or non-anchor
 * empties) keep a compact, quiet "Add" row that surfaces on hover/focus.
 */
function AddTaskTrigger({
  onClick,
  quiet = false,
  emphasized = false,
}: {
  readonly onClick: () => void;
  readonly quiet?: boolean;
  readonly emphasized?: boolean;
}) {
  if (emphasized) {
    return (
      <button
        className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-primary/25 border-dashed py-2 font-medium text-primary text-xs transition-colors hover:bg-primary/[0.06]"
        data-template-task-trigger
        onClick={onClick}
        type="button"
      >
        <Plus className="size-3.5" />
        Add Template Task
      </button>
    );
  }
  return (
    <button
      aria-label="Add Template Task"
      className={cn(
        "flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground",
        quiet && "opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100",
      )}
      data-template-task-trigger
      onClick={onClick}
      type="button"
    >
      <Plus className="size-3.5" />
      Add task
    </button>
  );
}

/**
 * A placed Template Task as it reads inside a day cell: title plus a thin
 * summary line of whatever properties are set (assignee, else Team). It is the
 * trigger for its own editor popover — clicking the chip opens the editor, which
 * the cell keeps anchored to the column. Unset properties contribute nothing, so
 * a just-typed Task stays a single tidy line.
 */
function TemplateTaskChip({
  task,
  fieldProps,
  isOpen,
  onOpen,
  onRemove,
}: {
  readonly task: DraftTask;
  readonly fieldProps: TaskFieldProps;
  readonly isOpen: boolean;
  readonly onOpen: () => void;
  readonly onRemove: () => void;
}) {
  const { teams, assigneeOptions } = fieldProps;
  const selectedTeam = teams.find((team) => team.id === task.teamId) ?? null;
  const selectedAssignee = assigneeOptions.find((option) => option.id === task.assigneeId) ?? null;
  const summary = selectedAssignee?.label ?? selectedTeam?.name ?? null;

  return (
    <div className="group/chip relative">
      <button
        className={cn(
          "flex w-full cursor-pointer flex-col gap-0.5 rounded-md border bg-background py-1 pr-6 pl-2 text-left transition-colors hover:border-foreground/20 hover:bg-accent",
          isOpen && "border-primary/40 ring-1 ring-primary/30",
        )}
        onClick={onOpen}
        type="button"
      >
        <span className="flex items-center gap-1.5">
          {selectedTeam ? (
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: selectedTeam.color ?? "var(--muted-foreground)" }}
            />
          ) : null}
          <span
            className={cn(
              "truncate font-medium text-xs",
              !task.title.trim() && "text-muted-foreground italic",
            )}
          >
            {task.title.trim() || "Untitled task"}
          </span>
        </span>
        {summary ? (
          <span className="truncate text-[11px] text-muted-foreground">{summary}</span>
        ) : null}
      </button>
      <button
        aria-label="Remove Template Task"
        className="absolute top-1 right-1 inline-flex size-4 cursor-pointer items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/chip:opacity-100"
        onClick={onRemove}
        type="button"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
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

// --- Template Task editor ---------------------------------------------------

/**
 * The Google-Calendar-style quick editor. Pinned to the day cell that owns it,
 * it opens to the side of the column so the day stays visible, gives the title
 * field room to breathe as the hero, lays the property pickers out as
 * comfortable rows, and supports the chain-capture loop: pressing Enter in the
 * title commits the current Task and immediately opens a fresh one in the same
 * cell, so a coordinator can dump several Tasks for a day without reaching for
 * the mouse. Escape (or dismissing while untitled) closes and drops an empty
 * Task.
 */
function TemplateTaskEditor({
  task,
  fieldProps,
  onChange,
  onClose,
  onCommitAndChain,
  onRemove,
}: {
  readonly task: DraftTask;
  readonly fieldProps: TaskFieldProps;
  readonly onChange: (patch: Partial<DraftTask>) => void;
  readonly onClose: () => void;
  readonly onCommitAndChain: () => void;
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
  const titleRef = useRef<HTMLInputElement | null>(null);
  // Imperative handle for the Plate description editor so the title can hand
  // focus down with the caret at the top (a plain `.focus()` restores the last
  // caret), making the title↔description seam read as one surface (Linear).
  const descriptionFocusRef = useRef<DescriptionEditorHandle>(null);

  // The title and description read as one surface (Linear), matching the create
  // Task modal: arrowing down (or right past the end of the title) drops into
  // the description, and arrowing up (or Escape) from the start of the
  // description climbs back into the title with the caret at the end.
  const focusDescriptionStart = () => {
    descriptionFocusRef.current?.focusStart();
  };
  const focusTitleEnd = () => {
    const input = titleRef.current;
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  };

  // The stored description is serialized Plate JSON; the uncontrolled editor
  // reads its initial value once on mount. The editor is remounted per Task via
  // the `task.id` key (below), so this only needs to track the current Task.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialDescriptionValue = useMemo(() => parseDescriptionValue(task.description), [task.id]);

  // Keep the cursor in the title as the editor chains to a fresh Task, so the
  // capture loop stays keyboard-ready without a manual click. (The initial open
  // focus is handled by the popover's `initialFocus`.)
  useEffect(() => {
    const frame = requestAnimationFrame(() => titleRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [task.id]);

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
    <Popover
      onOpenChange={(next, eventDetails) => {
        if (next) return;

        // The editor is mounted by this trigger press. Base UI can observe the
        // tail of that same press as an outside interaction after the controlled
        // Popover mounts and immediately close it again.
        const eventTarget = eventDetails.event.target;
        if (
          eventDetails.reason === "outside-press" &&
          eventTarget instanceof Element &&
          eventTarget.closest("[data-template-task-trigger]")
        ) {
          eventDetails.cancel();
          return;
        }

        onClose();
      }}
      open
    >
      {/* Full-cell anchor: the editor opens to the side of the column the Task
          lives in (Google-Calendar style). base-ui flips to the opposite side
          when there isn't room. */}
      <PopoverTrigger className="pointer-events-none absolute inset-0" tabIndex={-1} />
      <PopoverContent
        align="start"
        className="w-80 gap-0 p-0"
        // Land the cursor in the title rather than the first property row, so the
        // capture loop is keyboard-ready the instant the editor opens.
        initialFocus={titleRef}
        side="inline-end"
        sideOffset={8}
      >
        <div className="flex items-start gap-1 px-3 pt-3 pb-1">
          <Input
            autoComplete="off"
            className="h-9 flex-1 border-transparent bg-transparent px-0 font-medium text-base shadow-none focus-visible:border-transparent focus-visible:ring-0"
            data-1p-ignore="true"
            onChange={(event) => onChange({ title: event.currentTarget.value })}
            onKeyDown={(event) => {
              if (event.metaKey || event.ctrlKey || event.altKey) return;
              const input = event.currentTarget;
              const caretAtEnd =
                input.selectionStart === input.value.length &&
                input.selectionEnd === input.value.length;
              // Enter commits and chains a fresh Task (the template capture
              // loop). ArrowDown — and ArrowRight once the caret sits at the end
              // of the title — cross the seam into the description, so the two
              // fields read as one surface (Linear).
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!task.title.trim()) return;
                onCommitAndChain();
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                focusDescriptionStart();
              } else if (event.key === "ArrowRight" && caretAtEnd) {
                event.preventDefault();
                focusDescriptionStart();
              }
            }}
            placeholder="Add task title"
            ref={titleRef}
            value={task.title}
          />
          <Button
            aria-label="Remove Template Task"
            className="mt-0.5 text-muted-foreground"
            onClick={onRemove}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Trash2 />
          </Button>
        </div>

        {/* Keep the scroll container flush with the popover edges (no horizontal
          padding here) and move the inset onto the editable content via
          `contentClassName`, so the `@` chip's focus ring isn't clipped while
          the text still lines up with the title above. */}
        <div className="max-h-40 min-h-0 overflow-y-auto pb-2">
          <DescriptionEditor
            key={task.id}
            ariaLabel="Add description"
            contentClassName="px-3"
            focusHandleRef={descriptionFocusRef}
            // Climb back into the title from the start of the description, so
            // the two fields read as one surface (Linear).
            onEscapeStart={focusTitleEnd}
            onChange={(value) => onChange({ description: serializeDescriptionValue(value) ?? "" })}
            placeholder="Add a description…"
            value={initialDescriptionValue}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t px-3 py-2.5">
          <TeamComboboxSelector
            memberTeamIds={memberTeamIds}
            onValueChange={changeTeam}
            options={teamPickerOptions}
            trigger={<TaskTeamPillTrigger team={selectedTeam} />}
            value={task.teamId || null}
          />

          <AssigneeComboboxSelector
            align="start"
            currentUserId={currentUserId}
            onValueChange={(next) => onChange({ assigneeId: next })}
            options={assigneeOptions}
            teamMemberIds={teamMemberUserIds}
            trigger={<TaskAssigneePillTrigger assignee={selectedAssignee} />}
            value={task.assigneeId}
          />

          <EstimateComboboxSelector
            onValueChange={(next) => onChange({ estimate: next })}
            trigger={<TaskEstimatePillTrigger value={task.estimate} />}
            value={task.estimate}
          />

          <PriorityComboboxSelector
            onValueChange={(next) => onChange({ priority: next })}
            trigger={<TaskPriorityPillTrigger value={task.priority} />}
            value={task.priority}
          />

          <LabelsComboboxSelector
            onValueChange={(next) => onChange({ labelIds: next })}
            options={labelOptions}
            trigger={<TaskLabelsPillTrigger labels={selectedLabels} showEmptyIcon={false} />}
            value={task.labelIds}
          />
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
          <span className="text-[11px] text-muted-foreground">
            <kbd className="rounded border bg-muted px-1 font-sans text-[10px]">Enter</kbd> adds
            another
          </span>
          <Button onClick={onClose} size="sm" type="button">
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
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
