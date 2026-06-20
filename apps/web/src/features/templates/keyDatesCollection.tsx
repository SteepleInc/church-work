import type { KeyDateRule } from "@church-task/domain";
import type { ColumnDef } from "@tanstack/react-table";
import { Array, Option, pipe } from "effect";
import { CalendarDays, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Collection } from "@/components/collections/collection";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import {
  type KeyDatesColumnContext,
  keyDatesColumnsDef,
} from "@/data/templates/keyDatesCollectionDef";
import {
  type KeyDateItem,
  useCreateKeyDate,
  useDeleteKeyDate,
  useKeyDatesCollectionWithFilters,
  useUpdateKeyDate,
} from "@/data/templates/keyDatesData.app";
import {
  defaultScheduleForKind,
  KeyDateNameInput,
  KeyDateRowActions,
  ScheduleEditor,
  uniqueKeyDateKey,
} from "@/features/settings/key-date-settings";
import { FilterKeys } from "@/shared/global-state";
import { useFiltersValue } from "@/shared/hooks/useFilters";

type KeyDateMutationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: { readonly message: string } };

/** Reads the name search value the toolbar writes to the URL for Key Dates. */
function useKeyDateNameFilter(): string {
  const filters = useFiltersValue(FilterKeys.KeyDates);

  return pipe(
    filters,
    Array.findFirst((filter) => filter.columnId === "name"),
    Option.flatMap((filter) => pipe(filter.values as ReadonlyArray<string>, Array.head)),
    Option.getOrElse(() => ""),
  );
}

/**
 * Key Dates rendered through the generic `Collection`, matching the Templates
 * tab: shared toolbar (search + view toggle + action), sortable column headers,
 * table and card views, and the same edge spacing. Inline rename, the schedule
 * editor popover, and per-row actions are wired through column meta; creating a
 * Key Date opens an inline form above the table.
 */
export function KeyDatesCollection() {
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const churchId = activeChurch?.id ?? null;
  const canManage = activeChurch?.role === "owner" || activeChurch?.role === "admin";

  const createKeyDate = useCreateKeyDate();
  const updateKeyDate = useUpdateKeyDate();
  const deleteKeyDate = useDeleteKeyDate();

  const nameFilter = useKeyDateNameFilter();
  const { keyDatesCollection, limit, loading, nextPage, pageSize } =
    useKeyDatesCollectionWithFilters({ churchId, nameFilter });

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (mutation: () => Promise<KeyDateMutationResult>): Promise<void> => {
    setError(null);
    const result = await mutation();
    if (!result.ok) setError(result.error?.message ?? "Could not update Key Dates.");
  };

  const usedKeys = useMemo(
    () => new Set(keyDatesCollection.map((keyDate) => keyDate.key)),
    [keyDatesCollection],
  );

  const columnContext: KeyDatesColumnContext = {
    canManage,
    editingId,
    onCancelRename: () => setEditingId(null),
    onScheduleChange: (keyDate, schedule) => {
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
    },
    onStartRename: (keyDate) => setEditingId(keyDate.id),
    onSubmitRename: (keyDate, name) => {
      setEditingId(null);
      if (!churchId || name === keyDate.name) return;
      void run(() =>
        updateKeyDate({
          churchId,
          key: uniqueKeyDateKey(usedKeys, name, keyDate.key),
          keyDateId: keyDate.id,
          name,
          schedule: keyDate.schedule,
        }),
      );
    },
  };

  const columnsDef = useMemo<Array<ColumnDef<KeyDateItem>>>(
    () =>
      keyDatesColumnsDef.map((column) => ({
        ...column,
        meta: { ...column.meta, keyDatesContext: columnContext },
      })),
    // columnContext is rebuilt every render; depend on the values it closes over
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, editingId, churchId, usedKeys, updateKeyDate],
  );

  const onCreate = (name: string, schedule: KeyDateRule) => {
    setCreating(false);
    const trimmed = name.trim();
    if (!churchId || !trimmed) return;
    void run(() =>
      createKeyDate({
        churchId,
        key: uniqueKeyDateKey(usedKeys, trimmed),
        name: trimmed,
        schedule,
      }),
    );
  };

  const newKeyDateButton = canManage ? (
    <Button
      disabled={!churchId || creating}
      onClick={() => {
        setError(null);
        setCreating(true);
      }}
      size="sm"
      type="button"
    >
      <Plus />
      New Key Date
    </Button>
  ) : undefined;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {error ? (
        <Alert className="mx-4 mb-2 w-auto md:mr-4" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {creating ? (
        <KeyDateCreateForm
          className="mx-4 mb-2 md:mr-4"
          onCancel={() => setCreating(false)}
          onSubmit={onCreate}
        />
      ) : null}

      <Collection<KeyDateItem>
        _tag="key-dates"
        Actions={newKeyDateButton}
        columnPinning={{ left: ["name"] }}
        columnsDef={columnsDef}
        data={keyDatesCollection}
        emptyState={
          <Empty className="mx-4 max-h-80 min-h-64 flex-none rounded-xl border bg-card md:mr-4">
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
        filterColumnId="name"
        filterKey={FilterKeys.KeyDates}
        filterPlaceHolder="Search Key Dates"
        limit={limit}
        loading={loading}
        nextPage={nextPage}
        pageSize={pageSize}
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
    </div>
  );
}

/** The inline "create a Key Date" form shown above the table while creating. */
function KeyDateCreateForm({
  className,
  onSubmit,
  onCancel,
}: {
  readonly className?: string;
  readonly onSubmit: (name: string, schedule: KeyDateRule) => void;
  readonly onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState<KeyDateRule>(defaultScheduleForKind("computedYearly"));

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/40 p-3">
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
    </div>
  );
}
