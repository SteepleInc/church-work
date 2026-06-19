import type { KeyDateRule } from "@church-task/domain";
import {
  CalendarDays,
  CalendarHeart,
  Check,
  ChevronsUpDown,
  Layers,
  Plus,
  Repeat,
  Sparkles,
  Trash2,
  Triangle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

type TemplateShape = "weekly_service" | "key_date";

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
          {shape === "key_date" ? "New Key Date Template" : "New weekly service Template"}
        </h1>
        <p className="max-w-2xl text-muted-foreground text-sm">
          {shape === "key_date"
            ? "Anchor a reusable Template to a named Church Key Date, place its Template Tasks around the occurrence, and schedule it to project work into the right Week each year."
            : "Author a reusable weekly service Template, place its Template Tasks across a Monday–Sunday Cycle, and schedule it to project work into upcoming Weeks."}
        </p>
      </header>

      <ShapeStep onSelect={setShape} shape={shape} />

      {shape === "key_date" ? <KeyDateAuthoring /> : <WeeklyServiceAuthoring />}
    </div>
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
function WeeklyServiceAuthoring() {
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
      <NameStep
        description="Name this Template so it's easy to find in the library and Schedules."
        label="Weekly service Template name"
        name={name}
        onNameChange={(next) => {
          setSaved(false);
          setName(next);
        }}
        placeholder="Weekly Service"
        step={1}
      />

      <ScheduleStep
        onWeekdayChange={(next) => {
          setSaved(false);
          setServiceWeekday(next);
        }}
        serviceWeekday={serviceWeekday}
        startDate={startDate}
        step={2}
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
        step={3}
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
        step={4}
        templateName={name}
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
function KeyDateAuthoring() {
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

  return (
    <div className="flex flex-col gap-8">
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
                    <span className="inline-flex w-fit items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary uppercase tracking-wide">
                      <CalendarHeart className="size-3" />
                      {selectedKeyDate.name}
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

type AssigneeOption = { readonly id: string; readonly label: string };

function CycleCalendarStep({
  step,
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
  readonly step: number;
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
      step={step}
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

// --- Weekly: Step 4: Preview and save --------------------------------------

function SaveStep({
  step,
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
  readonly step: number;
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
      step={step}
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
