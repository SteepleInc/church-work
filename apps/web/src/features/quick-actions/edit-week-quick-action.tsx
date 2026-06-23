import { revalidateLogic } from "@tanstack/react-form";
import { Schema } from "effect";
import { atom, useAtom } from "jotai";
import { CalendarRange } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useAppForm } from "@/components/form/ts-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { formatWeekDateRange, useUpdateWeekDetailsMutation } from "@/data/cycles/cyclesData.app";
import {
  QuickActionForm,
  QuickActionsDescription,
  QuickActionsHeader,
  QuickActionsTitle,
  QuickActionsWrapper,
} from "@/features/quick-actions/quick-actions-components";

// The Week being edited is carried in full so the form opens instantly without
// a round trip — the actions menu already holds the Week's record.
export type EditWeekQuickActionState = {
  readonly churchId: string;
  readonly cycleId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly name: string | null;
  readonly description: string | null;
};

export const editWeekQuickActionStateAtom = atom<EditWeekQuickActionState | null>(null);

const NAME_MAX_LENGTH = 80;

const EditWeekSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.check(Schema.isMaxLength(NAME_MAX_LENGTH, { message: "Name is too long." })),
  ),
  description: Schema.String,
});

export function EditWeekQuickAction() {
  const [editWeekState, setEditWeekState] = useAtom(editWeekQuickActionStateAtom);
  const isOpen = editWeekState !== null;
  const dateRange = editWeekState ? formatWeekDateRange(editWeekState) : "";

  return (
    <QuickActionsWrapper open={isOpen} onOpenChange={(open) => !open && setEditWeekState(null)}>
      <QuickActionsHeader className="p-4">
        <QuickActionsTitle>
          <span className="inline-flex flex-row items-center">
            <CalendarRange className="mr-2 size-4" />
            Edit week
          </span>
        </QuickActionsTitle>
        <QuickActionsDescription>
          {dateRange
            ? `Name and describe the week of ${dateRange}.`
            : "Name and describe this week."}
        </QuickActionsDescription>
      </QuickActionsHeader>
      {editWeekState ? (
        <EditWeekForm
          key={editWeekState.cycleId}
          week={editWeekState}
          onUpdated={(name) => {
            setEditWeekState(null);
            toast.success(name ? `“${name}” saved.` : "Week updated.");
          }}
        />
      ) : null}
    </QuickActionsWrapper>
  );
}

function EditWeekForm({
  week,
  onUpdated,
}: {
  readonly week: EditWeekQuickActionState;
  readonly onUpdated: (name: string | null) => void;
}) {
  const updateWeekDetails = useUpdateWeekDetailsMutation();
  const [editError, setEditError] = useState<string | null>(null);
  const dateRange = formatWeekDateRange(week);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  const form = useAppForm({
    defaultValues: {
      name: week.name ?? "",
      description: week.description ?? "",
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onSubmit: Schema.toStandardSchemaV1(EditWeekSchema),
    },
    onSubmit: async ({ value }) => {
      setEditError(null);
      const trimmedName = value.name.trim();
      const trimmedDescription = value.description.trim();

      const result = await updateWeekDetails({
        churchId: week.churchId,
        cycleId: week.cycleId,
        description: trimmedDescription || null,
        name: trimmedName || null,
      });

      if (result.ok) {
        onUpdated(trimmedName || null);
        return;
      }

      setEditError(result.error.message);
    },
  });

  return (
    <QuickActionForm
      form={form}
      Body={
        // The Name and Description sit inline, the way Create Task lays them
        // out: the Name is the large heading line and the Description follows
        // directly beneath it — no field labels, no chrome. A Week's
        // Monday–Sunday span never moves, so the dates are only hinted via the
        // Name placeholder rather than a separate locked control.
        <div className="flex min-h-0 flex-col gap-2 overflow-hidden p-4">
          <form.Field name="name">
            {(field) => (
              <input
                aria-label="Name"
                autoComplete="off"
                autoFocus
                className="w-full shrink-0 bg-transparent font-medium text-lg outline-none placeholder:text-muted-foreground"
                data-1p-ignore="true"
                maxLength={NAME_MAX_LENGTH}
                onChange={(event) => field.handleChange(event.target.value)}
                onKeyDown={(event) => {
                  // Enter moves on to the description (Cmd+Enter submits).
                  if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
                    event.preventDefault();
                    descriptionInputRef.current?.focus();
                  }
                }}
                placeholder={dateRange}
                value={field.state.value}
              />
            )}
          </form.Field>
          <form.Field name="description">
            {(field) => (
              <textarea
                aria-label="Description"
                autoComplete="off"
                className="field-sizing-content min-h-20 w-full flex-1 resize-none overflow-y-auto bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                data-1p-ignore="true"
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Add description…"
                ref={descriptionInputRef}
                rows={4}
                value={field.state.value}
              />
            )}
          </form.Field>
          {editError ? (
            <Alert variant="destructive">
              <AlertDescription>{editError}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      }
      Actions={
        <form.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button className="ml-auto" disabled={!canSubmit} loading={isSubmitting} type="submit">
              Save week
              <Kbd>enter</Kbd>
            </Button>
          )}
        </form.Subscribe>
      }
    />
  );
}
