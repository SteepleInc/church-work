import { getLabelColorForName, isLabelColor, type LabelColor } from "@church-task/domain";
import {
  Ban,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleUserRound,
  LoaderCircle,
  Plus,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Triangle,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type ReactNode,
} from "react";

import { TeamAvatar } from "@/components/avatars/teamAvatar";
import { UserAvatar } from "@/components/avatars/userAvatar";
import { Calendar } from "@/components/ui/calendar";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxList,
  ComboboxOption,
  ComboboxPrimitive,
  PickerHeader,
  PickerPopup,
  usePickerOpener,
} from "@/components/ui/combobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { TaskBoardTaskState } from "./task-kanban-adapter";

// --- Priority ---------------------------------------------------------------

export type TaskPriority = "no_priority" | "urgent" | "high" | "medium" | "low";

type PriorityMeta = {
  readonly value: TaskPriority;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
  readonly className?: string;
};

function PriorityNoneIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="16"
    >
      <line x1="5" x2="7" y1="12" y2="12" />
      <line x1="11" x2="13" y1="12" y2="12" />
      <line x1="17" x2="19" y1="12" y2="12" />
    </svg>
  );
}

export const PRIORITY_OPTIONS: readonly PriorityMeta[] = [
  { value: "no_priority", label: "No priority", icon: PriorityNoneIcon },
  { value: "urgent", label: "Urgent", icon: CircleAlert, className: "text-orange-500" },
  { value: "high", label: "High", icon: SignalHigh },
  { value: "medium", label: "Medium", icon: SignalMedium },
  { value: "low", label: "Low", icon: SignalLow },
];

export function getPriorityMeta(value: TaskPriority): PriorityMeta {
  return PRIORITY_OPTIONS.find((option) => option.value === value) ?? PRIORITY_OPTIONS[0];
}

// --- Estimate ----------------------------------------------------------------
// Persisted on the Task; "no_estimate" is the UI sentinel for the backend's
// null/absent estimate.

export type TaskEstimate = "no_estimate" | "xs" | "s" | "m" | "l" | "xl";

type EstimateMeta = {
  readonly value: TaskEstimate;
  readonly label: string;
  readonly short: string | null;
};

export const ESTIMATE_OPTIONS: readonly EstimateMeta[] = [
  { value: "no_estimate", label: "No estimate", short: null },
  { value: "xs", label: "XS", short: "XS" },
  { value: "s", label: "S", short: "S" },
  { value: "m", label: "M", short: "M" },
  { value: "l", label: "L", short: "L" },
  { value: "xl", label: "XL", short: "XL" },
];

export function getEstimateMeta(value: TaskEstimate): EstimateMeta {
  return ESTIMATE_OPTIONS.find((option) => option.value === value) ?? ESTIMATE_OPTIONS[0];
}

export function estimateValues(): readonly TaskEstimate[] {
  return ESTIMATE_OPTIONS.map((option) => option.value);
}

// --- Labels -------------------------------------------------------------------

/** A Church Label as the pickers and badges consume it. */
export type TaskLabelOption = {
  readonly id: string;
  readonly name: string;
  // Label Color token from the fixed product palette (see CONTEXT.md).
  readonly color: string;
};

// Label Color token -> Tailwind dot class. Tokens come from LABEL_COLORS in
// @church-task/domain; Tailwind needs literal class strings, so the mapping
// lives here on the web side (same pattern as TeamAvatar).
const LABEL_COLOR_DOT_CLASSES: Record<LabelColor, string> = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  pink: "bg-pink-500",
};

/** The Tailwind dot class for a specific Label Color token (used by color pickers). */
export function labelColorDotClassName(color: LabelColor): string {
  return LABEL_COLOR_DOT_CLASSES[color];
}

/** Resolves a Label's colored-dot class, falling back to the name-derived color. */
export function labelDotClassName(option: {
  readonly name: string;
  readonly color: string;
}): string {
  const resolved = isLabelColor(option.color) ? option.color : getLabelColorForName(option.name);
  return LABEL_COLOR_DOT_CLASSES[resolved];
}

// --- Created-at formatting --------------------------------------------------

/**
 * Linear-style "Created" label for a Task's creation timestamp (epoch ms).
 * Shows month + day (e.g. "Feb 25") and only appends the year when the Task
 * was created in a different calendar year than `now`. Returns `null` for
 * missing/invalid timestamps so callers can omit the footer entirely.
 */
export function formatDueDate(
  dueDate: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!dueDate) return null;
  const [year, month, day] = dueDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  const due = new Date(year, month - 1, day);
  if (Number.isNaN(due.getTime())) return null;
  const sameYear = due.getFullYear() === now.getFullYear();
  return due.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function formatCreatedAt(
  createdAt: number | null | undefined,
  now: Date = new Date(),
): string | null {
  if (createdAt == null || !Number.isFinite(createdAt)) return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  const sameYear = created.getFullYear() === now.getFullYear();
  return created.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

// --- Workflow status icon mapping -------------------------------------------

const STATE_ICON: Record<TaskBoardTaskState, LucideIcon> = {
  todo: CircleDashed,
  in_progress: LoaderCircle,
  done: CircleCheck,
  canceled: Ban,
};

const STATE_ICON_CLASS: Record<TaskBoardTaskState, string> = {
  todo: "text-muted-foreground",
  in_progress: "text-amber-500",
  done: "text-emerald-500",
  canceled: "text-muted-foreground",
};

export function WorkflowStatusIcon({
  taskState,
  className,
}: {
  readonly taskState: TaskBoardTaskState;
  readonly className?: string;
}) {
  const Icon = STATE_ICON[taskState] ?? CircleDot;
  return <Icon className={cn("size-4", STATE_ICON_CLASS[taskState], className)} />;
}

// --- Card field option shape ------------------------------------------------

export type CardSelectOption<Value extends string> = {
  readonly value: Value;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly keywords?: readonly string[];
};

// --- Assignee option helper -------------------------------------------------

export type AssigneeOption = {
  readonly id: string;
  readonly label: string;
};

export function AssigneeAvatar({
  assignee,
  size = 20,
}: {
  readonly assignee: AssigneeOption | null;
  readonly size?: number;
}) {
  if (!assignee) {
    return (
      <span
        className="flex items-center justify-center rounded-full text-muted-foreground"
        style={{ height: size, width: size }}
      >
        <CircleUserRound className="size-full" strokeWidth={1.5} />
      </span>
    );
  }

  return <UserAvatar name={assignee.label} size={size} userId={assignee.id} />;
}

// --- Assignee picker (Linear-style, sectioned + keyboard shortcuts) ---------

// A selectable row in the assignee picker. `userId === null` is the
// "No assignee" row. `shortcut` is the digit shown on the right and the key
// that selects the row while the picker is open (0 = No assignee, 1 = first
// person, ...). Only the first 10 rows (0-9) get a digit shortcut.
export type AssigneeRow = {
  readonly userId: string | null;
  readonly label: string;
  readonly shortcut: string | null;
};

export type AssigneePartition = {
  readonly noAssignee: AssigneeRow;
  // The current user, pinned above the section labels (Linear behavior).
  readonly pinned: AssigneeRow | null;
  readonly teamMembers: readonly AssigneeRow[];
  readonly otherMembers: readonly AssigneeRow[];
};

/**
 * Splits assignee options into Linear's picker layout: a "No assignee" row, the
 * current user pinned to the top, then "Team members" (members of the Task's
 * Team) and the remaining church members. Sequential keyboard shortcuts (0-9)
 * are assigned in display order: No assignee (0), pinned, team, others.
 */
export function partitionAssignees({
  options,
  currentUserId,
  teamMemberIds,
}: {
  readonly options: readonly AssigneeOption[];
  readonly currentUserId: string | null;
  readonly teamMemberIds: ReadonlySet<string>;
}): AssigneePartition {
  const pinnedOption =
    currentUserId === null ? undefined : options.find((option) => option.id === currentUserId);

  const rest = options.filter((option) => option.id !== pinnedOption?.id);
  const teamOptions = rest.filter((option) => teamMemberIds.has(option.id));
  const otherOptions = rest.filter((option) => !teamMemberIds.has(option.id));

  // Assign shortcuts in display order starting at 1 (0 is reserved for the
  // No assignee row). Rows past 9 get no shortcut digit.
  let next = 1;
  const withShortcut = (option: AssigneeOption): AssigneeRow => {
    const shortcut = next <= 9 ? String(next) : null;
    next += 1;
    return { userId: option.id, label: option.label, shortcut };
  };

  return {
    noAssignee: { userId: null, label: "No assignee", shortcut: "0" },
    pinned: pinnedOption ? withShortcut(pinnedOption) : null,
    teamMembers: teamOptions.map(withShortcut),
    otherMembers: otherOptions.map(withShortcut),
  };
}

function allRows(partition: AssigneePartition): readonly AssigneeRow[] {
  return [
    partition.noAssignee,
    ...(partition.pinned ? [partition.pinned] : []),
    ...partition.teamMembers,
    ...partition.otherMembers,
  ];
}

function AssigneeRowItem({
  row,
  selectedUserId,
}: {
  readonly row: AssigneeRow;
  readonly selectedUserId: string | null;
}) {
  const isSelected = row.userId === selectedUserId;
  return (
    // Empty string stands in for the "No assignee" value (null) so the
    // primitive can key the row.
    <ComboboxOption selected={isSelected} shortcut={row.shortcut} value={row.userId ?? ""}>
      {row.userId === null ? (
        <span className="flex size-5 items-center justify-center text-muted-foreground">
          <UserRound className="size-4" strokeWidth={1.5} />
        </span>
      ) : (
        <AssigneeAvatar assignee={{ id: row.userId, label: row.label }} size={20} />
      )}
      <span className="truncate">{row.label}</span>
    </ComboboxOption>
  );
}

type AssigneeComboboxSelectorProps = {
  readonly value: string | null;
  readonly options: readonly AssigneeOption[];
  readonly currentUserId: string | null;
  readonly teamMemberIds: ReadonlySet<string>;
  readonly onValueChange: (value: string | null) => void;
  readonly trigger: ReactNode;
  readonly disabled?: boolean;
  // Popup alignment relative to the trigger. Board cards keep the default
  // "end" (the avatar sits on the card's right edge, so the popup grows left);
  // the create dialog passes "start" so it opens rightward like its other
  // pickers.
  readonly align?: "start" | "end";
  // The parent populates this ref with a callback that opens the picker, so a
  // card-level "A" hover shortcut can open it without focusing the trigger.
  readonly openRef?: MutableRefObject<(() => void) | null>;
};

/**
 * Linear-style assignee picker for the Task card. Sectioned into a pinned
 * current user, Team members and the remaining members, with a "No assignee"
 * row. Pressing "A" on the trigger opens the picker; while open and the search
 * box is empty, digit keys (0-9) select the matching row.
 */
export function AssigneeComboboxSelector({
  value,
  options,
  currentUserId,
  teamMemberIds,
  onValueChange,
  trigger,
  disabled = false,
  align = "end",
  openRef,
}: AssigneeComboboxSelectorProps) {
  const partition = useMemo(
    () => partitionAssignees({ options, currentUserId, teamMemberIds }),
    [options, currentUserId, teamMemberIds],
  );
  const rows = useMemo(() => allRows(partition), [partition]);
  const items = useMemo(() => rows.map((row) => row.userId ?? ""), [rows]);
  const labelFor = useMemo(() => {
    const lookup = new Map(rows.map((row) => [row.userId ?? "", row.label]));
    return (candidate: string) => lookup.get(candidate) ?? candidate;
  }, [rows]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [open, setOpen] = usePickerOpener(openRef, disabled);

  const select = (next: string | null) => {
    onValueChange(next);
  };

  // Digit keys pick a row by its shortcut, but only when the search box is
  // empty so they don't hijack typing a name that contains a number.
  const handleShortcutKey = (event: ReactKeyboardEvent) => {
    if ((inputRef.current?.value ?? "") !== "") return;
    if (event.key.length !== 1 || event.key < "0" || event.key > "9") return;
    const match = rows.find((row) => row.shortcut === event.key);
    if (!match) return;
    event.preventDefault();
    select(match.userId);
    setOpen(false);
  };

  return (
    <Combobox<string>
      disabled={disabled}
      items={items}
      inputRef={inputRef}
      itemToStringLabel={labelFor}
      onOpenChange={setOpen}
      onValueChange={(next) => select(next === "" ? null : (next ?? null))}
      open={open}
      value={value ?? ""}
    >
      <ComboboxPrimitive.Trigger
        aria-label="Assign to"
        className="inline-flex cursor-pointer items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
        data-slot="card-combobox-trigger"
        // "A" opens the picker (matches Linear's "A" shortcut hint).
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "a" || event.key === "A") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {trigger}
      </ComboboxPrimitive.Trigger>
      <PickerPopup
        align={align}
        popupProps={{
          onClick: (event) => event.stopPropagation(),
          onKeyDown: handleShortcutKey,
        }}
        width="lg"
      >
        <PickerHeader
          inputProps={{ "aria-controls": listId }}
          placeholder="Assign to..."
          shortcut="A"
        />
        <ComboboxEmpty>No members.</ComboboxEmpty>
        <ComboboxList id={listId}>
          <ComboboxGroup>
            <AssigneeRowItem row={partition.noAssignee} selectedUserId={value} />
            {partition.pinned ? (
              <AssigneeRowItem row={partition.pinned} selectedUserId={value} />
            ) : null}
          </ComboboxGroup>
          {partition.teamMembers.length > 0 ? (
            <ComboboxGroup>
              <ComboboxGroupLabel>Team members</ComboboxGroupLabel>
              {partition.teamMembers.map((row) => (
                <AssigneeRowItem key={row.userId ?? "none"} row={row} selectedUserId={value} />
              ))}
            </ComboboxGroup>
          ) : null}
          {partition.otherMembers.length > 0 ? (
            <ComboboxGroup>
              <ComboboxGroupLabel>Members</ComboboxGroupLabel>
              {partition.otherMembers.map((row) => (
                <AssigneeRowItem key={row.userId ?? "none"} row={row} selectedUserId={value} />
              ))}
            </ComboboxGroup>
          ) : null}
        </ComboboxList>
      </PickerPopup>
    </Combobox>
  );
}

// --- Priority picker (Linear-style, flat list + keyboard shortcuts) ---------

// A priority option paired with its digit shortcut, in display order:
// No priority (0), Urgent (1), High (2), Medium (3), Low (4).
export type PriorityRow = {
  readonly value: TaskPriority;
  readonly shortcut: string;
};

export function priorityRows(): readonly PriorityRow[] {
  return PRIORITY_OPTIONS.map((option, index) => ({
    value: option.value,
    shortcut: String(index),
  }));
}

type PriorityComboboxSelectorProps = {
  readonly value: TaskPriority;
  readonly onValueChange: (value: TaskPriority) => void;
  readonly trigger: ReactNode;
  readonly disabled?: boolean;
  // Populated by the parent so a card-level "P" hover shortcut can open the
  // picker without focusing the trigger.
  readonly openRef?: MutableRefObject<(() => void) | null>;
};

/**
 * Linear-style priority picker for the Task card. A flat list of priorities
 * with a leading icon, a check on the selected row and a digit shortcut (0-4).
 * Pressing "P" on the trigger opens the picker; while open, digit keys select
 * the matching priority.
 */
export function PriorityComboboxSelector({
  value,
  onValueChange,
  trigger,
  disabled = false,
  openRef,
}: PriorityComboboxSelectorProps) {
  const rows = useMemo(() => priorityRows(), []);
  const items = useMemo(() => rows.map((row) => row.value), [rows]);
  const labelFor = (candidate: TaskPriority) => getPriorityMeta(candidate).label;
  const [open, setOpen] = usePickerOpener(openRef, disabled);

  const select = (next: TaskPriority) => {
    onValueChange(next);
    setOpen(false);
  };

  const handleShortcutKey = (event: ReactKeyboardEvent) => {
    if (event.key.length !== 1 || event.key < "0" || event.key > "9") return;
    const match = rows.find((row) => row.shortcut === event.key);
    if (!match) return;
    event.preventDefault();
    select(match.value);
  };

  return (
    <Combobox<TaskPriority>
      disabled={disabled}
      items={items}
      itemToStringLabel={labelFor}
      onOpenChange={setOpen}
      onValueChange={(next) => {
        if (next) select(next);
      }}
      open={open}
      value={value}
    >
      <ComboboxPrimitive.Trigger
        aria-label="Change priority"
        className="inline-flex cursor-pointer items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
        data-slot="card-combobox-trigger"
        // "P" opens the picker (matches Linear's "P" shortcut hint).
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "p" || event.key === "P") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {trigger}
      </ComboboxPrimitive.Trigger>
      <PickerPopup
        popupProps={{
          onClick: (event) => event.stopPropagation(),
          onKeyDown: handleShortcutKey,
        }}
      >
        <PickerHeader placeholder="Change priority to..." shortcut="P" />
        <ComboboxEmpty>No results.</ComboboxEmpty>
        <ComboboxList>
          {rows.map((row) => {
            const meta = getPriorityMeta(row.value);
            const Icon = meta.icon;
            return (
              <ComboboxOption
                key={row.value}
                selected={row.value === value}
                shortcut={row.shortcut}
                value={row.value}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  <Icon className={cn("size-4", meta.className)} />
                </span>
                <span className="truncate">{meta.label}</span>
              </ComboboxOption>
            );
          })}
        </ComboboxList>
      </PickerPopup>
    </Combobox>
  );
}

// --- Status picker (Linear-style, flat list + keyboard shortcuts) -----------

// A status option paired with its digit shortcut. Linear numbers statuses in
// display (sort) order starting at 1, wrapping the tenth row to 0, and leaves
// any rows past the tenth without a shortcut digit.
export type StatusRow<Value extends string> = {
  readonly value: Value;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly keywords?: readonly string[];
  readonly shortcut: string | null;
};

export function statusRows<Value extends string>(
  options: readonly CardSelectOption<Value>[],
): readonly StatusRow<Value>[] {
  return options.map((option, index) => ({
    value: option.value,
    label: option.label,
    icon: option.icon,
    keywords: option.keywords,
    // 1-9 for the first nine rows, 0 for the tenth, none after that.
    shortcut: index < 9 ? String(index + 1) : index === 9 ? "0" : null,
  }));
}

type StatusComboboxSelectorProps = {
  readonly value: string | null;
  readonly options: readonly CardSelectOption<string>[];
  readonly onValueChange: (value: string | null) => void;
  readonly trigger: ReactNode;
  readonly disabled?: boolean;
  readonly emptyText?: string;
  // Populated by the parent so a card-level "S" hover shortcut can open the
  // picker without focusing the trigger.
  readonly openRef?: MutableRefObject<(() => void) | null>;
};

/**
 * Linear-style status picker for the Task card. A flat list of workflow
 * statuses with a leading state icon, a check on the selected row and a digit
 * shortcut (1-9, then 0 for the tenth). Pressing "S" on the trigger opens the
 * picker; while open and the search box is empty, digit keys select the
 * matching status.
 */
export function StatusComboboxSelector({
  value,
  options,
  onValueChange,
  trigger,
  disabled = false,
  emptyText = "No results.",
  openRef,
}: StatusComboboxSelectorProps) {
  const rows = useMemo(() => statusRows(options), [options]);
  const items = useMemo(() => rows.map((row) => row.value), [rows]);
  const labelFor = useMemo(() => {
    const lookup = new Map(rows.map((row) => [row.value, row.label]));
    return (candidate: string) => lookup.get(candidate) ?? candidate;
  }, [rows]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = usePickerOpener(openRef, disabled);

  const select = (next: string | null) => {
    if (!next) return;
    onValueChange(next);
    setOpen(false);
  };

  // Digit keys pick a status by its shortcut, but only when the search box is
  // empty so they don't hijack typing into the filter.
  const handleShortcutKey = (event: ReactKeyboardEvent) => {
    if ((inputRef.current?.value ?? "") !== "") return;
    if (event.key.length !== 1 || event.key < "0" || event.key > "9") return;
    const match = rows.find((row) => row.shortcut === event.key);
    if (!match) return;
    event.preventDefault();
    select(match.value);
  };

  return (
    <Combobox<string>
      disabled={disabled}
      inputRef={inputRef}
      items={items}
      itemToStringLabel={labelFor}
      onOpenChange={setOpen}
      onValueChange={(next) => select(next ?? null)}
      open={open}
      value={value ?? ""}
    >
      <ComboboxPrimitive.Trigger
        aria-label="Change status"
        className="inline-flex cursor-pointer items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
        data-slot="card-combobox-trigger"
        // "S" opens the picker (matches Linear's "S" shortcut hint).
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "s" || event.key === "S") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {trigger}
      </ComboboxPrimitive.Trigger>
      <PickerPopup
        popupProps={{
          onClick: (event) => event.stopPropagation(),
          onKeyDown: handleShortcutKey,
        }}
      >
        <PickerHeader placeholder="Change status..." shortcut="S" />
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {rows.map((row) => (
            <ComboboxOption
              key={row.value}
              selected={row.value === value}
              shortcut={row.shortcut}
              value={row.value}
            >
              {row.icon ? (
                <span className="flex size-4 shrink-0 items-center justify-center">{row.icon}</span>
              ) : null}
              <span className="truncate">{row.label}</span>
            </ComboboxOption>
          ))}
        </ComboboxList>
      </PickerPopup>
    </Combobox>
  );
}

// --- Estimate / size picker (Linear-style, flat list) -----------------------

type EstimateComboboxSelectorProps = {
  readonly value: TaskEstimate;
  readonly onValueChange: (value: TaskEstimate) => void;
  readonly trigger: ReactNode;
  readonly triggerLabel?: string;
  readonly disabled?: boolean;
  // Populated by the parent so a card-level "Shift+E" hover shortcut can open
  // the picker without focusing the trigger.
  readonly openRef?: MutableRefObject<(() => void) | null>;
};

/**
 * Linear-style estimate picker for the Task card. A flat list of sizes with a
 * leading triangle icon and a check on the selected row. Pressing "Shift+E" on
 * the trigger opens the picker. Unlike priority, estimate rows have no digit
 * shortcuts (matching Linear).
 */
export function EstimateComboboxSelector({
  value,
  onValueChange,
  trigger,
  triggerLabel = "Change estimate",
  disabled = false,
  openRef,
}: EstimateComboboxSelectorProps) {
  const items = useMemo(() => estimateValues(), []);
  const labelFor = (candidate: TaskEstimate) => getEstimateMeta(candidate).label;
  const [open, setOpen] = usePickerOpener(openRef, disabled);

  const select = (next: TaskEstimate) => {
    onValueChange(next);
    setOpen(false);
  };

  return (
    <Combobox<TaskEstimate>
      disabled={disabled}
      items={items}
      itemToStringLabel={labelFor}
      onOpenChange={setOpen}
      onValueChange={(next) => {
        if (next) select(next);
      }}
      open={open}
      value={value}
    >
      <ComboboxPrimitive.Trigger
        aria-label={triggerLabel}
        className="inline-flex cursor-pointer items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
        data-slot="card-combobox-trigger"
        // "Shift+E" opens the picker (matches Linear's "⇧ E" shortcut hint).
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.shiftKey && (event.key === "e" || event.key === "E")) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {trigger}
      </ComboboxPrimitive.Trigger>
      <PickerPopup popupProps={{ onClick: (event) => event.stopPropagation() }}>
        <PickerHeader placeholder="Change estimate to..." shortcut="⇧ E" />
        <ComboboxEmpty>No results.</ComboboxEmpty>
        <ComboboxList>
          {ESTIMATE_OPTIONS.map((option) => (
            <ComboboxOption
              key={option.value}
              selected={option.value === value}
              shortcut={null}
              value={option.value}
            >
              <span className="flex size-4 shrink-0 items-center justify-center">
                <Triangle className="size-3.5" />
              </span>
              <span className="truncate">{option.label}</span>
            </ComboboxOption>
          ))}
        </ComboboxList>
      </PickerPopup>
    </Combobox>
  );
}

// --- Labels picker (Linear-style, multi-select) ------------------------------

type LabelsComboboxSelectorProps = {
  readonly value: readonly string[];
  readonly options: readonly TaskLabelOption[];
  readonly onValueChange: (value: readonly string[]) => void;
  // Inline label creation (Linear-style "Create label" row). Omitting it hides
  // the create row. The handler creates the Label and appends its id to the
  // selection once the id exists.
  readonly onCreateLabel?: (name: string) => void;
  readonly trigger: ReactNode;
  readonly disabled?: boolean;
  // Populated by the parent so an "L" hover/dialog shortcut can open the
  // picker without focusing the trigger.
  readonly openRef?: MutableRefObject<(() => void) | null>;
};

// Sentinel item that renders the "Create label" row. Its display label mirrors
// the query so Base UI's filter always keeps it visible.
const CREATE_LABEL_ITEM = "__create-label__";

/**
 * Linear-style labels picker. A multi-select list of labels with a leading
 * colored dot and a check on every selected row; the popup stays open across
 * selections. Pressing "L" on the trigger opens the picker. When the query
 * matches no existing label exactly, a "Create label" row appears.
 */
export function LabelsComboboxSelector({
  value,
  options,
  onValueChange,
  onCreateLabel,
  trigger,
  disabled = false,
  openRef,
}: LabelsComboboxSelectorProps) {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const canCreate =
    onCreateLabel !== undefined &&
    trimmedQuery !== "" &&
    !options.some((option) => option.name.trim().toLowerCase() === trimmedQuery.toLowerCase());
  const items = useMemo(() => {
    const ids = options.map((option) => option.id);
    return canCreate ? [...ids, CREATE_LABEL_ITEM] : ids;
  }, [options, canCreate]);
  const labelFor = (candidate: string) => {
    if (candidate === CREATE_LABEL_ITEM) return query;
    return options.find((option) => option.id === candidate)?.name ?? candidate;
  };
  const [open, setOpen] = usePickerOpener(openRef, disabled);

  return (
    <Combobox<string, true>
      disabled={disabled}
      items={items}
      itemToStringLabel={labelFor}
      multiple
      onInputValueChange={setQuery}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      onValueChange={(next) => {
        const selected = next ?? [];
        if (selected.includes(CREATE_LABEL_ITEM)) {
          if (canCreate) onCreateLabel(trimmedQuery);
          onValueChange(selected.filter((candidate) => candidate !== CREATE_LABEL_ITEM));
          return;
        }
        onValueChange(selected);
      }}
      open={open}
      value={value as string[]}
    >
      <ComboboxPrimitive.Trigger
        aria-label="Add labels"
        className="inline-flex cursor-pointer items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
        data-slot="card-combobox-trigger"
        // "L" opens the picker (matches Linear's "L" shortcut hint).
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "l" || event.key === "L") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {trigger}
      </ComboboxPrimitive.Trigger>
      <PickerPopup popupProps={{ onClick: (event) => event.stopPropagation() }}>
        <PickerHeader placeholder="Add labels..." shortcut="L" />
        <ComboboxEmpty>No labels.</ComboboxEmpty>
        <ComboboxList>
          {options.map((option) => (
            <ComboboxOption
              key={option.id}
              selected={value.includes(option.id)}
              shortcut={null}
              value={option.id}
            >
              <span className="flex size-4 shrink-0 items-center justify-center">
                <span className={cn("size-2.5 rounded-full", labelDotClassName(option))} />
              </span>
              <span className="truncate">{option.name}</span>
            </ComboboxOption>
          ))}
          {canCreate ? (
            <ComboboxOption selected={false} shortcut={null} value={CREATE_LABEL_ITEM}>
              <span className="flex size-4 shrink-0 items-center justify-center">
                <Plus className="size-3.5" />
              </span>
              <span className="truncate">Create label "{trimmedQuery}"</span>
            </ComboboxOption>
          ) : null}
        </ComboboxList>
      </PickerPopup>
    </Combobox>
  );
}

// --- Due date picker (calendar popover) ---------------------------------------

/** Parses a Church-local YYYY-MM-DD string into a local Date for the calendar. */
export function parseLocalDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Formats a local Date back into the Church-local YYYY-MM-DD string. */
export function toLocalDateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

type DueDateSelectorProps = {
  readonly value: string | null;
  readonly onValueChange: (value: string | null) => void;
  readonly trigger: ReactNode;
  readonly disabled?: boolean;
  // Populated by the parent so a "D" hover/dialog shortcut can open the
  // picker without focusing the trigger.
  readonly openRef?: MutableRefObject<(() => void) | null>;
};

/**
 * Due Date picker: a calendar popover with a "No due date" clear row. The Due
 * Date is never auto-set — it stays empty until the user picks a date here.
 * Pressing "D" on the trigger opens the picker.
 */
export function DueDateSelector({
  value,
  onValueChange,
  trigger,
  disabled = false,
  openRef,
}: DueDateSelectorProps) {
  const [open, setOpen] = usePickerOpener(openRef, disabled);
  const selected = parseLocalDate(value);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        aria-label="Set due date"
        className="inline-flex cursor-pointer items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
        data-slot="card-combobox-trigger"
        disabled={disabled}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "d" || event.key === "D") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {trigger}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0" side="bottom" sideOffset={4}>
        <Calendar
          autoFocus
          mode="single"
          onSelect={(next) => {
            onValueChange(next ? toLocalDateString(next) : null);
            setOpen(false);
          }}
          selected={selected}
        />
        {value !== null ? (
          <button
            className="flex w-full cursor-pointer items-center gap-2 border-t px-3 py-2 text-muted-foreground text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              onValueChange(null);
              setOpen(false);
            }}
            type="button"
          >
            <Ban className="size-4" />
            No due date
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

// --- Team picker (Linear-style, sectioned) ------------------------------------

export type TeamPickerOption = {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
};

export type TeamPartition = {
  readonly yourTeams: readonly TeamPickerOption[];
  readonly otherTeams: readonly TeamPickerOption[];
};

/**
 * Splits Teams into Linear's picker layout: "Your teams" (Teams the current
 * user is a member of) followed by "Other teams". There is no "No team" row —
 * every Task belongs to a Team.
 */
export function partitionTeams({
  options,
  memberTeamIds,
}: {
  readonly options: readonly TeamPickerOption[];
  readonly memberTeamIds: ReadonlySet<string>;
}): TeamPartition {
  return {
    yourTeams: options.filter((option) => memberTeamIds.has(option.id)),
    otherTeams: options.filter((option) => !memberTeamIds.has(option.id)),
  };
}

function TeamRowItem({
  option,
  selectedTeamId,
}: {
  readonly option: TeamPickerOption;
  readonly selectedTeamId: string | null;
}) {
  return (
    <ComboboxOption selected={option.id === selectedTeamId} shortcut={null} value={option.id}>
      <TeamAvatar color={option.color} name={option.name} size={20} />
      <span className="truncate">{option.name}</span>
    </ComboboxOption>
  );
}

type TeamComboboxSelectorProps = {
  readonly value: string | null;
  readonly options: readonly TeamPickerOption[];
  readonly memberTeamIds: ReadonlySet<string>;
  readonly onValueChange: (value: string) => void;
  readonly trigger: ReactNode;
  readonly disabled?: boolean;
  readonly openRef?: MutableRefObject<(() => void) | null>;
};

/**
 * Linear-style Team picker, sectioned into "Your teams" and "Other teams".
 * Selecting a Team is required — there is no "No team" row.
 */
export function TeamComboboxSelector({
  value,
  options,
  memberTeamIds,
  onValueChange,
  trigger,
  disabled = false,
  openRef,
}: TeamComboboxSelectorProps) {
  const partition = useMemo(
    () => partitionTeams({ options, memberTeamIds }),
    [options, memberTeamIds],
  );
  const items = useMemo(() => options.map((option) => option.id), [options]);
  const labelFor = useMemo(() => {
    const lookup = new Map(options.map((option) => [option.id, option.name]));
    return (candidate: string) => lookup.get(candidate) ?? candidate;
  }, [options]);
  const [open, setOpen] = usePickerOpener(openRef, disabled);

  const select = (next: string | null) => {
    if (!next) return;
    onValueChange(next);
    setOpen(false);
  };

  return (
    <Combobox<string>
      disabled={disabled}
      items={items}
      itemToStringLabel={labelFor}
      onOpenChange={setOpen}
      onValueChange={(next) => select(next ?? null)}
      open={open}
      value={value ?? ""}
    >
      <ComboboxPrimitive.Trigger
        aria-label="Change team"
        className="inline-flex cursor-pointer items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
        data-slot="card-combobox-trigger"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {trigger}
      </ComboboxPrimitive.Trigger>
      <PickerPopup popupProps={{ onClick: (event) => event.stopPropagation() }} width="lg">
        <PickerHeader placeholder="Change team..." shortcut="T" />
        <ComboboxEmpty>No teams.</ComboboxEmpty>
        <ComboboxList>
          {partition.yourTeams.length > 0 ? (
            <ComboboxGroup>
              <ComboboxGroupLabel>Your teams</ComboboxGroupLabel>
              {partition.yourTeams.map((option) => (
                <TeamRowItem key={option.id} option={option} selectedTeamId={value} />
              ))}
            </ComboboxGroup>
          ) : null}
          {partition.otherTeams.length > 0 ? (
            <ComboboxGroup>
              <ComboboxGroupLabel>Other teams</ComboboxGroupLabel>
              {partition.otherTeams.map((option) => (
                <TeamRowItem key={option.id} option={option} selectedTeamId={value} />
              ))}
            </ComboboxGroup>
          ) : null}
        </ComboboxList>
      </PickerPopup>
    </Combobox>
  );
}
