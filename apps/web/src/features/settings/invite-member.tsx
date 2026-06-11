import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { revalidateLogic } from "@tanstack/react-form";
import { Schema } from "effect";
import { atom, useAtom } from "jotai";
import type { ComponentPropsWithoutRef } from "react";
import { useState } from "react";
import { z } from "zod";

import { useAppForm } from "@/components/form/ts-form";
import { UserPlusIcon } from "@/components/icons/userPlusIcon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  QuickActionForm,
  QuickActionsHeader,
  QuickActionsTitle,
  QuickActionsWrapper,
} from "@/features/quick-actions/quick-actions-components";
import { authClient } from "@/lib/auth-client";
import {
  canInviteChurchMembers,
  getInvalidInviteMemberEmails,
  inviteMemberRoleOptions,
  parseInviteMemberEmails,
  type CurrentMemberRole,
} from "@/features/settings/invite-member-utils";

type InvitationRole = "member" | "admin";

export type InviteMemberDialogSource = "settings" | "quick-actions";

export const inviteMemberDialogSourceAtom = atom<InviteMemberDialogSource | null>(null);

const InviteMemberSchema = Schema.Struct({
  emails: Schema.Array(Schema.String.pipe(Schema.minLength(3))).pipe(
    Schema.minItems(1, { message: () => "Enter at least one email address." }),
  ),
  role: Schema.Literal("member", "admin"),
});

type InviteMemberButtonProps = Omit<ComponentPropsWithoutRef<typeof Button>, "onClick">;

export function InviteMemberButton(props: InviteMemberButtonProps) {
  const [, setInviteMemberDialogSource] = useAtom(inviteMemberDialogSourceAtom);

  return (
    <Button onClick={() => setInviteMemberDialogSource("settings")} {...props}>
      <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" />
      Invite Member
    </Button>
  );
}

export function InviteMemberQuickAction({
  activeChurchId,
  activeChurchRole,
  source,
}: {
  readonly activeChurchId: string;
  readonly activeChurchRole: CurrentMemberRole;
  readonly source: InviteMemberDialogSource;
}) {
  const [inviteMemberDialogSource, setInviteMemberDialogSource] = useAtom(
    inviteMemberDialogSourceAtom,
  );
  const canInvite = canInviteChurchMembers(activeChurchRole);
  const isOpen = inviteMemberDialogSource === source;

  return (
    <QuickActionsWrapper
      open={isOpen}
      onOpenChange={(open) => setInviteMemberDialogSource(open ? source : null)}
    >
      <QuickActionsHeader className="p-4">
        <QuickActionsTitle>
          <span className="inline-flex flex-row items-center">
            <UserPlusIcon className="mr-2 size-4" />
            Invite Member
          </span>
        </QuickActionsTitle>
      </QuickActionsHeader>
      {canInvite ? (
        <InviteMemberForm
          activeChurchId={activeChurchId}
          onInvited={() => setInviteMemberDialogSource(null)}
        />
      ) : (
        <Alert className="m-4 mt-0">
          <AlertDescription>
            Only Church owners and admins can invite Church members.
          </AlertDescription>
        </Alert>
      )}
    </QuickActionsWrapper>
  );
}

function InviteMemberForm({
  activeChurchId,
  onInvited,
}: {
  readonly activeChurchId: string;
  readonly onInvited: () => void;
}) {
  const [inviteError, setInviteError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: {
      emails: [] as readonly string[],
      role: "member" as InvitationRole,
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onSubmit: Schema.standardSchemaV1(InviteMemberSchema),
    },
    onSubmit: async ({ value, formApi }) => {
      setInviteError(null);

      const emails = parseInviteMemberEmails(value.emails.join(","));
      const invalidEmails = getInvalidInviteMemberEmails(emails);

      if (emails.length === 0) {
        setInviteError("Enter at least one email address.");
        return;
      }

      if (invalidEmails.length > 0) {
        setInviteError(`Invalid email address: ${invalidEmails[0]}`);
        return;
      }

      for (const email of emails) {
        const result = await authClient.organization.inviteMember({
          organizationId: activeChurchId,
          email,
          role: value.role,
        });

        if (result.error) {
          setInviteError(result.error.message ?? `Could not invite ${email}.`);
          return;
        }
      }

      formApi.reset();
      onInvited();
    },
  });

  return (
    <QuickActionForm
      form={form}
      Primary={
        <>
          <form.AppField name="emails">
            {(field) => (
              <field.TagInputField
                className="max-w-full"
                label="Email addresses"
                placeholder="Enter or paste one or more email addresses, separated by spaces or commas"
                required
                tagValidator={z.string().email()}
              />
            )}
          </form.AppField>
          <form.AppField name="role">
            {(field) => (
              <field.SelectField
                label="Role"
                options={inviteMemberRoleOptions}
                placeholder="Select a role"
                required
              />
            )}
          </form.AppField>
          {inviteError ? (
            <Alert variant="destructive">
              <AlertDescription>{inviteError}</AlertDescription>
            </Alert>
          ) : null}
        </>
      }
      Actions={
        <form.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button className="ml-auto" type="submit" loading={isSubmitting} disabled={!canSubmit}>
              Invite Members
              <Kbd>enter</Kbd>
            </Button>
          )}
        </form.Subscribe>
      }
    />
  );
}
