import { useHotkey } from "@tanstack/react-hotkeys";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { revalidateLogic } from "@tanstack/react-form";
import { Schema } from "effect";
import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  BookmarkPlus,
  CalendarDays,
  ChevronRight,
  ListTree,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { TeamAvatar } from "@/components/avatars/teamAvatar";
import { useOpenTaskDetailsPaneUrl } from "@/components/details-pane/details-pane-helpers";
import {
  DescriptionEditor,
  type DescriptionEditorHandle,
} from "@/components/editor/description-editor";
import {
  parseDescriptionValue,
  serializeDescriptionValue,
} from "@/components/editor/description-value";
import { useAppForm } from "@/components/form/ts-form";
import { DraftTaskPropertySurface } from "@/components/tasks/draft-task-property-surface";
import {
  AssigneeComboboxSelector,
  DueDateSelector,
  EstimateComboboxSelector,
  LabelsComboboxSelector,
  PriorityComboboxSelector,
  StatusComboboxSelector,
  TaskAssigneePillTrigger,
  TaskDueDatePillTrigger,
  TaskEstimatePillTrigger,
  TaskLabelsPillTrigger,
  TaskPropertyPill,
  TaskPriorityPillTrigger,
  TaskStatusPillTrigger,
  TeamComboboxSelector,
  type TaskEstimate,
  type TaskPriority,
} from "@/components/tasks/task-card-fields";
import { statusOptions } from "@/components/tasks/task-kanban-board-utils";
import {
  resolveExecutionCycleScope,
  type WeekShortcut,
} from "@/components/tasks/task-execution-surface-utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DiscardChangesDialog } from "@/components/ui/discard-changes-dialog";
import { Kbd } from "@/components/ui/kbd";
import { Switch } from "@/components/ui/switch";
import { buildProjectedWeekCycles } from "@/components/weeks/team-weeks-index-data";
import { formatWeekDateRange, useCyclesCollection } from "@/data/cycles/cyclesData.app";
import { useCreateLabelMutation, useLabelsCollection } from "@/data/labels/labelsData.app";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useCreateTaskMutation, useSaveTaskDraftMutation } from "@/data/tasks/tasksData.app";
import { useTeamMembershipsCollection, useTeamsCollection } from "@/data/teams/teamsData.app";
import { getUserDisplayName, useChurchUsersCollection } from "@/data/users/usersData.app";
import {
  useWorkflowStatusesCollection,
  useWorkflowsCollection,
} from "@/data/workflows/workflowsData.app";
import {
  QuickActionForm,
  QuickActionsHeader,
  QuickActionsTitle,
  QuickActionsWrapper,
} from "@/features/quick-actions/quick-actions-components";

export type CreateTaskQuickActionState = {
  readonly assignTo: string | null;
  // Preset Workflow Status when created from a Board Column's "+" button.
  readonly workflowStatusId?: string | null;
  // Preset Team: a Team Board presets its Team; subtask openers preset the
  // parent Task's Team (ADR 0013).
  readonly teamId?: string | null;
  // Creating a subtask: openers pass the parent Task plus its Team preset.
  readonly parentTaskId?: string | null;
  readonly parentTaskLabel?: {
    readonly identifier: string;
    readonly title: string;
  } | null;
  readonly title?: string;
  readonly description?: string;
  readonly priority?: TaskPriority;
  readonly estimate?: TaskEstimate;
  readonly labelIds?: readonly string[];
  readonly dueDate?: string | null;
  readonly targetCycle?: {
    readonly churchTimeZone: string;
    readonly startDate: string;
    readonly endDate: string;
    readonly startsAt: string;
    readonly endsAt: string;
  };
} | null;

export const createTaskQuickActionStateAtom = atom<CreateTaskQuickActionState>(null);

export const pristineEmptyTaskComposerDefaults = {
  assignedUserId: null as string | null,
  description: "",
  dueDate: null as string | null,
  estimate: "no_estimate" as TaskEstimate,
  labels: [] as readonly string[],
  priority: "no_priority" as TaskPriority,
  teamId: null as string | null,
  title: "",
  workflowStatusId: "",
};

// Linear-style dialog chrome preferences, remembered across opens.
const createTaskDialogExpandedAtom = atomWithStorage<boolean>(
  "church-work:create-task-expanded",
  false,
);
const createTaskCreateMoreAtom = atomWithStorage<boolean>(
  "church-work:create-task-create-more",
  false,
);

const CreateTaskSchema = Schema.Struct({
  title: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1, { message: "Enter a Task title." })),
  ),
  description: Schema.String,
  assignedUserId: Schema.NullOr(Schema.String),
  workflowStatusId: Schema.String,
  teamId: Schema.NullOr(Schema.String),
  dueDate: Schema.NullOr(Schema.String),
  priority: Schema.Literals(["no_priority", "urgent", "high", "medium", "low"]),
  estimate: Schema.Literals(["no_estimate", "xs", "s", "m", "l", "xl"]),
  // Label ids; persisted on the created Task.
  labels: Schema.Array(Schema.String),
});

const hasTaskDraftContent = (value: typeof pristineEmptyTaskComposerDefaults) =>
  value.title.trim().length > 0 ||
  value.description.trim().length > 0 ||
  value.assignedUserId !== pristineEmptyTaskComposerDefaults.assignedUserId ||
  value.workflowStatusId !== pristineEmptyTaskComposerDefaults.workflowStatusId ||
  value.teamId !== pristineEmptyTaskComposerDefaults.teamId ||
  value.priority !== pristineEmptyTaskComposerDefaults.priority ||
  value.estimate !== pristineEmptyTaskComposerDefaults.estimate ||
  value.labels.length > 0 ||
  value.dueDate !== pristineEmptyTaskComposerDefaults.dueDate;

/**
 * A compact, read-only cue that this Task will attach to the Week currently in
 * view (its Cycle is materialized on create if it is still a Projected Week).
 * It mirrors the date range shown on the Week board header so a User reading
 * the dialog never wonders "which Week does this land in?".
 */
function TargetWeekPill({
  targetCycle,
}: {
  readonly targetCycle: NonNullable<CreateTaskQuickActionState>["targetCycle"];
}) {
  if (!targetCycle) return null;
  const dateRange = formatWeekDateRange(targetCycle);
  return (
    <span
      aria-label={`This Task will be added to the Week of ${dateRange}.`}
      className="inline-flex h-7 items-center gap-1.5 rounded-md bg-muted px-2 text-xs font-medium text-muted-foreground"
    >
      <CalendarDays aria-hidden className="size-3.5" />
      <span className="hidden sm:inline">Week of </span>
      {dateRange}
    </span>
  );
}

function ParentTaskPill({
  parentTaskLabel,
}: {
  readonly parentTaskLabel: NonNullable<CreateTaskQuickActionState>["parentTaskLabel"];
}) {
  if (!parentTaskLabel) return null;
  return (
    <span
      aria-label={`Subtask of ${parentTaskLabel.identifier} ${parentTaskLabel.title}`}
      className="inline-flex h-7 max-w-56 items-center gap-1.5 rounded-md bg-muted px-2 text-xs font-medium text-muted-foreground"
      title={`${parentTaskLabel.identifier} ${parentTaskLabel.title}`}
    >
      <ListTree aria-hidden className="size-3.5 shrink-0" />
      <span className="shrink-0">{parentTaskLabel.identifier}</span>
      <span className="truncate text-muted-foreground/80">{parentTaskLabel.title}</span>
    </span>
  );
}

export function CreateTaskQuickAction() {
  const [state, setState] = useAtom(createTaskQuickActionStateAtom);
  const isCreatingSubtask = Boolean(state?.parentTaskLabel);
  const search = useSearch({ strict: false }) as { readonly week?: WeekShortcut };
  const [expanded, setExpanded] = useAtom(createTaskDialogExpandedAtom);
  const [createMore, setCreateMore] = useAtom(createTaskCreateMoreAtom);
  const [error, setError] = useState<string | null>(null);
  // Drives the "Discard changes?" confirmation. We only raise it when the form
  // is dirty; a pristine dialog closes immediately without nagging.
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  // True while a "Save to drafts" save is in flight (from either the header
  // affordance or the close prompt). Drives the spinner on both Save controls
  // and guards against a double save.
  const [savingDraft, setSavingDraft] = useState(false);
  const navigate = useNavigate();
  const openTaskDetailsPaneUrl = useOpenTaskDetailsPaneUrl();
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const createTask = useCreateTaskMutation();
  const saveTaskDraft = useSaveTaskDraftMutation();

  const churchId = activeChurch?.id ?? null;
  const currentUserId = activeChurch?.currentUserId ?? null;
  const workflows = useWorkflowsCollection({ churchId });
  const workflowStatusesCollection = useWorkflowStatusesCollection({ churchId });
  const usersCollection = useChurchUsersCollection({ churchId });
  const teamsCollection = useTeamsCollection({ churchId });
  const teamMemberships = useTeamMembershipsCollection({ churchId });
  const labelsCollection = useLabelsCollection({ churchId });
  const cyclesCollection = useCyclesCollection({ churchId, currentUserId });
  const createLabel = useCreateLabelMutation();

  const today = new Date().toISOString().slice(0, 10);
  const routeTargetCycle = useMemo(() => {
    if (!search.week || typeof window === "undefined") return undefined;
    if (!window.location.pathname.startsWith("/team/")) return undefined;

    const cycle = resolveExecutionCycleScope({
      surface: "team_board",
      week: search.week,
      cycles: buildProjectedWeekCycles({
        churchTimeZone: activeChurch?.churchTimeZone ?? "UTC",
        cycles: cyclesCollection.cyclesCollection,
        today,
      }),
      today,
    });
    return cycle?.targetCycle;
  }, [activeChurch?.churchTimeZone, cyclesCollection.cyclesCollection, search.week, today]);
  const effectiveTargetCycle = state?.targetCycle ?? routeTargetCycle;

  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLDivElement>(null);
  // Imperative handle for the description editor so the title can hand focus
  // down with the caret at the top (a plain `.focus()` would restore the last
  // caret), making the title↔description seam read as one surface (Linear).
  const descriptionFocusRef = useRef<DescriptionEditorHandle>(null);
  // Move focus from the title down into the description, caret at the top.
  const focusDescriptionStart = () => {
    const handle = descriptionFocusRef.current;
    if (handle) {
      handle.focusStart();
    } else {
      descriptionInputRef.current?.focus();
    }
  };
  // Move focus from the description back up into the title, caret at the end.
  const focusTitleEnd = () => {
    const input = titleInputRef.current;
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  };
  // Holds the serialized description the uncontrolled editor should mount with.
  // Set synchronously (before bumping `editorResetKey`) so a remount reads the
  // intended value even if the form store hasn't flushed yet — e.g. a prefill
  // from "create Task from Comment".
  const nextDescriptionRef = useRef("");
  // "open" = save and open the created Task (Cmd+Alt+Enter).
  const submitModeRef = useRef<"default" | "open">("default");

  // Picker openers for dialog-level keyboard shortcuts (T/S/A/P/⇧E/L/D).
  const teamOpenRef = useRef<(() => void) | null>(null);
  const statusOpenRef = useRef<(() => void) | null>(null);
  const assigneeOpenRef = useRef<(() => void) | null>(null);
  const priorityOpenRef = useRef<(() => void) | null>(null);
  const estimateOpenRef = useRef<(() => void) | null>(null);
  const labelsOpenRef = useRef<(() => void) | null>(null);
  const dueDateOpenRef = useRef<(() => void) | null>(null);

  const pickerRefs = useMemo(
    () => ({
      team: teamOpenRef,
      status: statusOpenRef,
      assignee: assigneeOpenRef,
      priority: priorityOpenRef,
      estimate: estimateOpenRef,
      labels: labelsOpenRef,
      dueDate: dueDateOpenRef,
    }),
    [],
  );

  const teams = teamsCollection.teamsCollection;
  const memberTeamIds = useMemo(
    () =>
      new Set(
        teamMemberships.teamMembershipsCollection
          .filter((membership) => membership.userId === currentUserId)
          .map((membership) => membership.teamId),
      ),
    [teamMemberships.teamMembershipsCollection, currentUserId],
  );
  const teamPickerOptions = useMemo(
    () =>
      teams.map((team) => ({
        id: team.id,
        name: team.name,
        color: (team.color ?? null) as string | null,
      })),
    [teams],
  );

  const workflowStatuses = workflowStatusesCollection.workflowStatusesCollection;
  const assigneeOptions = usersCollection.usersCollection.map((user) => ({
    id: user.id,
    label: getUserDisplayName(user),
  }));

  const isOpen = state !== null;
  const isLoading =
    workflows.loading ||
    workflowStatusesCollection.loading ||
    teamsCollection.loading ||
    teamMemberships.loading ||
    !activeChurch;
  const areUsersLoading = usersCollection.loading;
  const areLabelsLoading = labelsCollection.loading;

  const form = useAppForm({
    defaultValues: {
      title: state?.title ?? pristineEmptyTaskComposerDefaults.title,
      description: state?.description ?? pristineEmptyTaskComposerDefaults.description,
      assignedUserId: state?.assignTo ?? pristineEmptyTaskComposerDefaults.assignedUserId,
      // Empty string means "use the effective Workflow's default status".
      workflowStatusId:
        state?.workflowStatusId ?? pristineEmptyTaskComposerDefaults.workflowStatusId,
      // Null means "use the default Team" (preset → first of your teams →
      // first team). There is no "No team" choice in the picker.
      teamId: state?.teamId ?? pristineEmptyTaskComposerDefaults.teamId,
      priority: state?.priority ?? pristineEmptyTaskComposerDefaults.priority,
      estimate: state?.estimate ?? pristineEmptyTaskComposerDefaults.estimate,
      labels: state?.labelIds ?? pristineEmptyTaskComposerDefaults.labels,
      // Due Date is never auto-set; it stays empty until picked.
      // Baseline remains `dueDate: null as string | null`; comment-derived
      // task creation may explicitly prefill it from the source Task.
      dueDate: state?.dueDate ?? pristineEmptyTaskComposerDefaults.dueDate,
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onSubmit: Schema.toStandardSchemaV1(CreateTaskSchema),
    },
    onSubmit: async ({ value, formApi }) => {
      if (!activeChurch || !currentUserId || !churchId) return;

      const trimmedTitle = value.title.trim();
      if (!trimmedTitle) {
        setError("Enter a Task title.");
        return;
      }

      const submitTeamId = resolveTeamId(value.teamId);
      if (!submitTeamId) {
        setError("Select a Team.");
        return;
      }

      const submitWorkflowId = resolveWorkflowId(submitTeamId);
      const submitStatus = resolveStatus(value.workflowStatusId, submitWorkflowId);
      if (!submitStatus) {
        setError("Task could not find a To Do Workflow Status.");
        return;
      }

      // `description` holds serialized Plate JSON (or "" when the doc is empty).
      const serializedDescription = value.description;
      setError(null);
      const result = await createTask({
        churchId,
        actorUserId: currentUserId,
        title: trimmedTitle,
        description: serializedDescription === "" ? null : serializedDescription,
        teamId: submitTeamId,
        assignedUserId: value.assignedUserId,
        workflowStatusId: submitStatus.id,
        dueDate: value.dueDate,
        parentTaskId: state?.parentTaskId ?? null,
        labelIds: [...value.labels],
        estimate: value.estimate === "no_estimate" ? null : value.estimate,
        priority: value.priority === "no_priority" ? null : value.priority,
        ...(effectiveTargetCycle ? { targetCycle: effectiveTargetCycle } : {}),
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      // Task links carry the Task Identifier, not the database id (ADR 0013).
      const createdTaskIdentifier = result.data.tasks[0]?.identifier;
      const mode = submitModeRef.current;
      submitModeRef.current = "default";

      if (mode === "open" && createdTaskIdentifier) {
        formApi.reset();
        setState(null);
        const url = openTaskDetailsPaneUrl({ id: createdTaskIdentifier });
        void navigate({ to: url.to, search: url.search });
        return;
      }

      if (createMore) {
        // Keep the dialog open with every property as-is; only the text
        // resets, ready for the next Task in the batch. Clearing the text is a
        // programmatic reset, not a User edit, so it stays pristine and won't
        // trip the "Discard changes?" guard if the User then closes.
        formApi.setFieldValue("title", "", { dontUpdateMeta: true });
        formApi.setFieldValue("description", "", { dontUpdateMeta: true });
        // Remount the (uncontrolled) description editor so it clears too.
        nextDescriptionRef.current = "";
        setEditorResetKey((key) => key + 1);
        titleInputRef.current?.focus();
      } else {
        formApi.reset();
        nextDescriptionRef.current = "";
        setEditorResetKey((key) => key + 1);
        setState(null);
      }

      if (createdTaskIdentifier) {
        toast.success("Task created.", {
          action: {
            label: "Open Task",
            onClick: () => {
              const url = openTaskDetailsPaneUrl({ id: createdTaskIdentifier });
              void navigate({ to: url.to, search: url.search });
            },
          },
        });
      } else {
        toast.success("Task created.");
      }
    },
  });

  // The description editor is uncontrolled (reads its `value` on mount). Bump
  // this key to remount it after a reset so the contentEditable clears; the
  // memo re-parses the freshly-reset field value for the new instance.
  const [editorResetKey, setEditorResetKey] = useState(0);
  const initialDescriptionValue = useMemo(
    () => parseDescriptionValue(nextDescriptionRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editorResetKey],
  );

  // --- Effective Team / Workflow / Status resolution -------------------------
  // Pills hold "user-set" values; the effective value falls back through the
  // preset and the default Team so the dialog is valid the moment it opens.

  const resolveTeamId = (chosenTeamId: string | null): string | null => {
    if (chosenTeamId && teams.some((team) => team.id === chosenTeamId)) return chosenTeamId;
    if (state?.teamId && teams.some((team) => team.id === state.teamId)) return state.teamId;
    const yourTeam = teams.find((team) => memberTeamIds.has(team.id));
    return yourTeam?.id ?? teams[0]?.id ?? null;
  };

  const resolveWorkflowId = (teamId: string | null): string | null => {
    return (
      workflows.workflowsCollection.find(
        (workflow) => workflow.teamId === teamId && workflow.archivedAt === null,
      )?.id ?? null
    );
  };

  const resolveStatus = (chosenStatusId: string, workflowId: string | null) => {
    const inWorkflow = workflowStatuses.filter((status) => status.workflowId === workflowId);
    return (
      inWorkflow.find((status) => status.id === chosenStatusId) ??
      [...inWorkflow]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .find((status) => status.taskState === "todo") ??
      inWorkflow[0]
    );
  };

  const close = () => {
    setConfirmDiscardOpen(false);
    setSavingDraft(false);
    setState(null);
    setError(null);
    form.reset();
  };

  const saveDraftAndClose = async () => {
    // Guard against a double save (e.g. an impatient second click while the
    // first is still in flight).
    if (savingDraft) return;
    setSavingDraft(true);
    const value = form.state.values;
    if (!hasTaskDraftContent(value)) {
      setSavingDraft(false);
      close();
      return;
    }
    const result = await saveTaskDraft({
      assignedUserId: value.assignedUserId,
      description: value.description === "" ? null : value.description,
      dueDate: value.dueDate,
      estimate: value.estimate === "no_estimate" ? null : value.estimate,
      labelIds: [...value.labels],
      parentTaskId: state?.parentTaskId ?? null,
      priority: value.priority === "no_priority" ? null : value.priority,
      teamId: value.teamId,
      title: value.title.trim(),
      workflowStatusId: value.workflowStatusId || null,
    });
    if (!result.ok) {
      setSavingDraft(false);
      setError(result.error.message);
      return;
    }
    setSavingDraft(false);
    close();
  };

  // Closing with unsaved edits prompts before discarding; a pristine draft (or
  // one only carrying its prefilled values) closes straight away. Routes every
  // close affordance — the header X, Escape, and outside-click — through one
  // guard.
  const requestClose = () => {
    if (form.state.isDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    close();
  };

  useEffect(() => {
    if (!isOpen || !state) return;
    // Programmatic prefill on open, not a User edit: `dontUpdateMeta` keeps the
    // form pristine so a freshly-opened (or comment-prefilled) dialog closes
    // without falsely tripping the "Discard changes?" guard. Only the User's own
    // typing/picking marks the form dirty.
    const sync = { dontUpdateMeta: true } as const;
    form.setFieldValue("title", state.title ?? "", sync);
    form.setFieldValue("description", state.description ?? "", sync);
    form.setFieldValue("assignedUserId", state.assignTo ?? null, sync);
    form.setFieldValue("workflowStatusId", state.workflowStatusId ?? "", sync);
    form.setFieldValue("teamId", state.teamId ?? null, sync);
    form.setFieldValue("priority", state.priority ?? "no_priority", sync);
    form.setFieldValue("estimate", state.estimate ?? "no_estimate", sync);
    form.setFieldValue("labels", state.labelIds ?? [], sync);
    form.setFieldValue("dueDate", state.dueDate ?? null, sync);
    // The description editor is uncontrolled and reads its value only on mount.
    // Prefills (e.g. "create Task from Comment") set the field after the editor
    // has mounted, so stage the value and remount it to pick the prefill up.
    nextDescriptionRef.current = state.description ?? "";
    setEditorResetKey((key) => key + 1);
  }, [isOpen, state, form]);

  // Inline label creation from the picker. Always creates a Church-scoped
  // Label (see CONTEXT.md "Label"); on success the new Label joins the
  // selection.
  const handleCreateLabel = async (name: string) => {
    if (!churchId) return;
    const result = await createLabel({ churchId, name });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    const normalized = name.trim().toLowerCase();
    const created = result.data.labels.find(
      (label) => label.teamId === null && label.name.trim().toLowerCase() === normalized,
    );
    if (created) {
      form.setFieldValue("labels", [...form.state.values.labels, created.id]);
    }
  };

  const submit = (mode: "default" | "open") => {
    submitModeRef.current = mode;
    void form.handleSubmit();
  };

  // Cmd+Enter creates; Cmd+Alt+Enter creates and opens. These are Meta combos,
  // so they default to `ignoreInputs: false` and still fire while the user types
  // in the title or description. `enabled: isOpen` scopes them to the open
  // dialog. Property picker keys are handled by the shared hover-armed draft
  // Task surface below.
  useHotkey("Mod+Enter", () => submit("default"), {
    enabled: isOpen,
    preventDefault: true,
  });
  useHotkey("Mod+Alt+Enter", () => submit("open"), {
    enabled: isOpen,
    preventDefault: true,
  });

  return (
    <>
      <QuickActionsWrapper
        // Expand grows the dialog to its full available height (same width):
        // the wrapper already caps height via the viewport clamp, so expanding
        // just fills that cap instead of sizing to content.
        dialogContentClassName={
          expanded ? "h-[calc(100vh-clamp(16px,calc((100vh-512px)/2),192px)*2)]" : undefined
        }
        open={isOpen}
        onOpenChange={(open) => (open ? undefined : requestClose())}
      >
        <QuickActionsHeader className="p-4">
          <div className="flex items-center justify-between gap-2">
            <QuickActionsTitle>
              <span className="flex items-center gap-1.5 font-normal text-sm">
                <form.Subscribe selector={(formState) => formState.values.teamId}>
                  {(teamId) => {
                    const effectiveTeamId = resolveTeamId(teamId);
                    const effectiveTeam = teams.find((team) => team.id === effectiveTeamId);
                    return effectiveTeam ? (
                      <TeamComboboxSelector
                        disabled={isLoading}
                        memberTeamIds={memberTeamIds}
                        openRef={teamOpenRef}
                        onValueChange={(next) => {
                          form.setFieldValue("teamId", next);
                          // The new Team's Workflow takes over: the status pill
                          // resets to that Workflow's default.
                          form.setFieldValue("workflowStatusId", "");
                          // Team Labels foreign to the destination Team drop out
                          // of the selection (see CONTEXT.md "Team Label").
                          const applicable = new Set(
                            labelsCollection.labelsCollection
                              .filter((label) => label.teamId === null || label.teamId === next)
                              .map((label) => label.id),
                          );
                          form.setFieldValue(
                            "labels",
                            form.state.values.labels.filter((labelId) => applicable.has(labelId)),
                          );
                        }}
                        options={teamPickerOptions}
                        trigger={
                          <TaskPropertyPill className="gap-2">
                            <TeamAvatar
                              color={effectiveTeam.color}
                              name={effectiveTeam.name}
                              size={18}
                            />
                            <span className="max-w-32 truncate">{effectiveTeam.name}</span>
                          </TaskPropertyPill>
                        }
                        value={effectiveTeamId}
                      />
                    ) : null;
                  }}
                </form.Subscribe>
                <ChevronRight className="size-3.5 text-muted-foreground" />
                <span>{isCreatingSubtask ? "New Subtask" : "New Task"}</span>
                {state?.parentTaskLabel ? (
                  <ParentTaskPill parentTaskLabel={state.parentTaskLabel} />
                ) : null}
                {effectiveTargetCycle ? (
                  <TargetWeekPill targetCycle={effectiveTargetCycle} />
                ) : null}
              </span>
            </QuickActionsTitle>
            <div className="flex items-center gap-1">
              <form.Subscribe
                selector={(formState) => formState.isDirty && hasTaskDraftContent(formState.values)}
              >
                {(canSaveDraft) =>
                  canSaveDraft ? (
                    <Button
                      className="text-muted-foreground hover:text-foreground"
                      loading={savingDraft}
                      onClick={() => void saveDraftAndClose()}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Save as draft
                    </Button>
                  ) : null
                }
              </form.Subscribe>
              <Button
                aria-label={expanded ? "Collapse" : "Expand"}
                className="hidden text-muted-foreground md:inline-flex"
                onClick={() => setExpanded(!expanded)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
              <Button
                aria-label="Close"
                className="text-muted-foreground"
                onClick={requestClose}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </QuickActionsHeader>
        <QuickActionForm
          form={form}
          Body={
            // The body never scrolls: the title is always visible and the
            // description textarea grows with its content, then scrolls
            // internally once it runs out of room.
            <DraftTaskPropertySurface
              className="relative flex min-h-0 flex-col gap-2 overflow-hidden p-4"
              pickerRefs={pickerRefs}
            >
              <form.Field name="title">
                {(field) => (
                  <input
                    aria-label="Task title"
                    autoComplete="off"
                    autoFocus
                    className="w-full shrink-0 bg-transparent font-medium text-lg outline-none placeholder:text-muted-foreground"
                    data-1p-ignore="true"
                    disabled={isLoading}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.metaKey || event.ctrlKey || event.altKey) return;
                      const input = event.currentTarget;
                      const caretAtEnd =
                        input.selectionStart === input.value.length &&
                        input.selectionEnd === input.value.length;
                      // Enter and ArrowDown both drop into the description; the
                      // title and description read as one surface (Linear), so
                      // ArrowRight also crosses the seam once the caret is at the
                      // end of the title (Cmd+Enter still submits).
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        focusDescriptionStart();
                      } else if (event.key === "ArrowDown") {
                        event.preventDefault();
                        focusDescriptionStart();
                      } else if (event.key === "ArrowRight" && caretAtEnd) {
                        event.preventDefault();
                        focusDescriptionStart();
                      }
                    }}
                    placeholder="Task title"
                    ref={titleInputRef}
                    value={field.state.value}
                  />
                )}
              </form.Field>
              <form.Field name="description">
                {(field) => (
                  // Inset the editable content so the `@` chip's focus ring (and
                  // the mention popover anchored to it) isn't clipped by the
                  // surface's left edge, then pull the editor back by the same
                  // amount so the text still lines up with the title above.
                  <div className="-mx-4 min-h-20 w-full flex-1 overflow-y-auto">
                    <DescriptionEditor
                      key={editorResetKey}
                      ariaLabel="Add description"
                      contentClassName="px-4"
                      editorRef={descriptionInputRef}
                      focusHandleRef={descriptionFocusRef}
                      disabled={isLoading}
                      placeholder="Add description..."
                      value={initialDescriptionValue}
                      onChange={(value) =>
                        field.handleChange(serializeDescriptionValue(value) ?? "")
                      }
                      onEscapeStart={focusTitleEnd}
                    />
                  </div>
                )}
              </form.Field>
            </DraftTaskPropertySurface>
          }
          Pinned={
            // The property pill row stays visible above the footer while the
            // title/description body scrolls (Linear behavior).
            <div className="flex flex-col gap-3 px-4 pb-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <form.Subscribe
                  selector={(formState) =>
                    [formState.values.teamId, formState.values.workflowStatusId] as const
                  }
                >
                  {([teamId, workflowStatusId]) => {
                    const effectiveWorkflowId = resolveWorkflowId(resolveTeamId(teamId));
                    const options = statusOptions(
                      workflowStatuses.filter(
                        (status) => status.workflowId === effectiveWorkflowId,
                      ),
                    );
                    const effectiveStatus = resolveStatus(workflowStatusId, effectiveWorkflowId);
                    return (
                      <StatusComboboxSelector
                        disabled={isLoading || options.length === 0}
                        emptyText="No statuses."
                        onValueChange={(next) => {
                          if (next) form.setFieldValue("workflowStatusId", next);
                        }}
                        openRef={statusOpenRef}
                        options={options}
                        trigger={<TaskStatusPillTrigger status={effectiveStatus} />}
                        value={effectiveStatus?.id ?? null}
                      />
                    );
                  }}
                </form.Subscribe>
                <form.Field name="priority">
                  {(field) => {
                    return (
                      <PriorityComboboxSelector
                        disabled={isLoading}
                        onValueChange={(next) => field.handleChange(next)}
                        openRef={priorityOpenRef}
                        trigger={<TaskPriorityPillTrigger value={field.state.value} />}
                        value={field.state.value}
                      />
                    );
                  }}
                </form.Field>
                <form.Subscribe
                  selector={(formState) =>
                    [formState.values.teamId, formState.values.assignedUserId] as const
                  }
                >
                  {([teamId, assignedUserId]) => {
                    const selectedAssignee =
                      assigneeOptions.find((option) => option.id === assignedUserId) ?? null;
                    const effectiveTeamId = resolveTeamId(teamId);
                    // Members of the effective Team feed the picker's
                    // "Team members" section.
                    const teamMemberUserIds = new Set(
                      teamMemberships.teamMembershipsCollection
                        .filter((membership) => membership.teamId === effectiveTeamId)
                        .map((membership) => membership.userId),
                    );
                    return (
                      <AssigneeComboboxSelector
                        align="start"
                        currentUserId={currentUserId}
                        disabled={isLoading || areUsersLoading}
                        onValueChange={(next) => form.setFieldValue("assignedUserId", next)}
                        openRef={assigneeOpenRef}
                        options={assigneeOptions}
                        teamMemberIds={teamMemberUserIds}
                        trigger={<TaskAssigneePillTrigger assignee={selectedAssignee} />}
                        value={assignedUserId}
                      />
                    );
                  }}
                </form.Subscribe>
                <form.Field name="estimate">
                  {(field) => {
                    return (
                      <EstimateComboboxSelector
                        disabled={isLoading}
                        onValueChange={(next) => field.handleChange(next)}
                        openRef={estimateOpenRef}
                        trigger={<TaskEstimatePillTrigger value={field.state.value} />}
                        value={field.state.value}
                      />
                    );
                  }}
                </form.Field>
                <form.Subscribe
                  selector={(formState) =>
                    [formState.values.teamId, formState.values.labels] as const
                  }
                >
                  {([teamId, labels]) => {
                    const effectiveTeamId = resolveTeamId(teamId);
                    // Church Labels plus the effective Team's Labels are
                    // applicable (see CONTEXT.md "Team Label").
                    const labelOptions = labelsCollection.labelsCollection.filter(
                      (label) => label.teamId === null || label.teamId === effectiveTeamId,
                    );
                    const selected = labels
                      .map((labelId) => labelOptions.find((option) => option.id === labelId))
                      .filter((option) => option !== undefined);
                    return (
                      <LabelsComboboxSelector
                        disabled={isLoading || areLabelsLoading}
                        onCreateLabel={(name) => void handleCreateLabel(name)}
                        onValueChange={(next) => form.setFieldValue("labels", next)}
                        openRef={labelsOpenRef}
                        options={labelOptions}
                        trigger={<TaskLabelsPillTrigger labels={selected} />}
                        value={labels}
                      />
                    );
                  }}
                </form.Subscribe>
                <form.Field name="dueDate">
                  {(field) => {
                    return (
                      <DueDateSelector
                        disabled={isLoading}
                        onValueChange={(next) => field.handleChange(next)}
                        openRef={dueDateOpenRef}
                        trigger={<TaskDueDatePillTrigger value={field.state.value} />}
                        value={field.state.value}
                      />
                    );
                  }}
                </form.Field>
              </div>
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          }
          Actions={
            <>
              <label className="flex cursor-pointer items-center gap-2 ps-2 text-muted-foreground text-sm">
                <Switch checked={createMore} onCheckedChange={setCreateMore} size="sm" />
                Create more
              </label>
              <form.Subscribe selector={(formState) => formState.isSubmitting}>
                {(isSubmitting) => (
                  <Button
                    className="ml-auto"
                    disabled={isLoading}
                    loading={isSubmitting}
                    onClick={(event) => {
                      event.preventDefault();
                      submit("default");
                    }}
                    type="submit"
                  >
                    {isCreatingSubtask ? "Create Subtask" : "Create Task"}
                    <Kbd>mod enter</Kbd>
                  </Button>
                )}
              </form.Subscribe>
            </>
          }
        />
      </QuickActionsWrapper>
      {/* Rendered as a sibling of the quick action Dialog — not a child — so
          base-ui does not treat it as a nested dialog. A nested dialog
          suppresses its own backdrop and offsets its popup; kept top-level, the
          confirmation centers and lays its own backdrop over the quick action. */}
      <DiscardChangesDialog
        cancelLabel="Cancel"
        description="You can finish this task later from your drafts."
        discardLabel="Discard"
        media={<BookmarkPlus />}
        onDiscard={close}
        onSave={() => void saveDraftAndClose()}
        onOpenChange={setConfirmDiscardOpen}
        open={confirmDiscardOpen}
        saveLabel="Save"
        saveLoading={savingDraft}
        title="Save to drafts?"
      />
    </>
  );
}
