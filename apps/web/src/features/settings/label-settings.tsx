import {
  getLabelColorForName,
  isLabelColor,
  LABEL_COLORS,
  type LabelColor,
} from "@church-task/domain";
import type { ColumnDef } from "@tanstack/react-table";
import { format, formatDistanceToNow } from "date-fns";
import { Check, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { SettingsColumnHeader, SettingsTable } from "@/components/collections/settingsTable";
import { labelColorDotClassName, labelDotClassName } from "@/components/tasks/task-card-fields";
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
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useCreateLabelMutation,
  useDeleteLabelMutation,
  useLabelsCollection,
  useUpdateLabelMutation,
  type LabelItem,
} from "@/data/labels/labelsData.app";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { cn } from "@/lib/utils";

import { InlineNameFormInput } from "./inline-name-form-input";

type LabelMutationResult = { readonly ok: boolean; readonly error?: { readonly message: string } };

const formatCreated = (createdAt: number): string => format(new Date(createdAt), "MMM yyyy");

const formatLastApplied = (lastAppliedAt: string | null): string => {
  if (!lastAppliedAt) return "—";
  const date = new Date(lastAppliedAt);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDistanceToNow(date)} ago`;
};

export function SettingsLabelsPanel() {
  const { currentOrgOpt: activeChurch, loading } = useCurrentOrgOpt();
  const labels = useLabelsCollection({ churchId: activeChurch?.id ?? null });

  return (
    <LabelSettingsPanel
      churchId={activeChurch?.id ?? null}
      hasChurch={Boolean(activeChurch) || loading}
      labels={labels.labelsCollection}
      loading={loading || labels.loading}
    />
  );
}

/**
 * Linear-style Labels settings: the entire pane lives in a single framed card
 * with a title, a search + "New label" toolbar, then a dense table with inline
 * rename, a color-swatch picker, per-row stats (Tasks / Last applied / Created),
 * and a "..." menu. Labels are open to every Church member — deliberately not
 * role-gated (see CONTEXT.md "Label").
 */
function LabelSettingsPanel({
  churchId,
  hasChurch,
  labels,
  loading,
}: {
  readonly churchId: string | null;
  readonly hasChurch: boolean;
  readonly labels: readonly LabelItem[];
  readonly loading: boolean;
}) {
  const createLabel = useCreateLabelMutation();
  const updateLabel = useUpdateLabelMutation();
  const deleteLabel = useDeleteLabelMutation();

  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (mutation: () => Promise<LabelMutationResult>): Promise<boolean> => {
    setError(null);
    const result = await mutation();
    if (!result.ok) {
      setError(result.error?.message ?? "Could not update Labels.");
      return false;
    }
    return true;
  };

  const columns = useMemo<Array<ColumnDef<LabelItem>>>(
    () => [
      {
        accessorKey: "name",
        cell: ({ row }) => {
          const label = row.original;
          return (
            <div className="flex min-w-0 items-center gap-3">
              <LabelColorPicker
                color={label.color}
                disabled={!churchId}
                name={label.name}
                onSelect={(color) => {
                  if (!churchId) return;
                  void run(() => updateLabel({ churchId, color, labelId: label.id }));
                }}
              />
              {editingId === label.id ? (
                <LabelNameInput
                  defaultValue={label.name}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(name) => {
                    setEditingId(null);
                    if (!churchId || name === label.name) return;
                    void run(() => updateLabel({ churchId, labelId: label.id, name }));
                  }}
                />
              ) : (
                <button
                  className={cn(
                    "flex h-8 w-56 items-center truncate rounded-lg border border-transparent px-2.5 text-left text-sm transition-colors",
                    "hover:border-input hover:bg-background hover:shadow-xs",
                  )}
                  onClick={() => setEditingId(label.id)}
                  type="button"
                >
                  {label.name}
                </button>
              )}
            </div>
          );
        },
        header: ({ column }) => <SettingsColumnHeader column={column}>Name</SettingsColumnHeader>,
        id: "name",
      },
      {
        accessorFn: (label) => label.taskCount,
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {row.original.taskCount > 0 ? row.original.taskCount : "—"}
          </span>
        ),
        header: ({ column }) => <SettingsColumnHeader column={column}>Tasks</SettingsColumnHeader>,
        id: "taskCount",
        meta: { className: "w-24" },
      },
      {
        accessorFn: (label) => label.lastAppliedAt ?? "",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatLastApplied(row.original.lastAppliedAt)}
          </span>
        ),
        header: ({ column }) => (
          <SettingsColumnHeader column={column}>Last applied</SettingsColumnHeader>
        ),
        id: "lastAppliedAt",
        meta: { className: "w-36" },
      },
      {
        accessorFn: (label) => label.createdAt,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatCreated(row.original.createdAt)}
          </span>
        ),
        header: ({ column }) => (
          <SettingsColumnHeader column={column}>Created</SettingsColumnHeader>
        ),
        id: "createdAt",
        meta: { className: "w-28" },
      },
    ],
    [churchId, editingId, updateLabel],
  );

  const createNewLabel = (name: string) => {
    setCreating(false);
    const trimmed = name.trim();
    if (!churchId || !trimmed) return;
    void run(() => createLabel({ churchId, name: trimmed }));
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-semibold text-2xl tracking-tight">Labels</h1>

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
        <Button
          disabled={!churchId || creating}
          onClick={() => {
            setError(null);
            setCreating(true);
          }}
          type="button"
        >
          <Plus />
          New label
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!hasChurch ? (
        <p className="text-muted-foreground text-sm">No active Church selected.</p>
      ) : (
        <SettingsTable<LabelItem>
          columnsDef={columns}
          data={labels}
          getRowId={(label) => label.id}
          globalFilter={filter}
          initialSorting={[{ desc: false, id: "name" }]}
          leadingRow={
            creating ? (
              <NewLabelRow onCancel={() => setCreating(false)} onSubmit={createNewLabel} />
            ) : null
          }
          loading={loading}
          rowActions={(label) => (
            <LabelRowActions
              onDelete={() => {
                if (!churchId) return;
                void run(() => deleteLabel({ churchId, labelId: label.id }));
              }}
              onRename={() => setEditingId(label.id)}
            />
          )}
        />
      )}
    </div>
  );
}

/** The inline "create a Label" row pinned to the top of the table body. */
function NewLabelRow({
  onSubmit,
  onCancel,
}: {
  readonly onSubmit: (name: string) => void;
  readonly onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const color = name.trim() ? getLabelColorForName(name.trim()) : "blue";

  return (
    <tr className="bg-muted/40">
      <td className="h-11 rounded-lg pr-3 pl-3 align-middle" colSpan={5}>
        <div className="flex items-center gap-3">
          <span className={cn("size-2.5 shrink-0 rounded-full", labelColorDotClassName(color))} />
          <LabelNameInput
            autoFocus
            defaultValue=""
            onCancel={onCancel}
            onSubmit={onSubmit}
            onValueChange={setName}
            placeholder="Label name"
          />
        </div>
      </td>
    </tr>
  );
}

/** A small text field that commits on Enter/blur and cancels on Escape. */
function LabelNameInput({
  defaultValue,
  onSubmit,
  onCancel,
  placeholder = "Label name",
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

/** The color dot, which opens a popover of selectable swatches. */
function LabelColorPicker({
  color,
  name,
  onSelect,
  disabled,
}: {
  readonly color: string;
  readonly name: string;
  readonly onSelect: (color: LabelColor) => void;
  readonly disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = isLabelColor(color) ? color : getLabelColorForName(name);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        aria-label={`Change color of ${name}`}
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={disabled}
        render={<button type="button" />}
      >
        <span
          className={cn("block size-2.5 shrink-0 rounded-full", labelDotClassName({ color, name }))}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto flex-row gap-1.5 p-1.5">
        {LABEL_COLORS.map((swatch) => (
          <button
            aria-label={swatch}
            className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-muted"
            key={swatch}
            onClick={() => {
              onSelect(swatch);
              setOpen(false);
            }}
            type="button"
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-white",
                labelColorDotClassName(swatch),
              )}
            >
              {swatch === selected ? <Check className="size-3.5" /> : null}
            </span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The trailing per-row "..." actions menu. Keyboard shortcuts are scoped to the
 * open menu (Linear-style): while it is open, focus is trapped in the popup, so
 * the popup's own keydown handles "E" → rename. Nothing is bound globally.
 */
function LabelRowActions({
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
            aria-label="Open label actions"
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
          Edit label name
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
