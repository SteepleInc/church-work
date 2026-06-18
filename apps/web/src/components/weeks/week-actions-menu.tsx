import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatWeekDateRange, useUpdateWeekDetailsMutation } from "@/data/cycles/cyclesData.app";
import { Lock, MoreHorizontal, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { toast } from "sonner";

export type WeekActionsMenuCycle = {
  readonly id: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly name: string | null;
  readonly description: string | null;
};

const NAME_MAX_LENGTH = 80;

export function WeekActionsMenu({
  churchId,
  cycle,
  trigger,
}: {
  readonly churchId: string;
  readonly cycle: WeekActionsMenuCycle;
  // Optional custom trigger so callers can present the menu inline (e.g. a Week
  // header) while the default "⋯" button still works on its own.
  readonly trigger?: ReactElement;
}) {
  const updateWeekDetails = useUpdateWeekDetailsMutation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(cycle.name ?? "");
  const [description, setDescription] = useState(cycle.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form each time the dialog opens so a cancelled edit never
  // leaks into the next one, and so external Week changes are picked up.
  useEffect(() => {
    if (!open) return;
    setName(cycle.name ?? "");
    setDescription(cycle.description ?? "");
    setError(null);
  }, [open, cycle.name, cycle.description]);

  const dateRange = formatWeekDateRange(cycle);
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const isDirty =
    trimmedName !== (cycle.name ?? "").trim() ||
    trimmedDescription !== (cycle.description ?? "").trim();

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await updateWeekDetails({
      churchId,
      cycleId: cycle.id,
      description: trimmedDescription || null,
      name: trimmedName || null,
    });
    setSaving(false);
    if (result.ok) {
      setOpen(false);
      toast.success(trimmedName ? `“${trimmedName}” saved.` : "Week updated.");
      return;
    }
    setError(result.error.message);
  };

  return (
    <>
      <DropdownMenu>
        {trigger ? (
          <DropdownMenuTrigger aria-label="Week actions" render={trigger} />
        ) : (
          <DropdownMenuTrigger
            aria-label="Week actions"
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
        )}
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem onSelect={() => setOpen(true)}>
            <Pencil className="size-4" />
            {cycle.name ? "Rename Week…" : "Name this Week…"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Week details</DialogTitle>
            <DialogDescription>
              Give this Week a Church-wide name and description. Its Monday–Sunday dates stay fixed.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-1">
            {/* Locked dates: the Week's identity is its Monday–Sunday span, and
                that span never moves — make that immutability obvious. */}
            <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground shadow-xs">
                <Lock className="size-3.5" />
              </span>
              <div className="grid gap-0.5">
                <span className="text-sm font-medium leading-none">{dateRange}</span>
                <span className="text-xs text-muted-foreground">
                  Monday–Sunday · dates can't be changed
                </span>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="week-name">Name</Label>
                <span
                  className={cn(
                    "text-xs tabular-nums text-muted-foreground",
                    name.length > NAME_MAX_LENGTH && "text-destructive",
                  )}
                >
                  {name.length}/{NAME_MAX_LENGTH}
                </span>
              </div>
              <Input
                autoFocus
                id="week-name"
                maxLength={NAME_MAX_LENGTH}
                onChange={(event) => setName(event.target.value)}
                placeholder={dateRange}
                value={name}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to show the date range. Try “Focus on the Family — week three.”
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="week-description">Description</Label>
              <Textarea
                className="min-h-20 resize-none"
                id="week-description"
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Add planning context for this Week…"
                value={description}
              />
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <Button disabled={saving} onClick={() => setOpen(false)} type="button" variant="ghost">
              Cancel
            </Button>
            <Button disabled={!isDirty || saving} loading={saving} onClick={save} type="button">
              Save Week
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
