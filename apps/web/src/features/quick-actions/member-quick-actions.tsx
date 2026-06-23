import { revalidateLogic } from "@tanstack/react-form";
import { Schema } from "effect";
import { atom, useAtom } from "jotai";
import { AtSignIcon, MailIcon, UserRoundIcon, UsersRoundIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { useAppForm } from "@/components/form/ts-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Kbd } from "@/components/ui/kbd";
import {
  type MemberItem,
  useSetMemberSuspendedMutation,
  useUpdateMemberEmailMutation,
  useUpdateMemberNameMutation,
  useUpdateMemberUsernameMutation,
} from "@/data/members/membersData.app";
import {
  useAddTeamMemberMutation,
  useRemoveTeamMemberMutation,
  useTeamsCollection,
} from "@/data/teams/teamsData.app";
import {
  QuickActionForm,
  QuickActionFormSkeleton,
  QuickActionsDescription,
  QuickActionsHeader,
  QuickActionsTitle,
  QuickActionsWrapper,
} from "@/features/quick-actions/quick-actions-components";

/** Which member-management dialog is open, and the member it targets. */
export type MemberQuickActionMode =
  | "update-name"
  | "update-username"
  | "update-email"
  | "suspend"
  | "manage-teams";

export type MemberQuickActionState = {
  readonly mode: MemberQuickActionMode;
  readonly churchId: string;
  readonly member: MemberItem;
};

export const memberQuickActionStateAtom = atom<MemberQuickActionState | null>(null);

/**
 * The dialog host for every Member row action on the workspace Members settings
 * page. A single jotai atom drives which dialog is shown; the row "..." menu
 * sets it and these forms clear it on completion. All actions are org-admin
 * gated server-side (see `dashboard.ts`).
 */
export function MemberQuickActions() {
  const [state, setState] = useAtom(memberQuickActionStateAtom);
  const close = () => setState(null);
  const isOpen = state !== null;

  return (
    <QuickActionsWrapper open={isOpen} onOpenChange={(open) => !open && close()}>
      {state ? (
        <MemberQuickActionBody key={state.member.memberId} state={state} onDone={close} />
      ) : null}
    </QuickActionsWrapper>
  );
}

function MemberQuickActionBody({
  state,
  onDone,
}: {
  readonly state: MemberQuickActionState;
  readonly onDone: () => void;
}): ReactNode {
  switch (state.mode) {
    case "update-name":
      return <UpdateMemberNameBody state={state} onDone={onDone} />;
    case "update-username":
      return <UpdateMemberUsernameBody state={state} onDone={onDone} />;
    case "update-email":
      return <UpdateMemberEmailBody state={state} onDone={onDone} />;
    case "suspend":
      return <SuspendMemberBody state={state} onDone={onDone} />;
    case "manage-teams":
      return <ManageMemberTeamsBody state={state} onDone={onDone} />;
  }
}

function memberDisplayName(member: MemberItem): string {
  return member.name?.trim() || member.email?.trim() || member.username || "this member";
}

const NameSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.check(Schema.isMinLength(1, { message: "Name is required." }))),
});

function UpdateMemberNameBody({
  state,
  onDone,
}: {
  readonly state: MemberQuickActionState;
  readonly onDone: () => void;
}) {
  const updateName = useUpdateMemberNameMutation();
  const [error, setError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: { name: state.member.name ?? "" },
    validationLogic: revalidateLogic({ mode: "submit", modeAfterSubmission: "blur" }),
    validators: { onSubmit: Schema.toStandardSchemaV1(NameSchema) },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        await updateName({
          organizationId: state.churchId,
          memberId: state.member.memberId,
          name: value.name.trim(),
        });
        toast.success("Member name updated.");
        onDone();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update member name.");
      }
    },
  });

  return (
    <>
      <QuickActionsHeader className="p-4">
        <QuickActionsTitle>
          <span className="inline-flex flex-row items-center">
            <UserRoundIcon className="mr-2 size-4" />
            Update name
          </span>
        </QuickActionsTitle>
        <QuickActionsDescription>
          Enter the new full name for {memberDisplayName(state.member)}.
        </QuickActionsDescription>
      </QuickActionsHeader>
      <QuickActionForm
        form={form}
        Primary={
          <>
            <form.AppField name="name">
              {(field) => (
                <field.InputField
                  autoComplete="off"
                  data-1p-ignore="true"
                  label="Full name"
                  required
                />
              )}
            </form.AppField>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </>
        }
        Actions={
          <form.Subscribe
            selector={(formState) => ({
              canSubmit: formState.canSubmit,
              isSubmitting: formState.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button
                className="ml-auto"
                disabled={!canSubmit}
                loading={isSubmitting}
                type="submit"
              >
                Update
                <Kbd>enter</Kbd>
              </Button>
            )}
          </form.Subscribe>
        }
      />
    </>
  );
}

const UsernameSchema = Schema.Struct({
  username: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1, { message: "Username is required." })),
  ),
});

function UpdateMemberUsernameBody({
  state,
  onDone,
}: {
  readonly state: MemberQuickActionState;
  readonly onDone: () => void;
}) {
  const updateUsername = useUpdateMemberUsernameMutation();
  const [error, setError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: { username: state.member.username ?? "" },
    validationLogic: revalidateLogic({ mode: "submit", modeAfterSubmission: "blur" }),
    validators: { onSubmit: Schema.toStandardSchemaV1(UsernameSchema) },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        await updateUsername({
          organizationId: state.churchId,
          memberId: state.member.memberId,
          username: value.username.trim(),
        });
        toast.success("Member username updated.");
        onDone();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update member username.");
      }
    },
  });

  return (
    <>
      <QuickActionsHeader className="p-4">
        <QuickActionsTitle>
          <span className="inline-flex flex-row items-center">
            <AtSignIcon className="mr-2 size-4" />
            Update username
          </span>
        </QuickActionsTitle>
        <QuickActionsDescription>
          Enter the new username for {memberDisplayName(state.member)}.
        </QuickActionsDescription>
      </QuickActionsHeader>
      <QuickActionForm
        form={form}
        Primary={
          <>
            <form.AppField name="username">
              {(field) => (
                <field.InputField
                  autoComplete="off"
                  data-1p-ignore="true"
                  label="Username"
                  required
                />
              )}
            </form.AppField>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </>
        }
        Actions={
          <form.Subscribe
            selector={(formState) => ({
              canSubmit: formState.canSubmit,
              isSubmitting: formState.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button
                className="ml-auto"
                disabled={!canSubmit}
                loading={isSubmitting}
                type="submit"
              >
                Update
                <Kbd>enter</Kbd>
              </Button>
            )}
          </form.Subscribe>
        }
      />
    </>
  );
}

const EmailSchema = Schema.Struct({
  email: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1, { message: "Email is required." })),
    Schema.check(
      Schema.isPattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, { message: "Email must be valid." }),
    ),
  ),
});

function UpdateMemberEmailBody({
  state,
  onDone,
}: {
  readonly state: MemberQuickActionState;
  readonly onDone: () => void;
}) {
  const updateEmail = useUpdateMemberEmailMutation();
  const [error, setError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: { email: state.member.email ?? "" },
    validationLogic: revalidateLogic({ mode: "submit", modeAfterSubmission: "blur" }),
    validators: { onSubmit: Schema.toStandardSchemaV1(EmailSchema) },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        await updateEmail({
          organizationId: state.churchId,
          memberId: state.member.memberId,
          email: value.email.trim(),
        });
        toast.success("Member email updated.");
        onDone();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update member email.");
      }
    },
  });

  return (
    <>
      <QuickActionsHeader className="p-4">
        <QuickActionsTitle>
          <span className="inline-flex flex-row items-center">
            <MailIcon className="mr-2 size-4" />
            Update email
          </span>
        </QuickActionsTitle>
        <QuickActionsDescription>
          Enter the new email for {memberDisplayName(state.member)}.
        </QuickActionsDescription>
      </QuickActionsHeader>
      <QuickActionForm
        form={form}
        Primary={
          <>
            <form.AppField name="email">
              {(field) => (
                <field.InputField
                  autoComplete="off"
                  data-1p-ignore="true"
                  label="Email"
                  required
                  type="email"
                />
              )}
            </form.AppField>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </>
        }
        Actions={
          <form.Subscribe
            selector={(formState) => ({
              canSubmit: formState.canSubmit,
              isSubmitting: formState.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button
                className="ml-auto"
                disabled={!canSubmit}
                loading={isSubmitting}
                type="submit"
              >
                Update
                <Kbd>enter</Kbd>
              </Button>
            )}
          </form.Subscribe>
        }
      />
    </>
  );
}

function SuspendMemberBody({
  state,
  onDone,
}: {
  readonly state: MemberQuickActionState;
  readonly onDone: () => void;
}) {
  const setSuspended = useSetMemberSuspendedMutation();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isSuspended = state.member.suspended;
  const name = memberDisplayName(state.member);

  const handleConfirm = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await setSuspended({
        organizationId: state.churchId,
        memberId: state.member.memberId,
        suspended: !isSuspended,
      });
      toast.success(isSuspended ? "Member reactivated." : "Member suspended.");
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update member.");
      setSubmitting(false);
    }
  };

  return (
    <>
      <QuickActionsHeader className="p-4">
        <QuickActionsTitle>
          <span className="inline-flex flex-row items-center">
            <UserRoundIcon className="mr-2 size-4" />
            {isSuspended ? "Reactivate user" : "Suspend user"}
          </span>
        </QuickActionsTitle>
        <QuickActionsDescription>
          {isSuspended
            ? `Reactivate ${name}? They will regain access to the workspace.`
            : `Suspend ${name}? They will lose access until reactivated.`}
        </QuickActionsDescription>
      </QuickActionsHeader>
      <div className="flex flex-col gap-3 p-4 pt-0">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button onClick={onDone} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            loading={submitting}
            onClick={handleConfirm}
            type="button"
            variant={isSuspended ? "default" : "destructive"}
          >
            {isSuspended ? "Reactivate" : "Suspend"}
          </Button>
        </div>
      </div>
    </>
  );
}

function ManageMemberTeamsBody({
  state,
  onDone,
}: {
  readonly state: MemberQuickActionState;
  readonly onDone: () => void;
}) {
  const { teamsCollection, loading } = useTeamsCollection({ churchId: state.churchId });
  const addTeamMember = useAddTeamMemberMutation();
  const removeTeamMember = useRemoveTeamMemberMutation();
  const [error, setError] = useState<string | null>(null);
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);
  const memberTeamIds = new Set(state.member.teamIds);

  const toggleTeam = async (teamId: string, next: boolean) => {
    setError(null);
    setPendingTeamId(teamId);
    const mutation = next ? addTeamMember : removeTeamMember;
    const result = await mutation({
      churchId: state.churchId,
      teamId,
      userId: state.member.userId,
    });
    setPendingTeamId(null);
    if ("error" in result) {
      setError(result.error.message ?? "Could not update Team memberships.");
    }
  };

  return (
    <>
      <QuickActionsHeader className="p-4">
        <QuickActionsTitle>
          <span className="inline-flex flex-row items-center">
            <UsersRoundIcon className="mr-2 size-4" />
            Manage teams
          </span>
        </QuickActionsTitle>
        <QuickActionsDescription>
          Choose the Teams {memberDisplayName(state.member)} belongs to.
        </QuickActionsDescription>
      </QuickActionsHeader>
      <div className="flex flex-col gap-3 p-4 pt-0">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {loading ? (
          <QuickActionFormSkeleton fields={3} />
        ) : teamsCollection.length === 0 ? (
          <p className="text-muted-foreground text-sm">This Church has no Teams yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {teamsCollection.map((team) => {
              const checked = memberTeamIds.has(team.id);
              return (
                <li key={team.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50">
                    <Checkbox
                      checked={checked}
                      disabled={pendingTeamId === team.id}
                      onCheckedChange={(value) => void toggleTeam(team.id, value === true)}
                    />
                    <span className="text-sm">{team.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex justify-end">
          <Button onClick={onDone} type="button" variant="outline">
            Done
          </Button>
        </div>
      </div>
    </>
  );
}
