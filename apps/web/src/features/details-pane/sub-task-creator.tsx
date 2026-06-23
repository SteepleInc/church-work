import { CalendarDays } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { toast } from "sonner";

import { useAppForm } from "@/components/form/ts-form";
import {
  AssigneeComboboxSelector,
  DueDateSelector,
  EstimateComboboxSelector,
  LabelsComboboxSelector,
  PriorityComboboxSelector,
  TaskAssigneePillTrigger,
  TaskDueDatePillTrigger,
  TaskEstimatePillTrigger,
  TaskLabelsPillTrigger,
  TaskPriorityPillTrigger,
  TaskTeamPillTrigger,
  TeamComboboxSelector,
  type TaskEstimate,
  type TaskPriority,
} from "@/components/tasks/task-card-fields";
import { DraftTaskPropertySurface } from "@/components/tasks/draft-task-property-surface";
import { Button } from "@/components/ui/button";

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

export type SubTaskCreatorFormValues = {
  readonly title: string;
  readonly description: string;
  readonly assignedUserId: string | null;
  readonly teamId: string;
  readonly priority: TaskPriority;
  readonly estimate: TaskEstimate;
  readonly labelIds: readonly string[];
  readonly dueDate: string | null;
};

export function initialFormValues(defaults: SubTaskCreatorDefaults): SubTaskCreatorFormValues {
  return {
    title: "",
    description: "",
    assignedUserId: defaults.assignedUserId,
    teamId: defaults.teamId,
    priority: defaults.priority,
    estimate: "no_estimate",
    labelIds: [],
    dueDate: null,
  };
}

export function buildSubTaskCreateInput(
  values: SubTaskCreatorFormValues,
  title: string,
): SubTaskCreateInput {
  const description = values.description.trim();

  return {
    title,
    description: description === "" ? null : description,
    assignedUserId: values.assignedUserId,
    teamId: values.teamId,
    priority: values.priority,
    estimate: values.estimate,
    labelIds: values.labelIds,
    dueDate: values.dueDate,
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
  const [touchedDefaults, setTouchedDefaults] = useState<ReadonlySet<keyof SubTaskCreatorDefaults>>(
    () => new Set(),
  );
  const titleRef = useRef<HTMLInputElement>(null);
  const priorityOpenRef = useRef<(() => void) | null>(null);
  const teamOpenRef = useRef<(() => void) | null>(null);
  const assigneeOpenRef = useRef<(() => void) | null>(null);
  const estimateOpenRef = useRef<(() => void) | null>(null);
  const labelsOpenRef = useRef<(() => void) | null>(null);
  const dueDateOpenRef = useRef<(() => void) | null>(null);
  const pickerRefs = useMemo(
    () => ({
      priority: priorityOpenRef,
      team: teamOpenRef,
      assignee: assigneeOpenRef,
      estimate: estimateOpenRef,
      labels: labelsOpenRef,
      dueDate: dueDateOpenRef,
    }),
    [],
  );

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const form = useAppForm({
    defaultValues: initialFormValues(defaults),
    onSubmit: async ({ value }) => {
      await submit(value, false);
    },
  });

  // Keep untouched property pills in sync with changing parent defaults; never
  // overwrite a pill the user has set (grilling decision).
  useEffect(() => {
    if (!touchedDefaults.has("assignedUserId")) {
      form.setFieldValue("assignedUserId", defaults.assignedUserId);
    }
    if (!touchedDefaults.has("teamId")) form.setFieldValue("teamId", defaults.teamId);
    if (!touchedDefaults.has("priority")) form.setFieldValue("priority", defaults.priority);
  }, [defaults.assignedUserId, defaults.teamId, defaults.priority, form, touchedDefaults]);

  const markTouched = (field: keyof SubTaskCreatorDefaults) =>
    setTouchedDefaults((prev) => {
      const touched = new Set(prev);
      touched.add(field);
      return touched;
    });

  const resetAfterCreate = (preserveProperties: boolean) => {
    if (preserveProperties) {
      form.setFieldValue("title", "");
      form.setFieldValue("description", "");
      return;
    }
    setTouchedDefaults(new Set());
    form.reset(initialFormValues(defaults));
  };

  const submit = async (values: SubTaskCreatorFormValues, preserveProperties: boolean) => {
    const trimmed = values.title.trim();
    if (trimmed === "") return;
    const ok = await onCreate(buildSubTaskCreateInput(values, trimmed));
    if (ok) {
      resetAfterCreate(preserveProperties);
      titleRef.current?.focus();
    }
  };

  // Multi-line paste into an empty title field creates one sub-task per line.
  const handleTitlePaste = async (event: ClipboardEvent<HTMLInputElement>) => {
    const values = form.state.values;
    if (values.title.trim() !== "") return; // Only when the field is empty.
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
    const ok = await onCreateMany(lines.map((line) => buildSubTaskCreateInput(values, line)));
    if (ok) {
      resetAfterCreate(false);
      titleRef.current?.focus();
    }
  };

  // Team change drops foreign Team Labels (keeps Church-wide), mirroring the
  // create dialog / task update behavior.
  const onTeamChange = (next: string | null) => {
    if (!next) return;
    markTouched("teamId");
    form.setFieldValue("teamId", next);
    form.setFieldValue(
      "labelIds",
      form.state.values.labelIds.filter((id) => labelAppliesToTeam(id, next)),
    );
  };

  return (
    <DraftTaskPropertySurface
      className="relative grid gap-3 rounded-lg border bg-background/60 p-3"
      pickerRefs={pickerRefs}
      showArmedRing
    >
      <form.Field name="title">
        {(field) => (
          <input
            aria-label="Sub-task title"
            className="w-full bg-transparent font-medium text-sm outline-none placeholder:text-muted-foreground"
            disabled={disabled}
            onChange={(event) => field.handleChange(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void submit(form.state.values, event.shiftKey);
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
            autoComplete="off"
            data-1p-ignore="true"
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="description">
        {(field) => (
          <textarea
            aria-label="Sub-task description"
            autoComplete="off"
            className="field-sizing-content min-h-8 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            data-1p-ignore="true"
            disabled={disabled}
            onChange={(event) => field.handleChange(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void submit(form.state.values, event.shiftKey);
              }
            }}
            placeholder="Add description..."
            rows={1}
            value={field.state.value}
          />
        )}
      </form.Field>

      <div className="flex flex-wrap items-center gap-1.5">
        <form.Field name="priority">
          {(field) => (
            <PriorityComboboxSelector
              onValueChange={(next) => {
                markTouched("priority");
                field.handleChange(next);
              }}
              openRef={priorityOpenRef}
              trigger={<TaskPriorityPillTrigger value={field.state.value} />}
              value={field.state.value}
            />
          )}
        </form.Field>

        <form.Field name="teamId">
          {(field) => {
            const team = teamOptions.find((option) => option.id === field.state.value) ?? null;
            return team ? (
              <TeamComboboxSelector
                memberTeamIds={memberTeamIds}
                onValueChange={onTeamChange}
                openRef={teamOpenRef}
                options={teamOptions}
                trigger={<TaskTeamPillTrigger avatarSize={16} team={team} />}
                value={team.id}
              />
            ) : null;
          }}
        </form.Field>

        <form.Field name="assignedUserId">
          {(field) => {
            const selectedAssignee =
              assigneeOptions.find((option) => option.id === field.state.value) ?? null;
            return (
              <AssigneeComboboxSelector
                align="start"
                currentUserId={currentUserId}
                onValueChange={(next) => {
                  markTouched("assignedUserId");
                  field.handleChange(next);
                }}
                openRef={assigneeOpenRef}
                options={assigneeOptions}
                teamMemberIds={teamMemberIds}
                trigger={<TaskAssigneePillTrigger assignee={selectedAssignee} avatarSize={16} />}
                value={field.state.value}
              />
            );
          }}
        </form.Field>

        <form.Field name="estimate">
          {(field) => (
            <EstimateComboboxSelector
              onValueChange={field.handleChange}
              openRef={estimateOpenRef}
              trigger={<TaskEstimatePillTrigger value={field.state.value} />}
              value={field.state.value}
            />
          )}
        </form.Field>

        <form.Field name="labelIds">
          {(field) => {
            const selectedLabels = field.state.value
              .map((id) => labelOptions.find((label) => label.id === id))
              .filter((label) => label !== undefined);
            return (
              <LabelsComboboxSelector
                onCreateLabel={
                  onCreateLabel
                    ? async (name) => {
                        const id = await onCreateLabel(name);
                        if (id) field.handleChange([...field.state.value, id]);
                      }
                    : undefined
                }
                onValueChange={field.handleChange}
                openRef={labelsOpenRef}
                options={labelOptions}
                trigger={<TaskLabelsPillTrigger labels={selectedLabels} />}
                value={field.state.value}
              />
            );
          }}
        </form.Field>

        <form.Field name="dueDate">
          {(field) => (
            <DueDateSelector
              onValueChange={field.handleChange}
              openRef={dueDateOpenRef}
              trigger={<TaskDueDatePillTrigger value={field.state.value} />}
              value={field.state.value}
            />
          )}
        </form.Field>

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
        <form.Subscribe selector={(formState) => formState.values.title}>
          {(title) => (
            <Button
              disabled={disabled || title.trim() === ""}
              onClick={(event) => void submit(form.state.values, event.shiftKey)}
              size="sm"
              type="button"
            >
              Create
            </Button>
          )}
        </form.Subscribe>
      </div>
    </DraftTaskPropertySurface>
  );
}
