import {
  Ban,
  Check,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleUserRound,
  LoaderCircle,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Triangle,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
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
  ComboboxPrimitive,
} from "@/components/ui/combobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { TaskBoardTaskState } from "./task-kanban-adapter";

// --- Priority (stubbed: local-only, no backend yet) -------------------------

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

// --- Size / estimate (stubbed: local-only, no backend yet) ------------------

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

// --- Labels (stubbed: local-only, no backend yet) ----------------------------

export type TaskLabelMeta = {
  readonly value: string;
  readonly label: string;
  // Tailwind background class for the label's colored dot.
  readonly dotClassName: string;
};

// Starter label set for church work. Labels are UI-only until the data model
// grows a labels concept; the picker reads from this list.
export const TASK_LABEL_OPTIONS: readonly TaskLabelMeta[] = [
  { value: "worship", label: "Worship", dotClassName: "bg-purple-500" },
  { value: "kids_youth", label: "Kids & Youth", dotClassName: "bg-orange-500" },
  { value: "outreach", label: "Outreach", dotClassName: "bg-green-500" },
  { value: "events", label: "Events", dotClassName: "bg-blue-500" },
  { value: "facilities", label: "Facilities", dotClassName: "bg-amber-500" },
  { value: "communications", label: "Communications", dotClassName: "bg-pink-500" },
  { value: "admin", label: "Admin", dotClassName: "bg-gray-500" },
];

export function getTaskLabelMeta(value: string): TaskLabelMeta | null {
  return TASK_LABEL_OPTIONS.find((option) => option.value === value) ?? null;
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

function ShortcutHint({ shortcut }: { readonly shortcut: string | null }) {
  if (!shortcut) return null;
  return (
    <kbd className="flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-medium text-[0.625rem] text-muted-foreground">
      {shortcut}
    </kbd>
  );
}

/**
 * A single picker row used by the assignee and priority pickers. Unlike the
 * shared `ComboboxItem`, it has no leading check indicator column — Linear
 * shows a single trailing check on the selected row, and the digit shortcut on
 * the others.
 */
function ShortcutComboboxItem({
  value,
  selected,
  shortcut,
  children,
}: {
  readonly value: string;
  readonly selected: boolean;
  readonly shortcut: string | null;
  readonly children: ReactNode;
}) {
  return (
    <ComboboxPrimitive.Item
      className="flex min-h-8 cursor-default items-center gap-2 rounded-sm py-1 ps-2 pe-2 text-base outline-none data-disabled:pointer-events-none data-disabled:opacity-64 data-highlighted:bg-accent data-highlighted:text-accent-foreground sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"
      data-slot="combobox-item"
      value={value}
    >
      {children}
      <span className="ms-auto flex shrink-0 items-center gap-2">
        <Check className={cn("size-4 text-foreground", selected ? undefined : "invisible")} />
        <ShortcutHint shortcut={shortcut} />
      </span>
    </ComboboxPrimitive.Item>
  );
}

/**
 * The search header shared by every card picker: a filter input plus the
 * field's open-shortcut kbd. The kbd sits in the same trailing column as each
 * row's digit (an invisible check spacer mirrors the rows' check column, and
 * the padding matches), so the header hint lines up vertically with the row
 * shortcuts. A bottom border separates the header from the list (Linear-style).
 */
function PickerHeader({
  placeholder,
  shortcut,
  inputProps,
}: {
  readonly placeholder: string;
  readonly shortcut: string;
  readonly inputProps?: ComponentProps<typeof ComboboxPrimitive.Input>;
}) {
  return (
    // Full-bleed bottom border (Linear-style): the inset lives in padding, not
    // margin, so the divider spans the whole popup width.
    <div className="mt-1 mb-1 flex items-center gap-2 border-b ps-1 pe-3 pb-1">
      <ComboboxPrimitive.Input
        className="h-8 min-w-0 flex-1 rounded-md border-0 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
        placeholder={placeholder}
        {...inputProps}
      />
      <span className="flex shrink-0 items-center gap-2">
        {/* Invisible check spacer keeps the kbd aligned with the rows' digit
            column, which sits to the right of each row's check. */}
        <Check aria-hidden className="invisible size-4" />
        <ShortcutHint shortcut={shortcut} />
      </span>
    </div>
  );
}

/**
 * Controlled open state for a card picker plus an imperative opener exposed
 * through `openRef`, so a card-level hover shortcut (e.g. "A"/"P") can open the
 * picker without focusing its trigger.
 */
function usePickerOpener(
  openRef: MutableRefObject<(() => void) | null> | undefined,
  disabled: boolean,
): readonly [boolean, (next: boolean) => void] {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!openRef) return;
    openRef.current = disabled ? null : () => setOpen(true);
    return () => {
      openRef.current = null;
    };
  }, [openRef, disabled]);

  return [open, setOpen];
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
    <ShortcutComboboxItem selected={isSelected} shortcut={row.shortcut} value={row.userId ?? ""}>
      {row.userId === null ? (
        <span className="flex size-5 items-center justify-center text-muted-foreground">
          <UserRound className="size-4" strokeWidth={1.5} />
        </span>
      ) : (
        <AssigneeAvatar assignee={{ id: row.userId, label: row.label }} size={20} />
      )}
      <span className="truncate">{row.label}</span>
    </ShortcutComboboxItem>
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
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          align={align}
          className="z-50 select-none"
          data-slot="combobox-positioner"
          side="bottom"
          sideOffset={4}
        >
          <span className="relative flex max-h-full min-w-64 max-w-(--available-width) origin-(--transform-origin) rounded-lg border bg-popover not-dark:bg-clip-padding shadow-lg/5 transition-[scale,opacity] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]">
            <ComboboxPrimitive.Popup
              className="flex max-h-[min(var(--available-height),24rem)] flex-1 flex-col text-foreground"
              data-slot="combobox-popup"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={handleShortcutKey}
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
                      <AssigneeRowItem
                        key={row.userId ?? "none"}
                        row={row}
                        selectedUserId={value}
                      />
                    ))}
                  </ComboboxGroup>
                ) : null}
                {partition.otherMembers.length > 0 ? (
                  <ComboboxGroup>
                    <ComboboxGroupLabel>Members</ComboboxGroupLabel>
                    {partition.otherMembers.map((row) => (
                      <AssigneeRowItem
                        key={row.userId ?? "none"}
                        row={row}
                        selectedUserId={value}
                      />
                    ))}
                  </ComboboxGroup>
                ) : null}
              </ComboboxList>
            </ComboboxPrimitive.Popup>
          </span>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
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
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          align="start"
          className="z-50 select-none"
          data-slot="combobox-positioner"
          side="bottom"
          sideOffset={4}
        >
          <span className="relative flex max-h-full min-w-56 max-w-(--available-width) origin-(--transform-origin) rounded-lg border bg-popover not-dark:bg-clip-padding shadow-lg/5 transition-[scale,opacity] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]">
            <ComboboxPrimitive.Popup
              className="flex max-h-[min(var(--available-height),24rem)] flex-1 flex-col text-foreground"
              data-slot="combobox-popup"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={handleShortcutKey}
            >
              <PickerHeader placeholder="Change priority to..." shortcut="P" />
              <ComboboxEmpty>No results.</ComboboxEmpty>
              <ComboboxList>
                {rows.map((row) => {
                  const meta = getPriorityMeta(row.value);
                  const Icon = meta.icon;
                  return (
                    <ShortcutComboboxItem
                      key={row.value}
                      selected={row.value === value}
                      shortcut={row.shortcut}
                      value={row.value}
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center">
                        <Icon className={cn("size-4", meta.className)} />
                      </span>
                      <span className="truncate">{meta.label}</span>
                    </ShortcutComboboxItem>
                  );
                })}
              </ComboboxList>
            </ComboboxPrimitive.Popup>
          </span>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
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
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          align="start"
          className="z-50 select-none"
          data-slot="combobox-positioner"
          side="bottom"
          sideOffset={4}
        >
          <span className="relative flex max-h-full min-w-56 max-w-(--available-width) origin-(--transform-origin) rounded-lg border bg-popover not-dark:bg-clip-padding shadow-lg/5 transition-[scale,opacity] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]">
            <ComboboxPrimitive.Popup
              className="flex max-h-[min(var(--available-height),24rem)] flex-1 flex-col text-foreground"
              data-slot="combobox-popup"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={handleShortcutKey}
            >
              <PickerHeader placeholder="Change status..." shortcut="S" />
              <ComboboxEmpty>{emptyText}</ComboboxEmpty>
              <ComboboxList>
                {rows.map((row) => (
                  <ShortcutComboboxItem
                    key={row.value}
                    selected={row.value === value}
                    shortcut={row.shortcut}
                    value={row.value}
                  >
                    {row.icon ? (
                      <span className="flex size-4 shrink-0 items-center justify-center">
                        {row.icon}
                      </span>
                    ) : null}
                    <span className="truncate">{row.label}</span>
                  </ShortcutComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxPrimitive.Popup>
          </span>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </Combobox>
  );
}

// --- Estimate / size picker (Linear-style, flat list) -----------------------

type EstimateComboboxSelectorProps = {
  readonly value: TaskEstimate;
  readonly onValueChange: (value: TaskEstimate) => void;
  readonly trigger: ReactNode;
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
        aria-label="Change estimate"
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
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          align="start"
          className="z-50 select-none"
          data-slot="combobox-positioner"
          side="bottom"
          sideOffset={4}
        >
          <span className="relative flex max-h-full min-w-56 max-w-(--available-width) origin-(--transform-origin) rounded-lg border bg-popover not-dark:bg-clip-padding shadow-lg/5 transition-[scale,opacity] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]">
            <ComboboxPrimitive.Popup
              className="flex max-h-[min(var(--available-height),24rem)] flex-1 flex-col text-foreground"
              data-slot="combobox-popup"
              onClick={(event) => event.stopPropagation()}
            >
              <PickerHeader placeholder="Change estimate to..." shortcut="⇧ E" />
              <ComboboxEmpty>No results.</ComboboxEmpty>
              <ComboboxList>
                {ESTIMATE_OPTIONS.map((option) => (
                  <ShortcutComboboxItem
                    key={option.value}
                    selected={option.value === value}
                    shortcut={null}
                    value={option.value}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      <Triangle className="size-3.5" />
                    </span>
                    <span className="truncate">{option.label}</span>
                  </ShortcutComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxPrimitive.Popup>
          </span>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </Combobox>
  );
}

// --- Labels picker (Linear-style, multi-select) ------------------------------

type LabelsComboboxSelectorProps = {
  readonly value: readonly string[];
  readonly onValueChange: (value: readonly string[]) => void;
  readonly trigger: ReactNode;
  readonly disabled?: boolean;
  // Populated by the parent so an "L" hover/dialog shortcut can open the
  // picker without focusing the trigger.
  readonly openRef?: MutableRefObject<(() => void) | null>;
};

/**
 * Linear-style labels picker. A multi-select list of labels with a leading
 * colored dot and a check on every selected row; the popup stays open across
 * selections. Pressing "L" on the trigger opens the picker.
 */
export function LabelsComboboxSelector({
  value,
  onValueChange,
  trigger,
  disabled = false,
  openRef,
}: LabelsComboboxSelectorProps) {
  const items = useMemo(() => TASK_LABEL_OPTIONS.map((option) => option.value), []);
  const labelFor = (candidate: string) => getTaskLabelMeta(candidate)?.label ?? candidate;
  const [open, setOpen] = usePickerOpener(openRef, disabled);

  return (
    <Combobox<string, true>
      disabled={disabled}
      items={items}
      itemToStringLabel={labelFor}
      multiple
      onOpenChange={setOpen}
      onValueChange={(next) => onValueChange(next ?? [])}
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
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          align="start"
          className="z-50 select-none"
          data-slot="combobox-positioner"
          side="bottom"
          sideOffset={4}
        >
          <span className="relative flex max-h-full min-w-56 max-w-(--available-width) origin-(--transform-origin) rounded-lg border bg-popover not-dark:bg-clip-padding shadow-lg/5 transition-[scale,opacity] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]">
            <ComboboxPrimitive.Popup
              className="flex max-h-[min(var(--available-height),24rem)] flex-1 flex-col text-foreground"
              data-slot="combobox-popup"
              onClick={(event) => event.stopPropagation()}
            >
              <PickerHeader placeholder="Add labels..." shortcut="L" />
              <ComboboxEmpty>No labels.</ComboboxEmpty>
              <ComboboxList>
                {TASK_LABEL_OPTIONS.map((option) => (
                  <ShortcutComboboxItem
                    key={option.value}
                    selected={value.includes(option.value)}
                    shortcut={null}
                    value={option.value}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      <span className={cn("size-2.5 rounded-full", option.dotClassName)} />
                    </span>
                    <span className="truncate">{option.label}</span>
                  </ShortcutComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxPrimitive.Popup>
          </span>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
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
    <ShortcutComboboxItem selected={option.id === selectedTeamId} shortcut={null} value={option.id}>
      <TeamAvatar color={option.color} name={option.name} size={20} />
      <span className="truncate">{option.name}</span>
    </ShortcutComboboxItem>
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
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          align="start"
          className="z-50 select-none"
          data-slot="combobox-positioner"
          side="bottom"
          sideOffset={4}
        >
          <span className="relative flex max-h-full min-w-64 max-w-(--available-width) origin-(--transform-origin) rounded-lg border bg-popover not-dark:bg-clip-padding shadow-lg/5 transition-[scale,opacity] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]">
            <ComboboxPrimitive.Popup
              className="flex max-h-[min(var(--available-height),24rem)] flex-1 flex-col text-foreground"
              data-slot="combobox-popup"
              onClick={(event) => event.stopPropagation()}
            >
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
            </ComboboxPrimitive.Popup>
          </span>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </Combobox>
  );
}
