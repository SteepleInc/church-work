import { CalendarDays, CalendarIcon, Tag, Triangle } from "lucide-react";
import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { toast } from "sonner";

import { TeamAvatar } from "@/components/avatars/teamAvatar";
import {
  AssigneeAvatar,
  AssigneeComboboxSelector,
  DueDateSelector,
  EstimateComboboxSelector,
  formatDueDate,
  getEstimateMeta,
  getPriorityMeta,
  labelDotClassName,
  LabelsComboboxSelector,
  PriorityComboboxSelector,
  TeamComboboxSelector,
  type TaskEstimate,
  type TaskPriority,
} from "@/components/tasks/task-card-fields";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Maximum number of sub-tasks created from one multi-line paste. */
const MAX_PASTE_SUB_TASKS = 50;

export type SubTaskCreatorDefaults = {
  readonly assignedUserId: string | null;
  readonly teamId: string;
  readonly priority: TaskPriority;
};

export type SubTaskCreateInput = {
  readonly title: string;
  readonly description: string | null;
  readonly assignedUserId: string | null;
  readonly teamId: string;
  readonly priority: TaskPriority;
  readonly estimate: TaskEstimate;
  readonly labelIds: readonly string[];
  readonly dueDate: string | null;
};

type CreatorState = {
  readonly title: string;
  readonly description: string;
  readonly assignedUserId: string | null;
  readonly teamId: string;
  readonly priority: TaskPriority;
  readonly estimate: TaskEstimate;
  readonly labelIds: readonly string[];
  readonly dueDate: string | null;
  // Tracks which property pills the user has edited, so changing parent
  // defaults while the creator is open only updates untouched pills.
  readonly touched: ReadonlySet<keyof SubTaskCreatorDefaults>;
};

function initialState(defaults: SubTaskCreatorDefaults): CreatorState {
  return {
    title: "",
    description: "",
    assignedUserId: defaults.assignedUserId,
    teamId: defaults.teamId,
    priority: defaults.priority,
    estimate: "no_estimate",
    labelIds: [],
    dueDate: null,
    touched: new Set(),
  };
}

/**
 * Inline sub-task creation card shown in the Task details pane's Sub-tasks
 * section. It pre-fills inherited defaults (Assignee, Team, Priority) silently,
 * supports multi-line paste to create many at once, and stays open after
 * Create with the form reset for rapid entry (see grilling decisions).
 */
export function SubTaskCreator({
  defaults,
  assigneeOptions,
  currentUserId,
  teamMemberIds,
  teamOptions,
  memberTeamIds,
  labelOptions,
  labelAppliesToTeam,
  weekLabel,
  disabled = false,
  onCreate,
  onCreateMany,
  onClose,
  onCreateLabel,
}: {
  readonly defaults: SubTaskCreatorDefaults;
  readonly assigneeOptions: readonly { readonly id: string; readonly label: string }[];
  readonly currentUserId: string | null;
  readonly teamMemberIds: ReadonlySet<string>;
  readonly teamOptions: readonly {
    readonly id: string;
    readonly name: string;
    readonly color: string | null;
  }[];
  readonly memberTeamIds: ReadonlySet<string>;
  readonly labelOptions: readonly {
    readonly id: string;
    readonly name: string;
    readonly color: string;
  }[];
  /** True when a Label (by id) applies to the given Team (Church-wide or that Team's). */
  readonly labelAppliesToTeam: (labelId: string, teamId: string) => boolean;
  readonly weekLabel: string | null;
  readonly disabled?: boolean;
  readonly onCreate: (input: SubTaskCreateInput) => Promise<boolean>;
  readonly onCreateMany: (inputs: readonly SubTaskCreateInput[]) => Promise<boolean>;
  readonly onClose: () => void;
  readonly onCreateLabel?: (name: string) => Promise<string | null>;
}) {
  const [state, setState] = useState<CreatorState>(() => initialState(defaults));
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Keep untouched property pills in sync with changing parent defaults; never
  // overwrite a pill the user has set (grilling decision).
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      assignedUserId: prev.touched.has("assignedUserId")
        ? prev.assignedUserId
        : defaults.assignedUserId,
      teamId: prev.touched.has("teamId") ? prev.teamId : defaults.teamId,
      priority: prev.touched.has("priority") ? prev.priority : defaults.priority,
    }));
  }, [defaults.assignedUserId, defaults.teamId, defaults.priority]);

  const markTouched = (field: keyof SubTaskCreatorDefaults) =>
    setState((prev) => {
      const touched = new Set(prev.touched);
      touched.add(field);
      return { ...prev, touched };
    });

  const buildInput = (title: string): SubTaskCreateInput => ({
    title,
    description: state.description.trim() === "" ? null : state.description.trim(),
    assignedUserId: state.assignedUserId,
    teamId: state.teamId,
    priority: state.priority,
    estimate: state.estimate,
    labelIds: state.labelIds,
    dueDate: state.dueDate,
  });

  const resetAfterCreate = (preserveProperties: boolean) =>
    setState((prev) =>
      preserveProperties
        ? { ...prev, title: "", description: "" }
        : {
            ...initialState(defaults),
            // Preserve nothing on a plain create; defaults re-apply.
          },
    );

  const submit = async (preserveProperties: boolean) => {
    const trimmed = state.title.trim();
    if (trimmed === "") return;
    const ok = await onCreate(buildInput(trimmed));
    if (ok) {
      resetAfterCreate(preserveProperties);
      titleRef.current?.focus();
    }
  };

  // Multi-line paste into an empty title field creates one sub-task per line.
  const handleTitlePaste = async (event: ClipboardEvent<HTMLInputElement>) => {
    if (state.title.trim() !== "") return; // Only when the field is empty.
    const text = event.clipboardData.getData("text");
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "");
    if (lines.length < 2) return; // Single line: let normal paste happen.

    event.preventDefault();
    if (lines.length > MAX_PASTE_SUB_TASKS) {
      toast.error(`Paste up to ${MAX_PASTE_SUB_TASKS} sub-tasks at a time.`);
      return;
    }
    const ok = await onCreateMany(lines.map((line) => buildInput(line)));
    if (ok) {
      resetAfterCreate(false);
      titleRef.current?.focus();
    }
  };

  const priorityMeta = getPriorityMeta(state.priority);
  const PriorityIcon = priorityMeta.icon;
  const estimateMeta = getEstimateMeta(state.estimate);
  const selectedAssignee =
    assigneeOptions.find((option) => option.id === state.assignedUserId) ?? null;
  const team = teamOptions.find((option) => option.id === state.teamId) ?? null;
  const dueDateLabel = formatDueDate(state.dueDate);
  const selectedLabels = state.labelIds
    .map((id) => labelOptions.find((label) => label.id === id))
    .filter((label) => label !== undefined);

  // Team change drops foreign Team Labels (keeps Church-wide), mirroring the
  // create dialog / task update behavior.
  const onTeamChange = (next: string | null) => {
    if (!next) return;
    markTouched("teamId");
    setState((prev) => ({
      ...prev,
      teamId: next,
      labelIds: prev.labelIds.filter((id) => labelAppliesToTeam(id, next)),
    }));
  };

  return (
    <div className="grid gap-3 rounded-lg border bg-background/60 p-3">
      <input
        aria-label="Sub-task title"
        className="w-full bg-transparent font-medium text-sm outline-none placeholder:text-muted-foreground"
        disabled={disabled}
        onChange={(event) => setState((prev) => ({ ...prev, title: event.target.value }))}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void submit(event.shiftKey);
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            // Stop the pane's Escape-to-close from also firing: Esc here closes
            // only the inline creator.
            event.stopPropagation();
            onClose();
          }
        }}
        onPaste={handleTitlePaste}
        placeholder="Task title"
        ref={titleRef}
        value={state.title}
      />
      <textarea
        aria-label="Sub-task description"
        className="field-sizing-content min-h-8 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        disabled={disabled}
        onChange={(event) => setState((prev) => ({ ...prev, description: event.target.value }))}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void submit(event.shiftKey);
          }
        }}
        placeholder="Add description..."
        rows={1}
        value={state.description}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityComboboxSelector
          onValueChange={(next) => {
            markTouched("priority");
            setState((prev) => ({ ...prev, priority: next }));
          }}
          trigger={
            <Pill muted={state.priority === "no_priority"}>
              <PriorityIcon className={cn("size-3.5", priorityMeta.className)} />
              {state.priority === "no_priority" ? "Priority" : priorityMeta.label}
            </Pill>
          }
          value={state.priority}
        />

        {team ? (
          <TeamComboboxSelector
            memberTeamIds={memberTeamIds}
            onValueChange={onTeamChange}
            options={teamOptions}
            trigger={
              <Pill>
                <TeamAvatar color={team.color} name={team.name} size={16} />
                {team.name}
              </Pill>
            }
            value={team.id}
          />
        ) : null}

        <AssigneeComboboxSelector
          align="start"
          currentUserId={currentUserId}
          onValueChange={(next) => {
            markTouched("assignedUserId");
            setState((prev) => ({ ...prev, assignedUserId: next }));
          }}
          options={assigneeOptions}
          teamMemberIds={teamMemberIds}
          trigger={
            <Pill muted={selectedAssignee === null}>
              <AssigneeAvatar assignee={selectedAssignee} size={16} />
              {selectedAssignee?.label ?? "Assignee"}
            </Pill>
          }
          value={state.assignedUserId}
        />

        <EstimateComboboxSelector
          onValueChange={(next) => setState((prev) => ({ ...prev, estimate: next }))}
          trigger={
            <Pill muted={state.estimate === "no_estimate"}>
              <Triangle className="size-3.5" />
              {state.estimate === "no_estimate" ? "Estimate" : estimateMeta.label}
            </Pill>
          }
          value={state.estimate}
        />

        <LabelsComboboxSelector
          onCreateLabel={
            onCreateLabel
              ? async (name) => {
                  const id = await onCreateLabel(name);
                  if (id) setState((prev) => ({ ...prev, labelIds: [...prev.labelIds, id] }));
                }
              : undefined
          }
          onValueChange={(next) => setState((prev) => ({ ...prev, labelIds: next }))}
          options={labelOptions}
          trigger={
            <Pill muted={selectedLabels.length === 0}>
              {selectedLabels.length === 0 ? (
                <>
                  <Tag className="size-3.5" />
                  Labels
                </>
              ) : (
                <>
                  <span className="-space-x-1 flex items-center">
                    {selectedLabels.map((label) => (
                      <span
                        className={cn(
                          "size-2.5 rounded-full ring-2 ring-background",
                          labelDotClassName(label),
                        )}
                        key={label.id}
                      />
                    ))}
                  </span>
                  <span className="truncate">
                    {selectedLabels.length === 1
                      ? selectedLabels[0]?.name
                      : `${selectedLabels.length} labels`}
                  </span>
                </>
              )}
            </Pill>
          }
          value={state.labelIds}
        />

        <DueDateSelector
          onValueChange={(next) => setState((prev) => ({ ...prev, dueDate: next }))}
          trigger={
            <Pill muted={dueDateLabel === null}>
              <CalendarIcon className="size-3.5" />
              {dueDateLabel ?? "Due date"}
            </Pill>
          }
          value={state.dueDate}
        />

        {weekLabel ? (
          <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-muted px-2 font-medium text-muted-foreground text-xs">
            <CalendarDays className="size-3.5" />
            {weekLabel}
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button onClick={onClose} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
        <Button
          disabled={disabled || state.title.trim() === ""}
          onClick={(event) => void submit(event.shiftKey)}
          size="sm"
          type="button"
        >
          Create
        </Button>
      </div>
    </div>
  );
}

function Pill({
  children,
  muted = false,
}: {
  readonly children: React.ReactNode;
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
