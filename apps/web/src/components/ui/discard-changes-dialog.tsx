"use client";

import { TriangleAlert } from "lucide-react";

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

/**
 * "Are you sure you want to close?" confirmation for surfaces that hold
 * unsaved edits (the create-Task quick action, the create-Template big action).
 * Callers only open this when the surface is actually dirty; closing a pristine
 * surface skips the prompt entirely so the dialog never nags about nothing.
 *
 * Discard is the destructive, irreversible path (the in-progress draft is
 * thrown away), so it carries the destructive styling; "Keep editing" returns
 * the User to their work untouched.
 */
export function DiscardChangesDialog({
  open,
  onOpenChange,
  onDiscard,
  onSave,
  title = "Discard changes?",
  description = "You have unsaved changes. If you close now, they'll be lost.",
  discardLabel = "Discard",
  cancelLabel = "Keep editing",
  saveLabel,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onDiscard: () => void;
  readonly onSave?: () => void;
  readonly title?: string;
  readonly description?: string;
  readonly discardLabel?: string;
  readonly cancelLabel?: string;
  readonly saveLabel?: string;
}) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <TriangleAlert />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              onOpenChange(false);
              onDiscard();
            }}
            variant="destructive"
          >
            {discardLabel}
          </AlertDialogAction>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          {onSave ? (
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                onOpenChange(false);
                onSave();
              }}
            >
              {saveLabel ?? "Save"}
            </AlertDialogAction>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
