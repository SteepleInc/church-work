import { CalendarClock, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  formatTemplateScheduleOccurrence,
  useTemplateSoftDeleteActions,
  type TemplateScheduleCollectionItem,
} from "@/data/templates/templatesData.app";

type MutationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: { readonly message: string } };

/**
 * Soft Delete and restore are gated to Church owners and admins, matching the
 * Template manager check the Zero mutators enforce server-side. Members see no
 * delete affordances rather than a control that fails on submit.
 */
export function canManageTemplates(role: string | readonly string[]): boolean {
  return Array.isArray(role)
    ? role.includes("owner") || role.includes("admin")
    : role === "owner" || role === "admin";
}

const todayLocalDate = (): string => new Date().toISOString().slice(0, 10);

/**
 * After a Soft Delete, surface an undo affordance instead of a permanent
 * "deleted" message. Soft Delete keeps the record's identity, so Restore brings
 * back the same Template, Schedule, or Template Task (and its Cycle Adjustments)
 * rather than recreating a new one — see CONTEXT.md "Soft Delete".
 */
function softDeletedToast(params: {
  readonly entity: string;
  readonly name: string;
  readonly onUndo: () => Promise<MutationResult>;
}) {
  toast.success(`${params.entity} deleted`, {
    action: {
      label: "Restore",
      onClick: () => {
        void params.onUndo().then((result) => {
          if (result.ok) {
            toast.success(`${params.name} restored`);
          } else {
            toast.error(result.error.message);
          }
        });
      },
    },
    description: `${params.name} is hidden from planning. Restore it to bring it back.`,
    icon: <Trash2 className="size-4" />,
  });
}

export function useTemplateSoftDelete() {
  const actions = useTemplateSoftDeleteActions();

  const removeTemplate = async (params: { readonly id: string; readonly name: string }) => {
    const result = await actions.deleteTemplate({ templateId: params.id });
    if (!result.ok) {
      toast.error(result.error.message);
      return result;
    }
    softDeletedToast({
      entity: "Template",
      name: params.name,
      onUndo: () => actions.restoreTemplate({ templateId: params.id }),
    });
    return result;
  };

  const removeTemplateTask = async (params: { readonly id: string; readonly name: string }) => {
    const result = await actions.deleteTemplateTask({ templateTaskId: params.id });
    if (!result.ok) {
      toast.error(result.error.message);
      return result;
    }
    softDeletedToast({
      entity: "Template Task",
      name: params.name,
      onUndo: () => actions.restoreTemplateTask({ templateTaskId: params.id }),
    });
    return result;
  };

  const removeSchedule = async (params: {
    readonly schedule: TemplateScheduleCollectionItem;
    readonly cleanupCurrentOccurrence: boolean;
  }) => {
    const result = await actions.deleteTemplateSchedule({
      options: {
        cleanupCurrentOccurrence: params.cleanupCurrentOccurrence,
        currentDate: todayLocalDate(),
        currentOccurrenceKey: params.schedule.currentOccurrenceKey,
      },
      scheduleId: params.schedule.id,
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return result;
    }
    softDeletedToast({
      entity: "Schedule",
      name: params.schedule.name,
      onUndo: () => actions.restoreTemplateSchedule({ scheduleId: params.schedule.id }),
    });
    return result;
  };

  return { removeSchedule, removeTemplate, removeTemplateTask };
}

/**
 * Confirmation for deleting a whole Template. Soft Delete language is explicit:
 * the Template is hidden, not erased, and stops projecting future work, but its
 * Schedules and Template Tasks keep their identity for Restore.
 */
export function DeleteTemplateDialog({
  open,
  onOpenChange,
  templateName,
  scheduleCount,
  onConfirm,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly templateName: string;
  readonly scheduleCount: number;
  readonly onConfirm: () => Promise<MutationResult>;
}) {
  const [working, setWorking] = useState(false);

  const handleConfirm = async () => {
    setWorking(true);
    try {
      const result = await onConfirm();
      if (result.ok) onOpenChange(false);
    } finally {
      setWorking(false);
    }
  };

  return (
    <AlertDialog onOpenChange={(next) => !working && onOpenChange(next)} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete “{templateName}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This Template is hidden from the Library and stops projecting future work.
            {scheduleCount > 0
              ? ` Its ${scheduleCount === 1 ? "Schedule" : `${scheduleCount} Schedules`} stop projecting too.`
              : ""}{" "}
            Already-real Tasks keep their place, and you can Restore the Template anytime.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={working}>Keep Template</AlertDialogCancel>
          <AlertDialogAction
            disabled={working}
            loading={working}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
            variant="destructive"
          >
            Delete Template
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Confirmation for deleting a single Template Task from a Template.
 */
export function DeleteTemplateTaskDialog({
  open,
  onOpenChange,
  taskTitle,
  onConfirm,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly taskTitle: string;
  readonly onConfirm: () => Promise<MutationResult>;
}) {
  const [working, setWorking] = useState(false);

  const handleConfirm = async () => {
    setWorking(true);
    try {
      const result = await onConfirm();
      if (result.ok) onOpenChange(false);
    } finally {
      setWorking(false);
    }
  };

  return (
    <AlertDialog onOpenChange={(next) => !working && onOpenChange(next)} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete “{taskTitle}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This Template Task stops appearing in future Cycles. Restore brings back the same
            Template Task and any week-specific adjustments made to it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={working}>Keep Task</AlertDialogCancel>
          <AlertDialogAction
            disabled={working}
            loading={working}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
            variant="destructive"
          >
            Delete Task
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Deleting a Template Schedule is where future-work effects are most surprising,
 * so the prompt names the upcoming occurrence and offers an explicit cleanup
 * choice. Without cleanup, the Schedule simply stops projecting and any work
 * already pulled into the current Week stays put. With cleanup, this Week's
 * still-projected and freshly materialized work for the current occurrence is
 * also removed — never touching past Weeks or work from other occurrences.
 */
export function DeleteScheduleDialog({
  open,
  onOpenChange,
  schedule,
  onConfirm,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly schedule: TemplateScheduleCollectionItem | null;
  readonly onConfirm: (cleanupCurrentOccurrence: boolean) => Promise<MutationResult>;
}) {
  const [working, setWorking] = useState(false);
  const [cleanup, setCleanup] = useState(false);

  const canCleanup = Boolean(schedule?.currentOccurrenceKey);
  const occurrenceLabel = schedule
    ? formatTemplateScheduleOccurrence(schedule.nextOccurrence)
    : "—";

  const handleConfirm = async () => {
    setWorking(true);
    try {
      const result = await onConfirm(canCleanup && cleanup);
      if (result.ok) onOpenChange(false);
    } finally {
      setWorking(false);
    }
  };

  return (
    <AlertDialog
      onOpenChange={(next) => {
        if (working) return;
        if (!next) setCleanup(false);
        onOpenChange(next);
      }}
      open={open}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <CalendarClock />
          </AlertDialogMedia>
          <AlertDialogTitle>Stop “{schedule?.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This Schedule stops projecting its Template into upcoming Weeks. The Template stays in
            your Library, and you can Restore the Schedule anytime.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {canCleanup ? (
          <label
            className="-mt-1 flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/40 p-3"
            htmlFor="schedule-cleanup"
          >
            <Checkbox
              checked={cleanup}
              className="mt-0.5"
              disabled={working}
              id="schedule-cleanup"
              name="schedule-cleanup"
              onCheckedChange={(value) => setCleanup(value === true)}
            />
            <div className="grid gap-1">
              <span className="font-medium text-sm leading-none">Also clear this Week’s work</span>
              <p className="text-muted-foreground text-xs">
                Removes the still-projected and just-materialized Tasks for the {occurrenceLabel}{" "}
                occurrence. Past Weeks and other occurrences are left untouched.
              </p>
            </div>
          </label>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={working}>Keep Schedule</AlertDialogCancel>
          <AlertDialogAction
            disabled={working}
            loading={working}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
            variant="destructive"
          >
            {cleanup && canCleanup ? "Stop and clear" : "Stop Schedule"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RestoreMenuIcon() {
  return <RotateCcw />;
}
