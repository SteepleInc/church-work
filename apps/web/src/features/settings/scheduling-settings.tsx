import { Alert02Icon, Calendar03Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrgOpt, type CurrentOrg } from "@/data/orgs/orgData.app";
import { SettingsFieldRow, SettingsSection } from "@/features/settings/settings-page";
import { authClient } from "@/lib/auth-client";

/** The Rolling Materialization Window is constrained to 1 through 52 Cycles. */
const MIN_WINDOW_CYCLES = 1;
const MAX_WINDOW_CYCLES = 52;
const DEFAULT_WINDOW_CYCLES = 3;

function windowLabel(cycles: number): string {
  return cycles === 1 ? "1 Week" : `${cycles} Weeks`;
}

const WINDOW_OPTIONS: readonly { readonly label: string; readonly value: string }[] = Array.from(
  { length: MAX_WINDOW_CYCLES - MIN_WINDOW_CYCLES + 1 },
  (_, index) => {
    const cycles = MIN_WINDOW_CYCLES + index;
    return { label: windowLabel(cycles), value: String(cycles) };
  },
);

function clampWindow(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_WINDOW_CYCLES;
  return Math.min(MAX_WINDOW_CYCLES, Math.max(MIN_WINDOW_CYCLES, Math.round(value)));
}

function canUpdateChurchSettings(role: string | string[]): boolean {
  return Array.isArray(role)
    ? role.includes("owner") || role.includes("admin")
    : role === "owner" || role === "admin";
}

export function SettingsSchedulingPanel() {
  const { currentOrgOpt: activeChurch, loading } = useCurrentOrgOpt();

  if (loading) {
    return <SchedulingSkeleton />;
  }

  if (!activeChurch) {
    return <p className="text-muted-foreground text-sm">No active Church selected.</p>;
  }

  return <SchedulingForm activeChurch={activeChurch} />;
}

function SchedulingSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5 px-0.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-56" />
      </div>
      <div className="rounded-lg border border-border/70 bg-card px-5">
        <div className="flex items-center justify-between gap-6 py-3.5">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-8 w-[17.5rem]" />
        </div>
      </div>
    </div>
  );
}

function SchedulingForm({ activeChurch }: { readonly activeChurch: CurrentOrg }) {
  const { refetch: refetchSession } = authClient.useSession();
  const canUpdate = canUpdateChurchSettings(activeChurch.role);

  const savedWindow = clampWindow(activeChurch.rollingMaterializationWindowCycles);
  const [draftWindow, setDraftWindow] = useState(savedWindow);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isDirty = draftWindow !== savedWindow;
  const isExpanding = draftWindow > savedWindow;
  const addedCycles = draftWindow - savedWindow;

  const summary = useMemo(() => {
    if (savedWindow === 1) {
      return "Scheduled Template work becomes real Tasks one Week ahead.";
    }

    return `Scheduled Template work becomes real Tasks up to ${savedWindow} Weeks ahead.`;
  }, [savedWindow]);

  async function persist(nextWindow: number) {
    setSaving(true);
    setError(null);

    const result = await authClient.organization.update({
      data: { rollingMaterializationWindowCycles: nextWindow },
      organizationId: activeChurch.id,
    });

    setSaving(false);

    if (result.error) {
      setError(result.error.message ?? "Could not update the Rolling Materialization Window.");
      return;
    }

    setConfirmOpen(false);
    await refetchSession();
    toast.success(
      nextWindow === 1
        ? "Now materializing scheduled work 1 Week ahead."
        : `Now materializing scheduled work ${nextWindow} Weeks ahead.`,
    );
  }

  function handleSave() {
    if (!isDirty) return;
    // Expanding the window materializes more future Projected Template Tasks
    // into real Tasks, so confirm before the irreversible bulk creation.
    if (isExpanding) {
      setConfirmOpen(true);
      return;
    }

    void persist(draftWindow);
  }

  function handleDiscard() {
    setDraftWindow(savedWindow);
    setError(null);
  }

  return (
    <>
      <SettingsSection
        card
        description="How far ahead Church Task turns scheduled Template work into real, actionable Tasks."
        title="Materialization"
      >
        <SettingsFieldRow
          align="start"
          control={
            <fieldset className="contents" disabled={!canUpdate}>
              <Select
                items={WINDOW_OPTIONS}
                onValueChange={(value) => setDraftWindow(clampWindow(Number(value)))}
                value={String(draftWindow)}
              >
                <SelectTrigger className="w-full" id="rolling-materialization-window">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {WINDOW_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isExpanding ? (
                <div className="flex flex-col gap-1">
                  <p className="text-muted-foreground text-xs">
                    Currently materializing {windowLabel(savedWindow).toLowerCase()} ahead.
                  </p>
                  <p className="flex items-start gap-1.5 text-amber-600 text-xs dark:text-amber-500">
                    <HugeiconsIcon
                      className="mt-px size-3.5 shrink-0"
                      icon={Alert02Icon}
                      strokeWidth={2}
                    />
                    <span>
                      Widening to {windowLabel(draftWindow).toLowerCase()} will create real Tasks
                      for the next {addedCycles} {addedCycles === 1 ? "Week" : "Weeks"} of scheduled
                      work.
                    </span>
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">{summary}</p>
              )}
            </fieldset>
          }
          description="Choose how many upcoming Weeks have their scheduled Template work materialized into real Tasks. Further-out Weeks stay as planning projections until they enter the window."
          htmlFor="rolling-materialization-window"
          label="Rolling materialization window"
        />
      </SettingsSection>

      <Alert>
        <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
        <AlertDescription>
          Scheduled Template work beyond this window still appears as projected planning Tasks on
          future Weeks — it just isn't turned into real Tasks until its Week moves inside the
          window. Narrowing the window never deletes Tasks that have already been created.
        </AlertDescription>
      </Alert>

      {!canUpdate ? (
        <Alert>
          <AlertDescription>
            Only Church owners and admins can change the materialization window.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {canUpdate && isDirty ? (
        <div className="sticky bottom-0 z-10 -mx-8 flex items-center justify-end gap-3 border-border border-t bg-background/80 px-8 py-4 backdrop-blur md:-mx-12 md:px-12">
          <Button disabled={saving} onClick={handleDiscard} type="button" variant="ghost">
            Discard
          </Button>
          <Button loading={saving && !confirmOpen} onClick={handleSave} type="button">
            {isExpanding ? "Review change" : "Save changes"}
          </Button>
        </div>
      ) : null}

      <ExpandWindowDialog
        addedCycles={addedCycles}
        from={savedWindow}
        onConfirm={() => void persist(draftWindow)}
        onOpenChange={(open) => {
          if (!saving) setConfirmOpen(open);
        }}
        open={confirmOpen}
        saving={saving}
        to={draftWindow}
      />
    </>
  );
}

function ExpandWindowDialog({
  open,
  onOpenChange,
  onConfirm,
  saving,
  from,
  to,
  addedCycles,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
  readonly saving: boolean;
  readonly from: number;
  readonly to: number;
  readonly addedCycles: number;
}) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} />
          </AlertDialogMedia>
          <AlertDialogTitle>Expand the materialization window?</AlertDialogTitle>
          <AlertDialogDescription>
            Widening from {windowLabel(from)} to {windowLabel(to)} will materialize scheduled
            Template work for {addedCycles} more {addedCycles === 1 ? "Week" : "Weeks"} into real
            Tasks. These Tasks become assignable and start counting toward Week progress right away,
            and removing them later means deleting each Task. Existing Tasks are left untouched.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={saving} loading={saving} onClick={onConfirm}>
            {saving ? "Expanding…" : "Expand window"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
