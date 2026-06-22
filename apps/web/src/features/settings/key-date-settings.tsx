import type { KeyDateRule } from "@church-task/domain";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarDays, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

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
  useDeleteKeyDate,
  useKeyDatesCollection,
  useUpdateKeyDate,
  type KeyDateItem,
} from "@/data/templates/keyDatesData.app";
import {
  defaultScheduleForKind,
  ScheduleEditor,
  slugifyKey,
  slugifyKeyDateKey,
  uniqueKeyDateKey,
} from "@/features/settings/key-date-schedule";
import { CreateKeyDateQuickAction } from "@/features/quick-actions/create-key-date-quick-action";
import { useQuickActionOpeners } from "@/features/quick-actions/quick-actions-state";
import { cn } from "@/lib/utils";

import { InlineNameFormInput } from "./inline-name-form-input";

// Re-exported so Key Date collection surfaces can import schedule helpers from a
// single module. The implementations live in key-date-schedule.tsx, which has
// no quick-actions dependency (avoids an import cycle).
export { defaultScheduleForKind, ScheduleEditor, slugifyKeyDateKey, uniqueKeyDateKey };

type KeyDateMutationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: { readonly message: string } };

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
    <>
      <KeyDatesSettingsPanel
        canManage={canManage}
        churchId={activeChurch?.id ?? null}
        embedded={embedded}
        hasChurch={Boolean(activeChurch) || loading}
        keyDates={keyDates.keyDatesCollection}
        loading={loading || keyDates.loading}
      />
      {/* The Settings shell does not mount the global QuickActions, so the
          Create Key Date dialog is mounted here for the settings page's
          "New Key Date" button. */}
      <CreateKeyDateQuickAction />
    </>
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
  const updateKeyDate = useUpdateKeyDate();
  const deleteKeyDate = useDeleteKeyDate();
  const { openCreateKeyDate } = useQuickActionOpeners();

  const [filter, setFilter] = useState("");
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

      <div className="flex min-h-10 items-center gap-2">
        {/* biome-ignore lint/a11y/noLabelWithoutControl: search field label wraps the input */}
        <label className="relative flex w-full shrink-1 flex-row items-center gap-2 lg:max-w-64">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            className="flex-1 rounded-full px-9!"
            onChange={(event) => setFilter(event.currentTarget.value)}
            placeholder="Search Key Dates"
            value={filter}
          />
        </label>
        {canManage ? (
          <Button
            className="ml-auto"
            disabled={!churchId}
            onClick={() => {
              if (!churchId) return;
              setError(null);
              openCreateKeyDate({ churchId });
            }}
            size="sm"
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

/** A text field that commits on Enter/blur and cancels on Escape. */
export function KeyDateNameInput({
  defaultValue,
  onSubmit,
  onCancel,
  placeholder = "Key Date name",
  autoFocus = true,
  onValueChange,
}: {
  readonly defaultValue: string;
  readonly onSubmit: (name: string) => void;
  readonly onCancel: () => void;
  readonly placeholder?: string;
  readonly autoFocus?: boolean;
  readonly onValueChange?: (value: string) => void;
}) {
  return (
    <InlineNameFormInput
      autoFocus={autoFocus}
      defaultValue={defaultValue}
      onCancel={onCancel}
      onSubmit={onSubmit}
      onValueChange={onValueChange}
      placeholder={placeholder}
    />
  );
}

/** A read-only schedule summary that opens the schedule editor when managed. */
export function ScheduleCell({
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

/** The trailing per-row "..." actions menu. */
export function KeyDateRowActions({
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
