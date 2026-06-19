import { CalendarDays, Check, Layers, Plus, Repeat, Trash2, Triangle } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useLabelsCollection, type LabelItem } from "@/data/labels/labelsData.app";
import {
  useTeamMembershipsCollection,
  useTeamsCollection,
  type TeamCollectionItem,
} from "@/data/teams/teamsData.app";
import { getUserDisplayName, useChurchUsersCollection } from "@/data/users/usersData.app";
import { useCreateWeeklyServiceTemplate } from "@/data/templates/templatesData.app";
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
  readonly placementWeekday: number;
};

const ESTIMATE_TO_KEY: Record<TaskEstimate, string | null> = {
  no_estimate: null,
  xs: "xs",
  s: "s",
  m: "m",
  l: "l",
  xl: "xl",
};

const newDraftTask = (placementWeekday: number, teamId: string): DraftTask => ({
  assigneeId: null,
  description: "",
  estimate: "no_estimate",
  id: crypto.randomUUID(),
  labelIds: [],
  placementWeekday,
  teamId,
  title: "",
});

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

  const teamsCollection = teams.teamsCollection;
  const defaultTeamId = teamsCollection[0]?.id ?? "";

  const [name, setName] = useState("Weekly Service");
  const [serviceWeekday, setServiceWeekday] = useState(0); // Sunday default
  const [schedule, setSchedule] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tasks, setTasks] = useState<readonly DraftTask[]>([]);

  const startDate = useMemo(() => nextWeekdayDate(serviceWeekday), [serviceWeekday]);

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
    const result = await createTemplate({
      churchId,
      key: slugify(name),
      name: name.trim() || "Weekly Service",
      schedule,
      serviceWeekday,
      startDate,
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
        <h1 className="font-semibold text-2xl tracking-tight">New weekly service Template</h1>
        <p className="max-w-2xl text-muted-foreground text-sm">
          Author a reusable weekly service Template, place its Template Tasks across a Monday–Sunday
          Cycle, and schedule it to project work into upcoming Weeks.
        </p>
      </header>

      <ShapeStep
        name={name}
        onNameChange={(next) => {
          setSaved(false);
          setName(next);
        }}
      />

      <ScheduleStep
        onWeekdayChange={(next) => {
          setSaved(false);
          setServiceWeekday(next);
        }}
        serviceWeekday={serviceWeekday}
        startDate={startDate}
      />

      <CycleCalendarStep
        addTask={addTask}
        assigneeOptions={assigneeOptions}
        churchLabels={labels.labelsCollection}
        currentUserId={currentUserId}
        loading={dataLoading}
        memberTeamIds={memberTeamIds}
        memberships={memberships.teamMembershipsCollection}
        removeTask={removeTask}
        serviceWeekday={serviceWeekday}
        tasks={tasks}
        teamPickerOptions={teamPickerOptions}
        teams={teamsCollection}
        updateTask={updateTask}
      />

      <SaveStep
        canSave={Boolean(churchId) && placedCount > 0}
        error={error}
        onSave={save}
        onScheduleChange={(next) => {
          setSaved(false);
          setSchedule(next);
        }}
        placedCount={placedCount}
        saved={saved}
        saving={saving}
        schedule={schedule}
        serviceWeekday={serviceWeekday}
        startDate={startDate}
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
    key: "key_date",
    label: "Key Date",
    description: "Anchored to a named Church date",
    available: false,
  },
  {
    key: "monthly",
    label: "Monthly",
    description: "Recurs every month",
    available: false,
  },
  {
    key: "yearly",
    label: "Yearly",
    description: "Recurs once a year",
    available: false,
  },
] as const;

function ShapeStep({
  name,
  onNameChange,
}: {
  readonly name: string;
  readonly onNameChange: (next: string) => void;
}) {
  return (
    <StepSection
      description="Choose the authoring frame. Weekly service is the first supported shape."
      step={1}
      title="Template shape"
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SHAPES.map((shape) => (
            <button
              aria-current={shape.available ? "true" : undefined}
              aria-disabled={!shape.available}
              aria-label={`${shape.label} Template shape${shape.available ? " selected" : " coming soon"}`}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
                shape.available
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "cursor-not-allowed border-dashed text-muted-foreground opacity-70",
              )}
              disabled={!shape.available}
              key={shape.key}
              type="button"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm text-foreground">{shape.label}</span>
                {shape.available ? (
                  <span className="inline-flex items-center gap-1 font-medium text-[10px] text-primary uppercase tracking-wide">
                    <Check className="size-3.5" />
                    Selected
                  </span>
                ) : (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    Soon
                  </span>
                )}
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

type AssigneeOption = { readonly id: string; readonly label: string };

function CycleCalendarStep({
  tasks,
  teams,
  teamPickerOptions,
  memberTeamIds,
  assigneeOptions,
  churchLabels,
  memberships,
  currentUserId,
  serviceWeekday,
  loading,
  addTask,
  updateTask,
  removeTask,
}: {
  readonly tasks: readonly DraftTask[];
  readonly teams: readonly TeamCollectionItem[];
  readonly teamPickerOptions: readonly { id: string; name: string; color: string | null }[];
  readonly memberTeamIds: ReadonlySet<string>;
  readonly assigneeOptions: readonly AssigneeOption[];
  readonly churchLabels: readonly LabelItem[];
  readonly memberships: readonly { teamId: string; userId: string }[];
  readonly currentUserId: string | null;
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
      ) : teams.length === 0 ? (
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
                      assigneeOptions={assigneeOptions}
                      churchLabels={churchLabels}
                      currentUserId={currentUserId}
                      key={task.id}
                      memberTeamIds={memberTeamIds}
                      memberships={memberships}
                      onChange={(patch) => updateTask(task.id, patch)}
                      onRemove={() => removeTask(task.id)}
                      task={task}
                      teamPickerOptions={teamPickerOptions}
                      teams={teams}
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
  teams,
  teamPickerOptions,
  memberTeamIds,
  assigneeOptions,
  churchLabels,
  memberships,
  currentUserId,
  onChange,
  onRemove,
}: {
  readonly task: DraftTask;
  readonly teams: readonly TeamCollectionItem[];
  readonly teamPickerOptions: readonly { id: string; name: string; color: string | null }[];
  readonly memberTeamIds: ReadonlySet<string>;
  readonly assigneeOptions: readonly AssigneeOption[];
  readonly churchLabels: readonly LabelItem[];
  readonly memberships: readonly { teamId: string; userId: string }[];
  readonly currentUserId: string | null;
  readonly onChange: (patch: Partial<DraftTask>) => void;
  readonly onRemove: () => void;
}) {
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
      </div>
    </div>
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
  serviceWeekday,
  startDate,
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
  readonly serviceWeekday: number;
  readonly startDate: string;
  readonly placedCount: number;
  readonly schedule: boolean;
  readonly saving: boolean;
  readonly saved: boolean;
  readonly canSave: boolean;
  readonly error: string | null;
  readonly onScheduleChange: (next: boolean) => void;
  readonly onSave: () => void;
}) {
  return (
    <StepSection
      description="Confirm how the Template projects into Weeks, then save."
      step={4}
      title="Preview and save"
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-sm">{templateName.trim() || "Weekly Service"}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                Weekly service
              </span>
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <PreviewRow label="Service day" value={WEEKDAY_NAMES[serviceWeekday]} />
              <PreviewRow label="Template Tasks" value={`${placedCount} placed`} />
              <PreviewRow label="First service" value={formatLongDate(startDate)} />
              <PreviewRow
                label="Projection"
                value={schedule ? "Repeats every week" : "Saved, not scheduled"}
              />
            </dl>
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
          <span className="flex items-start gap-2.5">
            <Repeat className="mt-0.5 size-4 text-muted-foreground" />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium text-sm">Repeating weekly Template Schedule</span>
              <span className="text-muted-foreground text-xs">
                Project this Template into every upcoming Week on {WEEKDAY_NAMES[serviceWeekday]}.
              </span>
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
                ? `Template saved and scheduled for ${WEEKDAY_NAMES[serviceWeekday]}s.`
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
