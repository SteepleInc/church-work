import type { KeyDateRule } from "@church-task/domain";
import { revalidateLogic } from "@tanstack/react-form";
import { Schema } from "effect";
import { atom, useAtom } from "jotai";
import { CalendarDaysIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useAppForm } from "@/components/form/ts-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { useCreateKeyDate, useKeyDatesCollection } from "@/data/templates/keyDatesData.app";
import {
  QuickActionForm,
  QuickActionsDescription,
  QuickActionsHeader,
  QuickActionsTitle,
  QuickActionsWrapper,
} from "@/features/quick-actions/quick-actions-components";
import {
  defaultScheduleForKind,
  ScheduleEditor,
  slugifyKey,
} from "@/features/settings/key-date-schedule";

export type CreateKeyDateQuickActionState = {
  readonly churchId: string;
};

export const createKeyDateQuickActionStateAtom = atom<CreateKeyDateQuickActionState | null>(null);

const CreateKeyDateFormSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1, { message: "Key Date name is required." })),
  ),
});

export function CreateKeyDateQuickAction() {
  const [state, setState] = useAtom(createKeyDateQuickActionStateAtom);
  const isOpen = state !== null;

  return (
    <QuickActionsWrapper open={isOpen} onOpenChange={(open) => !open && setState(null)}>
      <QuickActionsHeader className="p-4">
        <QuickActionsTitle>
          <span className="inline-flex flex-row items-center">
            <CalendarDaysIcon className="mr-2 size-4" />
            Create Key Date
          </span>
        </QuickActionsTitle>
        <QuickActionsDescription>
          Name a date your Church plans around — Easter, Christmas, an anniversary.
        </QuickActionsDescription>
      </QuickActionsHeader>
      {state ? <CreateKeyDateForm churchId={state.churchId} onDone={() => setState(null)} /> : null}
    </QuickActionsWrapper>
  );
}

function CreateKeyDateForm({
  churchId,
  onDone,
}: {
  readonly churchId: string;
  readonly onDone: () => void;
}) {
  const createKeyDate = useCreateKeyDate();
  const { keyDatesCollection } = useKeyDatesCollection({ churchId });
  const [schedule, setSchedule] = useState<KeyDateRule>(() =>
    defaultScheduleForKind("computedYearly"),
  );
  const [formError, setFormError] = useState<string | null>(null);

  const usedKeys = useMemo(
    () => new Set(keyDatesCollection.map((keyDate) => keyDate.key)),
    [keyDatesCollection],
  );

  const uniqueKeyFor = (name: string) => {
    const base = slugifyKey(name);
    if (!usedKeys.has(base)) return base;
    for (let bump = 2; ; bump += 1) {
      const candidate = `${base}-${bump}`;
      if (!usedKeys.has(candidate)) return candidate;
    }
  };

  const form = useAppForm({
    defaultValues: { name: "" },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onSubmit: Schema.toStandardSchemaV1(CreateKeyDateFormSchema),
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const name = value.name.trim();
      const result = await createKeyDate({
        churchId,
        key: uniqueKeyFor(name),
        name,
        schedule,
      });
      if (!result.ok) {
        setFormError(result.error.message);
        return;
      }
      toast.success("Key Date created.");
      onDone();
    },
  });

  return (
    <QuickActionForm
      form={form}
      Primary={
        <>
          <form.AppField name="name">
            {(field) => (
              <field.InputField
                autoComplete="off"
                data-1p-ignore
                data-form-type="other"
                data-lpignore="true"
                label="Key Date Name"
                placeholder="Easter"
                required
              />
            )}
          </form.AppField>
          <div className="flex flex-col gap-1.5">
            <Label>Schedule</Label>
            <ScheduleEditor onChange={setSchedule} schedule={schedule} />
          </div>
          {formError ? (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
        </>
      }
      Actions={
        <form.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button className="ml-auto" disabled={!canSubmit} loading={isSubmitting} type="submit">
              <PlusIcon className="size-4" />
              Create Key Date
              <Kbd>enter</Kbd>
            </Button>
          )}
        </form.Subscribe>
      }
    />
  );
}
