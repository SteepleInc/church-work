import { revalidateLogic } from "@tanstack/react-form";
import { Schema } from "effect";
import { PencilIcon, UserRoundIcon } from "lucide-react";
import { atom, useAtom } from "jotai";
import { useState } from "react";
import { toast } from "sonner";

import { useAppForm } from "@/components/form/ts-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useUserData } from "@/data/users/userData.app";
import type { UserCollectionItem } from "@/data/users/usersData.app";
import {
  QuickActionForm,
  QuickActionFormSkeleton,
  QuickActionsDescription,
  QuickActionsHeader,
  QuickActionsTitle,
  QuickActionsWrapper,
} from "@/features/quick-actions/quick-actions-components";

type EditUserQuickActionState = {
  readonly userId: string;
};

export const editUserQuickActionStateAtom = atom<EditUserQuickActionState | null>(null);

const EditUserSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.check(Schema.isMinLength(1, { message: "Name is required." }))),
  email: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1, { message: "Email is required." })),
    Schema.check(
      Schema.isPattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, { message: "Email must be valid." }),
    ),
  ),
});

function getEditUserDefaultValues(user: UserCollectionItem) {
  return {
    name: user.name,
    email: user.email ?? "",
  };
}

export function EditUserQuickAction() {
  const [editUserState, setEditUserState] = useAtom(editUserQuickActionStateAtom);
  const isOpen = editUserState !== null;

  return (
    <QuickActionsWrapper open={isOpen} onOpenChange={(open) => !open && setEditUserState(null)}>
      <QuickActionsHeader className="p-4">
        <QuickActionsTitle>
          <span className="inline-flex flex-row items-center">
            <UserRoundIcon className="mr-2 size-4" />
            Edit user
          </span>
        </QuickActionsTitle>
        <QuickActionsDescription>Update account name and email fields.</QuickActionsDescription>
      </QuickActionsHeader>
      {editUserState ? (
        <EditUserContent
          userId={editUserState.userId}
          onUpdated={() => {
            setEditUserState(null);
            toast.success("User updated.");
          }}
        />
      ) : null}
    </QuickActionsWrapper>
  );
}

function EditUserContent({
  userId,
  onUpdated,
}: {
  readonly userId: string;
  readonly onUpdated: () => void;
}) {
  const { loading, userOpt: user } = useUserData({ userId });

  return loading ? (
    <QuickActionFormSkeleton />
  ) : !user ? (
    <Alert className="m-4 mt-0">
      <AlertDescription>User details are unavailable.</AlertDescription>
    </Alert>
  ) : (
    <EditUserForm key={user.id} user={user} onUpdated={onUpdated} />
  );
}

function EditUserForm({
  user,
  onUpdated,
}: {
  readonly user: UserCollectionItem;
  readonly onUpdated: () => void;
}) {
  const [editError, setEditError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: getEditUserDefaultValues(user),
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onSubmit: Schema.toStandardSchemaV1(EditUserSchema),
    },
    onSubmit: async ({ value }) => {
      setEditError(null);

      try {
        const response = await fetch("/api/admin/users/update", {
          body: JSON.stringify({
            userId: user.id,
            name: (value.name ?? "").trim(),
            email: (value.email ?? "").trim(),
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Could not update User.");
        }

        onUpdated();
      } catch (error) {
        setEditError(error instanceof Error ? error.message : "Could not update User.");
      }
    },
  });

  return (
    <QuickActionForm
      form={form}
      Primary={
        <>
          <form.AppField name="name">
            {(field) => (
              <field.InputField autoComplete="off" data-1p-ignore="true" label="Name" required />
            )}
          </form.AppField>
          <form.AppField name="email">
            {(field) => (
              <field.InputField autoComplete="off" data-1p-ignore="true" label="Email" required />
            )}
          </form.AppField>
          {editError ? (
            <Alert variant="destructive">
              <AlertDescription>{editError}</AlertDescription>
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
              <PencilIcon className="size-4" />
              Save user
              <Kbd>enter</Kbd>
            </Button>
          )}
        </form.Subscribe>
      }
    />
  );
}
