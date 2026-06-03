import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { revalidateLogic } from "@tanstack/react-form";
import { Schema } from "effect";
import { atom, useAtom } from "jotai";
import type { ComponentPropsWithoutRef } from "react";
import { useState } from "react";

import { useAppForm } from "@/components/form/ts-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";

type InvitationRole = "member" | "admin";
type CurrentMemberRole = string | readonly string[] | null | undefined;

export const inviteMemberIsOpenAtom = atom(false);

export const inviteMemberRoleOptions: readonly {
  readonly label: string;
  readonly value: InvitationRole;
}[] = [
  { label: "Member", value: "member" },
  { label: "Admin", value: "admin" },
];

export function canInviteChurchMembers(currentRole: CurrentMemberRole) {
  return Array.isArray(currentRole)
    ? currentRole.includes("owner") || currentRole.includes("admin")
    : currentRole === "owner" || currentRole === "admin";
}

const InviteMemberSchema = Schema.Struct({
  emails: Schema.String.pipe(
    Schema.minLength(3, { message: () => "Enter at least one email address." }),
  ),
  role: Schema.Literal("member", "admin"),
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseInviteMemberEmails(value: string) {
  const emails = value
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);

  return Array.from(new Set(emails));
}

export function getInvalidInviteMemberEmails(emails: readonly string[]) {
  return emails.filter((email) => !emailPattern.test(email));
}

type InviteMemberButtonProps = Omit<ComponentPropsWithoutRef<typeof Button>, "onClick">;

export function InviteMemberButton(props: InviteMemberButtonProps) {
  const [, setInviteMemberIsOpen] = useAtom(inviteMemberIsOpenAtom);

  return (
    <Button onClick={() => setInviteMemberIsOpen(true)} {...props}>
      <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" />
      Invite Member
    </Button>
  );
}

export function InviteMemberQuickAction({
  activeChurchId,
  activeChurchRole,
}: {
  readonly activeChurchId: string;
  readonly activeChurchRole: CurrentMemberRole;
}) {
  const [inviteMemberIsOpen, setInviteMemberIsOpen] = useAtom(inviteMemberIsOpenAtom);
  const canInvite = canInviteChurchMembers(activeChurchRole);

  return (
    <Dialog open={inviteMemberIsOpen} onOpenChange={setInviteMemberIsOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="size-4" />
            Invite Member
          </DialogTitle>
          <DialogDescription>
            Invite one or more people to this Church. Separate email addresses with spaces, commas,
            or new lines.
          </DialogDescription>
        </DialogHeader>
        {canInvite ? (
          <InviteMemberForm
            activeChurchId={activeChurchId}
            onInvited={() => setInviteMemberIsOpen(false)}
          />
        ) : (
          <Alert>
            <AlertDescription>
              Only Church owners and admins can invite Church members.
            </AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
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
      emails: "",
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

      const emails = parseInviteMemberEmails(value.emails);
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
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.AppField name="emails">
        {(field) => (
          <field.TextareaField
            label="Email Addresses"
            placeholder="member@example.com, admin@example.com"
            required
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
      <form.Subscribe
        selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
      >
        {({ canSubmit, isSubmitting }) => (
          <Button className="ml-auto" type="submit" loading={isSubmitting} disabled={!canSubmit}>
            Invite Members
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
