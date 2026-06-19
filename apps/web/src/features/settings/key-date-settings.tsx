import type { KeyDatePreset, KeyDateRule } from "@church-task/domain";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarDays, Check, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { type ReactNode, useMemo, useRef, useState } from "react";

import { SettingsColumnHeader, SettingsTable } from "@/components/collections/settingsTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import {
  describeKeyDateSchedule,
  formatKeyDateOccurrence,
  KEY_DATE_PRESET_OPTIONS,
  keyDateKindLabel,
  useCreateKeyDate,
  useDeleteKeyDate,
  useKeyDatesCollection,
  useUpdateKeyDate,
  type KeyDateItem,
  type KeyDateScheduleKind,
} from "@/data/templates/keyDatesData.app";
import { cn } from "@/lib/utils";

type KeyDateMutationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: { readonly message: string } };

const slugifyKey = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "key-date";

export function SettingsKeyDatesPanel({
  embedded = false,
}: {
  /**
   * When embedded inside a host surface that already renders its own page
   * heading (e.g. the Templates page), suppress the panel's own h1/description
   * so the page never stacks two headings.
   */
  readonly embedded?: boolean;
} = {}) {
  const { currentOrgOpt: activeChurch, loading } = useCurrentOrgOpt();
  const keyDates = useKeyDatesCollection({ churchId: activeChurch?.id ?? null });
  const canManage = activeChurch?.role === "owner" || activeChurch?.role === "admin";

  return (
    <KeyDatesSettingsPanel
      canManage={canManage}
      churchId={activeChurch?.id ?? null}
      embedded={embedded}
      hasChurch={Boolean(activeChurch) || loading}
      keyDates={keyDates.keyDatesCollection}
      loading={loading || keyDates.loading}
    />
  );
}

/**
 * Linear-style Key Dates settings. A single framed pane with a description, a
 * search + "New Key Date" toolbar, then a dense table of the Church's Key
 * Dates: name, how it recurs, and its next occurrence, with inline rename, a
 * schedule editor popover, and a per-row "..." menu. Key Dates are
 * owner/admin-managed (see CONTEXT.md "Key Date"); non-managers get a read-only
 * view.
 */
function KeyDatesSettingsPanel({
  canManage,
  churchId,
  embedded,
  hasChurch,
  keyDates,
  loading,
}: {
  readonly canManage: boolean;
  readonly churchId: string | null;
  readonly embedded: boolean;
  readonly hasChurch: boolean;
  readonly keyDates: readonly KeyDateItem[];
  readonly loading: boolean;
}) {
  const createKeyDate = useCreateKeyDate();
  const updateKeyDate = useUpdateKeyDate();
  const deleteKeyDate = useDeleteKeyDate();

  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (mutation: () => Promise<KeyDateMutationResult>): Promise<boolean> => {
    setError(null);
    const result = await mutation();
    if (!result.ok) {
      setError(result.error?.message ?? "Could not update Key Dates.");
      return false;
    }
    return true;
  };

  const usedKeys = useMemo(() => new Set(keyDates.map((keyDate) => keyDate.key)), [keyDates]);

  const uniqueKeyFor = (name: string, ignore?: string) => {
    const base = slugifyKey(name);
    if (!usedKeys.has(base) || base === ignore) return base;
    for (let bump = 2; ; bump += 1) {
      const candidate = `${base}-${bump}`;
      if (!usedKeys.has(candidate) || candidate === ignore) return candidate;
    }
  };

  const columns = useMemo<Array<ColumnDef<KeyDateItem>>>(
    () => [
      {
        accessorKey: "name",
        cell: ({ row }) => {
          const keyDate = row.original;
          return editingId === keyDate.id ? (
            <KeyDateNameInput
              defaultValue={keyDate.name}
              onCancel={() => setEditingId(null)}
              onSubmit={(name) => {
                setEditingId(null);
                if (!churchId || name === keyDate.name) return;
                void run(() =>
                  updateKeyDate({
                    churchId,
                    key: uniqueKeyFor(name, keyDate.key),
                    keyDateId: keyDate.id,
                    name,
                    schedule: keyDate.schedule,
                  }),
                );
              }}
            />
          ) : (
            <button
              className={cn(
                "flex h-8 w-56 items-center gap-2 truncate rounded-lg border border-transparent px-2.5 text-left text-sm transition-colors",
                canManage && "hover:border-input hover:bg-background hover:shadow-xs",
              )}
              disabled={!canManage}
              onClick={() => setEditingId(keyDate.id)}
              type="button"
            >
              <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{keyDate.name}</span>
            </button>
          );
        },
        header: ({ column }) => <SettingsColumnHeader column={column}>Name</SettingsColumnHeader>,
        id: "name",
      },
      {
        accessorFn: (keyDate) => describeKeyDateSchedule(keyDate.schedule),
        cell: ({ row }) => {
          const keyDate = row.original;
          return (
            <ScheduleCell
              canManage={canManage}
              onChange={(schedule) => {
                if (!churchId) return;
                void run(() =>
                  updateKeyDate({
                    churchId,
                    key: keyDate.key,
                    keyDateId: keyDate.id,
                    name: keyDate.name,
                    schedule,
                  }),
                );
              }}
              schedule={keyDate.schedule}
            />
          );
        },
        header: ({ column }) => <SettingsColumnHeader column={column}>Recurs</SettingsColumnHeader>,
        id: "schedule",
        meta: { className: "w-64" },
      },
      {
        accessorFn: (keyDate) => keyDate.nextOccurrence ?? "",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
            {formatKeyDateOccurrence(row.original.nextOccurrence)}
          </span>
        ),
        header: ({ column }) => (
          <SettingsColumnHeader column={column}>Next occurrence</SettingsColumnHeader>
        ),
        id: "nextOccurrence",
        meta: { className: "w-44" },
      },
    ],
    [canManage, churchId, editingId, updateKeyDate, uniqueKeyFor],
  );

  const createNewKeyDate = (name: string, schedule: KeyDateRule) => {
    setCreating(false);
    const trimmed = name.trim();
    if (!churchId || !trimmed) return;
    void run(() =>
      createKeyDate({ churchId, key: uniqueKeyFor(trimmed), name: trimmed, schedule }),
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {embedded ? null : (
        <div className="flex flex-col gap-1">
          <h1 className="font-semibold text-2xl tracking-tight">Key Dates</h1>
          <p className="text-muted-foreground text-sm">
            Named dates with planning significance — Easter, Christmas, a church anniversary.
            Templates can schedule work around them.
            {canManage ? null : " Only owners and admins can change Key Dates."}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            onChange={(event) => setFilter(event.currentTarget.value)}
            placeholder="Filter by name..."
            value={filter}
          />
        </div>
        {canManage ? (
          <Button
            disabled={!churchId || creating}
            onClick={() => {
              setError(null);
              setCreating(true);
            }}
            type="button"
          >
            <Plus />
            New Key Date
          </Button>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!hasChurch ? (
        <p className="text-muted-foreground text-sm">No active Church selected.</p>
      ) : (
        <SettingsTable<KeyDateItem>
          columnsDef={columns}
          data={keyDates}
          emptyState={
            <Empty className="min-h-40">
              <EmptyHeader>
                <EmptyTitle>No Key Dates yet</EmptyTitle>
                <EmptyDescription>
                  {canManage
                    ? "Add Easter, Christmas, or any date your Church plans around."
                    : "An owner or admin can add the dates your Church plans around."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          }
          getRowId={(keyDate) => keyDate.id}
          globalFilter={filter}
          initialSorting={[{ desc: false, id: "name" }]}
          leadingRow={
            creating ? (
              <NewKeyDateRow onCancel={() => setCreating(false)} onSubmit={createNewKeyDate} />
            ) : null
          }
          loading={loading}
          rowActions={
            canManage
              ? (keyDate) => (
                  <KeyDateRowActions
                    onDelete={() => {
                      if (!churchId) return;
                      void run(() => deleteKeyDate({ churchId, keyDateId: keyDate.id }));
                    }}
                    onRename={() => setEditingId(keyDate.id)}
                  />
                )
              : undefined
          }
        />
      )}
    </div>
  );
}

/** The inline "create a Key Date" row pinned to the top of the table body. */
function NewKeyDateRow({
  onSubmit,
  onCancel,
}: {
  readonly onSubmit: (name: string, schedule: KeyDateRule) => void;
  readonly onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState<KeyDateRule>(defaultScheduleForKind("computedYearly"));

  return (
    <tr className="bg-muted/40">
      <td className="h-16 rounded-lg pr-3 pl-3 align-middle" colSpan={4}>
        <div className="flex flex-wrap items-center gap-3">
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
          <KeyDateNameInput
            autoFocus
            defaultValue=""
            onCancel={onCancel}
            onSubmit={(committed) => onSubmit(committed, schedule)}
            onValueChange={setName}
            placeholder="Key Date name"
            value={name}
          />
          <ScheduleEditor onChange={setSchedule} schedule={schedule} />
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={onCancel} size="sm" type="button" variant="ghost">
              Cancel
            </Button>
            <Button
              disabled={!name.trim()}
              onClick={() => onSubmit(name, schedule)}
              size="sm"
              type="button"
            >
              Add
            </Button>
          </div>
        </div>
      </td>
    </tr>
  );
}

/** A text field that commits on Enter/blur and cancels on Escape. */
function KeyDateNameInput({
  defaultValue,
  onSubmit,
  onCancel,
  placeholder = "Key Date name",
  autoFocus = true,
  value,
  onValueChange,
}: {
  readonly defaultValue: string;
  readonly onSubmit: (name: string) => void;
  readonly onCancel: () => void;
  readonly placeholder?: string;
  readonly autoFocus?: boolean;
  readonly value?: string;
  readonly onValueChange?: (value: string) => void;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const committed = useRef(false);
  const current = value ?? internal;

  const setCurrent = (next: string) => {
    if (onValueChange) onValueChange(next);
    else setInternal(next);
  };

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    const trimmed = current.trim();
    if (trimmed) onSubmit(trimmed);
    else onCancel();
  };

  return (
    <Input
      // biome-ignore lint/a11y/noAutofocus: inline edit affordance
      autoFocus={autoFocus}
      className="h-8 w-56"
      onBlur={commit}
      onChange={(event) => setCurrent(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          committed.current = true;
          onCancel();
        }
      }}
      placeholder={placeholder}
      value={current}
    />
  );
}

/** A read-only schedule summary that opens the schedule editor when managed. */
function ScheduleCell({
  schedule,
  onChange,
  canManage,
}: {
  readonly schedule: KeyDateRule;
  readonly onChange: (schedule: KeyDateRule) => void;
  readonly canManage: boolean;
}) {
  if (!canManage) {
    return (
      <span className="text-muted-foreground text-sm">{describeKeyDateSchedule(schedule)}</span>
    );
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            className={cn(
              "flex h-8 items-center rounded-lg border border-transparent px-2.5 text-left text-muted-foreground text-sm transition-colors",
              "hover:border-input hover:bg-background hover:text-foreground hover:shadow-xs",
            )}
            type="button"
          />
        }
      >
        {describeKeyDateSchedule(schedule)}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-3 p-3">
        <p className="font-medium text-sm">Schedule</p>
        <ScheduleEditor onChange={onChange} schedule={schedule} />
      </PopoverContent>
    </Popover>
  );
}

const KEY_DATE_KINDS: readonly KeyDateScheduleKind[] = ["computedYearly", "fixedYearly", "oneTime"];

const defaultScheduleForKind = (kind: KeyDateScheduleKind): KeyDateRule => {
  if (kind === "computedYearly") return { kind: "computedYearly", rule: "easter" };
  if (kind === "fixedYearly") return { day: 25, kind: "fixedYearly", month: 12 };
  return { kind: "oneTime", localDate: new Date().toISOString().slice(0, 10) };
};

/**
 * The schedule authoring control shared by the create row and the per-row
 * schedule editor: a kind picker (Preset / Fixed annual / One-off) followed by
 * the inputs for the chosen kind.
 */
function ScheduleEditor({
  schedule,
  onChange,
}: {
  readonly schedule: KeyDateRule;
  readonly onChange: (schedule: KeyDateRule) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
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
            onClick={() => onChange(defaultScheduleForKind(kind))}
            type="button"
          >
            {keyDateKindLabel(kind)}
          </button>
        ))}
      </div>

      {schedule.kind === "computedYearly" ? (
        <PresetPicker
          onChange={(rule) => onChange({ kind: "computedYearly", rule })}
          rule={schedule.rule}
        />
      ) : schedule.kind === "fixedYearly" ? (
        <FixedAnnualPicker
          day={schedule.day}
          month={schedule.month}
          onChange={(month, day) => onChange({ day, kind: "fixedYearly", month })}
        />
      ) : (
        <Input
          aria-label="One-off date"
          className="h-8 w-44"
          onChange={(event) =>
            onChange({
              kind: "oneTime",
              localDate: event.currentTarget.value || schedule.localDate,
            })
          }
          type="date"
          value={schedule.localDate}
        />
      )}
    </div>
  );
}

function PresetPicker({
  rule,
  onChange,
}: {
  readonly rule: KeyDatePreset;
  readonly onChange: (rule: KeyDatePreset) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {KEY_DATE_PRESET_OPTIONS.map((option) => (
        <button
          className={cn(
            "flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors",
            option.rule === rule
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:bg-muted",
          )}
          key={option.rule}
          onClick={() => onChange(option.rule)}
          type="button"
        >
          <span className="truncate">{option.label}</span>
          {option.rule === rule ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
        </button>
      ))}
    </div>
  );
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const daysInMonth = (month: number) => new Date(Date.UTC(2024, month, 0)).getUTCDate();

function FixedAnnualPicker({
  month,
  day,
  onChange,
}: {
  readonly month: number;
  readonly day: number;
  readonly onChange: (month: number, day: number) => void;
}) {
  const maxDay = daysInMonth(month);
  const clampedDay = Math.min(day, maxDay);

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Month"
        className="h-8 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        onChange={(event) => {
          const nextMonth = Number(event.currentTarget.value);
          onChange(nextMonth, Math.min(clampedDay, daysInMonth(nextMonth)));
        }}
        value={month}
      >
        {MONTHS.map((name, index) => (
          <option key={name} value={index + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="Day"
        className="h-8 w-20 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        onChange={(event) => onChange(month, Number(event.currentTarget.value))}
        value={clampedDay}
      >
        {Array.from({ length: maxDay }, (_, index) => index + 1).map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </div>
  );
}

/** The trailing per-row "..." actions menu. */
function KeyDateRowActions({
  onRename,
  onDelete,
}: {
  readonly onRename: () => void;
  readonly onDelete: () => void;
}): ReactNode {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Open Key Date actions"
            className="opacity-0 group-hover/row:opacity-100 aria-expanded:opacity-100"
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-44"
        onKeyDown={(event) => {
          if (
            event.key.toLowerCase() === "e" &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.altKey
          ) {
            event.preventDefault();
            setOpen(false);
            onRename();
          }
        }}
        side="bottom"
      >
        <DropdownMenuItem className="whitespace-nowrap" onClick={onRename}>
          <Pencil />
          Rename Key Date
          <DropdownMenuShortcut>
            <Kbd>E</Kbd>
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} variant="destructive">
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
