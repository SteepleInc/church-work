import type { ColumnDef } from "@tanstack/react-table";
import { CalendarDays } from "lucide-react";

import { ColumnHeader } from "@/components/collections/collectionComponents";
import {
  describeKeyDateSchedule,
  formatKeyDateOccurrence,
  type KeyDateItem,
} from "@/data/templates/keyDatesData.app";
import { KeyDateNameInput, ScheduleCell } from "@/features/settings/key-date-settings";
import { cn } from "@/lib/utils";

/**
 * Column context the Key Dates Collection cells need to drive inline editing.
 * The Collection's column defs are static, so per-row interactions are wired
 * through this shared, mutable-by-render context object instead of closures.
 */
export type KeyDatesColumnContext = {
  readonly canManage: boolean;
  readonly editingId: string | null;
  readonly onStartRename: (keyDate: KeyDateItem) => void;
  readonly onSubmitRename: (keyDate: KeyDateItem, name: string) => void;
  readonly onCancelRename: () => void;
  readonly onScheduleChange: (keyDate: KeyDateItem, schedule: KeyDateItem["schedule"]) => void;
};

declare module "@tanstack/react-table" {
  // biome-ignore lint/correctness/noUnusedVariables: required by the module augmentation signature
  interface ColumnMeta<TData, TValue> {
    readonly keyDatesContext?: KeyDatesColumnContext;
  }
}

export const keyDatesColumnsDef: Array<ColumnDef<KeyDateItem>> = [
  {
    accessorKey: "name",
    cell: ({ row, column }) => {
      const keyDate = row.original;
      const ctx = column.columnDef.meta?.keyDatesContext;
      if (!ctx) return null;

      if (ctx.editingId === keyDate.id) {
        return (
          <KeyDateNameInput
            defaultValue={keyDate.name}
            onCancel={ctx.onCancelRename}
            onSubmit={(name) => ctx.onSubmitRename(keyDate, name)}
          />
        );
      }

      return (
        <button
          className={cn(
            "flex h-8 min-w-0 items-center gap-2 truncate rounded-lg border border-transparent px-2.5 text-left text-sm transition-colors",
            ctx.canManage && "hover:border-input hover:bg-background hover:shadow-xs",
          )}
          disabled={!ctx.canManage}
          onClick={() => ctx.onStartRename(keyDate)}
          type="button"
        >
          <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{keyDate.name}</span>
        </button>
      );
    },
    enableHiding: false,
    header: ({ column }) => <ColumnHeader column={column}>Name</ColumnHeader>,
    id: "name",
    minSize: 220,
    size: 320,
  },
  {
    accessorFn: (keyDate) => describeKeyDateSchedule(keyDate.schedule),
    cell: ({ row, column }) => {
      const keyDate = row.original;
      const ctx = column.columnDef.meta?.keyDatesContext;
      if (!ctx) return null;
      return (
        <ScheduleCell
          canManage={ctx.canManage}
          onChange={(schedule) => ctx.onScheduleChange(keyDate, schedule)}
          schedule={keyDate.schedule}
        />
      );
    },
    enableHiding: false,
    enableSorting: false,
    header: ({ column }) => <ColumnHeader column={column}>Recurs</ColumnHeader>,
    id: "schedule",
    minSize: 200,
    size: 260,
  },
  {
    accessorFn: (keyDate) => keyDate.nextOccurrence ?? "",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground tabular-nums">
        {formatKeyDateOccurrence(row.original.nextOccurrence)}
      </span>
    ),
    enableHiding: false,
    header: ({ column }) => <ColumnHeader column={column}>Next occurrence</ColumnHeader>,
    id: "nextOccurrence",
    minSize: 180,
    size: 220,
  },
];
