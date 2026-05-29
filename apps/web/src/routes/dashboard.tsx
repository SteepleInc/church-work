import { api } from "@church-task/backend/convex/_generated/api";
import refs from "@church-task/backend/confect/_generated/refs";
import { useAppForm } from "@/components/form/ts-form";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QueryResult, useQuery as useConfectQuery } from "@confect/react";
import { CheckoutLink, CustomerPortalLink } from "@convex-dev/polar/react";
import { revalidateLogic } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { Schema } from "effect";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import UserMenu from "@/components/user-menu";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
});

function PrivateDashboardContent() {
  const privateData = useConfectQuery(refs.public.privateData.get);
  const products = useQuery(api.polar.listAllProducts);
  const subscription = useQuery(api.polar.getCurrentSubscription);
  const activeChurch = useQuery(api.dashboard.getActiveOrganization);
  const pendingInvitations =
    activeChurch?.invitations.filter((invitation) => invitation.status === "pending") ?? [];

  const product = products?.find((product: { isRecurring?: boolean }) => product.isRecurring);
  const hasActiveSubscription = Boolean(subscription);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-muted/30 lg:flex-row">
      <aside className="border-b bg-background p-4 lg:w-80 lg:border-b-0 lg:border-r">
        <ChurchSwitcher
          activeChurchId={activeChurch?.id ?? null}
          activeChurchName={activeChurch?.name}
        />
      </aside>
      <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 rounded-xl border bg-background p-4 shadow-xs sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Church Task</p>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            {activeChurch ? (
              <p className="text-sm text-muted-foreground">Active Church: {activeChurch.name}</p>
            ) : null}
          </div>
          <UserMenu />
        </div>
        <section className="grid gap-4 rounded-xl border bg-background p-4 shadow-xs">
          <div>
            <h2 className="text-base font-semibold">Church Home</h2>
            <p className="text-sm text-muted-foreground">
              privateData:{" "}
              {QueryResult.isSuccess(privateData) ? privateData.value.message : "Loading..."}
            </p>
            <p className="text-sm text-muted-foreground">
              Plan: {hasActiveSubscription ? "Active" : "Free"}
            </p>
          </div>
          {subscription === undefined ? (
            <p className="text-sm text-muted-foreground">Loading subscription options...</p>
          ) : hasActiveSubscription ? (
            <CustomerPortalLink
              polarApi={api.polar}
              className={buttonVariants({ variant: "outline" })}
            >
              Manage Subscription
            </CustomerPortalLink>
          ) : products === undefined ? (
            <p className="text-sm text-muted-foreground">Loading subscription options...</p>
          ) : product ? (
            <CheckoutLink
              polarApi={api.polar}
              productIds={[product.id]}
              embed={false}
              className={buttonVariants({ variant: "default" })}
            >
              Upgrade
            </CheckoutLink>
          ) : (
            <p className="text-sm text-muted-foreground">No recurring plans available.</p>
          )}
        </section>
        <ActiveChurchInvitationPrompt />
        {activeChurch ? (
          <>
            <ChurchMembersPanel activeChurchId={activeChurch.id} />
            <ChurchInvitationPanel
              activeChurchId={activeChurch.id}
              pendingInvitations={pendingInvitations}
            />
          </>
        ) : null}
      </main>
    </div>
  );
}

function ActiveChurchInvitationPrompt() {
  const invitations = useQuery(api.dashboard.listUserInvitations);
  const [error, setError] = useState<string | null>(null);
  const [acceptingInvitationId, setAcceptingInvitationId] = useState<string | null>(null);
  const pendingInvitations = invitations ?? [];

  if (invitations === undefined || (!error && pendingInvitations.length === 0)) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Church Invitations</CardTitle>
        <CardDescription>
          You have invitations to other Churches. Accepting one switches your Active Church.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {pendingInvitations.map((invitation) => {
          const isAccepting = acceptingInvitationId === invitation.id;

          return (
            <div
              key={invitation.id}
              className="flex items-center justify-between gap-4 rounded-lg border p-4"
            >
              <div>
                <p className="font-medium">{invitation.organizationName}</p>
                <p className="text-sm text-muted-foreground">
                  Role: {invitationRoleLabel(invitation.role)}
                </p>
              </div>
              <Button
                type="button"
                disabled={isAccepting}
                onClick={async () => {
                  setError(null);
                  setAcceptingInvitationId(invitation.id);
                  const result = await authClient.organization.acceptInvitation({
                    invitationId: invitation.id,
                  });
                  setAcceptingInvitationId(null);

                  if (result.error) {
                    setError(result.error.message ?? "Could not accept Church Invitation.");
                    return;
                  }
                }}
              >
                {isAccepting ? "Accepting..." : "Accept Invitation"}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

type InvitationRole = "member" | "admin";

const ChurchNameSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.minLength(2, { message: () => "Church name must be at least 2 characters." }),
  ),
});

const ChurchInvitationSchema = Schema.Struct({
  email: Schema.String.pipe(
    Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
      message: () => "Enter a valid email address.",
    }),
  ),
  role: Schema.Literal("member", "admin"),
});

type PendingInvitation = {
  id: string;
  email: string;
  role: string | string[];
  status: string;
};

function invitationRoleLabel(role: string | string[]) {
  return Array.isArray(role) ? role.join(", ") : role;
}

function memberHasRole(role: string | string[], expectedRole: string) {
  return Array.isArray(role) ? role.includes(expectedRole) : role === expectedRole;
}

function ChurchMembersPanel({ activeChurchId }: { activeChurchId: string }) {
  const members = useQuery(api.dashboard.listMembers, { organizationId: activeChurchId });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Church Members</CardTitle>
        <CardDescription>Your membership context for the Active Church.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {members === undefined ? (
          <p className="text-sm text-muted-foreground">Loading Church Members...</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {success ? <p className="text-sm text-muted-foreground">{success}</p> : null}
        {members !== undefined && !error && members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Church Members found.</p>
        ) : null}
        {(members ?? []).map((member) => {
          const isOwner = memberHasRole(member.role, "owner");
          const roleLabel = invitationRoleLabel(member.role);
          const isUpdating = updatingMemberId === member.id;
          const isRemoving = removingMemberId === member.id;

          return (
            <div
              key={member.id}
              className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_auto] md:items-center"
            >
              <div>
                <p className="font-medium">{member.user.name ?? "Unnamed member"}</p>
                <p className="text-sm text-muted-foreground">{member.user.email ?? "No email"}</p>
              </div>
              {isOwner ? (
                <span className="text-sm capitalize text-muted-foreground">{roleLabel}</span>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="sr-only" htmlFor={`member-role-${member.id}`}>
                    Role for {member.user.email ?? member.user.name ?? "Church member"}
                  </Label>
                  <Select
                    value={memberHasRole(member.role, "admin") ? "admin" : "member"}
                    disabled={isUpdating || isRemoving}
                    onValueChange={async (value) => {
                      const nextRole = value as InvitationRole;
                      setError(null);
                      setSuccess(null);
                      setUpdatingMemberId(member.id);
                      const result = await authClient.organization.updateMemberRole({
                        organizationId: activeChurchId,
                        memberId: member.id,
                        role: nextRole,
                      });
                      setUpdatingMemberId(null);

                      if (result.error) {
                        setError(result.error.message ?? "Could not update Church Member role.");
                        return;
                      }

                      setSuccess(`Updated ${member.user.email ?? "Church Member"} to ${nextRole}.`);
                    }}
                  >
                    <SelectTrigger id={`member-role-${member.id}`} className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={`Remove ${member.user.email ?? member.user.name ?? "Church Member"}`}
                    disabled={isUpdating || isRemoving}
                    onClick={async () => {
                      setError(null);
                      setSuccess(null);
                      setRemovingMemberId(member.id);
                      const result = await authClient.organization.removeMember({
                        organizationId: activeChurchId,
                        memberIdOrEmail: member.id,
                      });
                      setRemovingMemberId(null);

                      if (result.error) {
                        setError(result.error.message ?? "Could not remove Church Member.");
                        return;
                      }

                      setSuccess(`Removed ${member.user.email ?? "Church Member"}.`);
                    }}
                  >
                    {isRemoving ? "Removing..." : "Remove"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ChurchInvitationPanel({
  activeChurchId,
  pendingInvitations,
}: {
  activeChurchId: string;
  pendingInvitations: PendingInvitation[];
}) {
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const inviteForm = useAppForm({
    defaultValues: {
      email: "",
      role: "member" as InvitationRole,
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onSubmit: Schema.standardSchemaV1(ChurchInvitationSchema),
    },
    onSubmit: async ({ value, formApi }) => {
      setInviteError(null);
      setInviteSuccess(null);

      const trimmedEmail = value.email.trim().toLowerCase();
      const result = await authClient.organization.inviteMember({
        organizationId: activeChurchId,
        email: trimmedEmail,
        role: value.role,
      });

      if (result.error) {
        setInviteError(result.error.message ?? "Could not invite Church member.");
        return;
      }

      formApi.reset();
      setInviteSuccess(`Invitation sent to ${trimmedEmail}.`);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Church Invitations</CardTitle>
        <CardDescription>
          Invite people to this Church and track pending invitations.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <form
          className="grid max-w-xl gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            inviteForm.handleSubmit();
          }}
        >
          <inviteForm.AppField name="email">
            {(field) => (
              <field.InputField
                label="Invite Member Email"
                placeholder="member@example.com"
                required
                type="email"
              />
            )}
          </inviteForm.AppField>
          <inviteForm.AppField name="role">
            {(field) => (
              <field.SelectField
                label="Role"
                options={[
                  { label: "Member", value: "member" },
                  { label: "Admin", value: "admin" },
                ]}
                placeholder="Select a role"
                required
              />
            )}
          </inviteForm.AppField>
          {inviteError ? <p className="text-sm text-destructive">{inviteError}</p> : null}
          {inviteSuccess ? <p className="text-sm text-muted-foreground">{inviteSuccess}</p> : null}
          <inviteForm.Subscribe
            selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button type="submit" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? "Inviting..." : "Invite Member"}
              </Button>
            )}
          </inviteForm.Subscribe>
        </form>
        <div className="grid gap-3">
          <h2 className="text-base font-semibold">Pending Invitations</h2>
          {pendingInvitations.length > 0 ? (
            <div className="grid gap-2">
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between gap-4 rounded-lg border p-3"
                >
                  <span>{invitation.email}</span>
                  <span className="text-sm capitalize text-muted-foreground">
                    {invitationRoleLabel(invitation.role)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No pending invitations.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function churchSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function ChurchSwitcher({
  activeChurchId,
  activeChurchName,
}: {
  activeChurchId: string | null;
  activeChurchName?: string;
}) {
  const churches = useQuery(api.dashboard.listOrganizations);
  const [error, setError] = useState<string | null>(null);
  const [pendingChurchId, setPendingChurchId] = useState<string | null>(null);
  const createChurchForm = useAppForm({
    defaultValues: {
      name: "",
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onSubmit: Schema.standardSchemaV1(ChurchNameSchema),
    },
    onSubmit: async ({ value, formApi }) => {
      setError(null);

      const trimmedName = value.name.trim();
      const slug = churchSlug(trimmedName);

      if (!slug) {
        setError("Church name must be at least 2 characters.");
        return;
      }

      const result = await authClient.organization.create({
        name: trimmedName,
        slug,
      });

      if (result.error) {
        setError(result.error.message ?? "Could not create Church.");
        return;
      }

      formApi.reset();
    },
  });

  const churchList = churches ?? [];

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="rounded-xl border bg-muted/30 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Active Church
        </p>
        <p className="mt-1 text-lg font-semibold leading-tight">
          {activeChurchName ?? "Loading..."}
        </p>
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-medium">Switch Church</p>
        {churches === undefined ? (
          <p className="text-sm text-muted-foreground">Loading Churches...</p>
        ) : null}
        {churchList.map((church) => {
          const isActive = church.id === activeChurchId;
          const isPending = pendingChurchId === church.id;

          return (
            <Button
              key={church.id}
              type="button"
              variant={isActive ? "secondary" : "ghost"}
              className="justify-start"
              disabled={isActive || isPending}
              onClick={async () => {
                setError(null);
                setPendingChurchId(church.id);
                const result = await authClient.organization.setActive({
                  organizationId: church.id,
                });
                setPendingChurchId(null);

                if (result.error) {
                  setError(result.error.message ?? "Could not switch Church.");
                }
              }}
            >
              {isPending ? "Switching..." : church.name}
            </Button>
          );
        })}
      </div>
      <form
        className="grid gap-3 border-t pt-4 lg:mt-auto"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          createChurchForm.handleSubmit();
        }}
      >
        <createChurchForm.AppField name="name">
          {(field) => (
            <field.InputField label="Create Another Church" placeholder="Second Church" required />
          )}
        </createChurchForm.AppField>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <createChurchForm.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Creating Church..." : "Create Church"}
            </Button>
          )}
        </createChurchForm.Subscribe>
      </form>
    </div>
  );
}

function ChurchOnboardingGate() {
  const activeChurch = useQuery(api.dashboard.getActiveOrganization);
  const hasActiveChurch = Boolean(activeChurch);
  const [error, setError] = useState<string | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const pendingInvitations = useQuery(api.dashboard.listUserInvitations);
  const [acceptingInvitationId, setAcceptingInvitationId] = useState<string | null>(null);
  const firstChurchForm = useAppForm({
    defaultValues: {
      name: "",
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onSubmit: Schema.standardSchemaV1(ChurchNameSchema),
    },
    onSubmit: async ({ value }) => {
      setError(null);

      const trimmedName = value.name.trim();
      const slug = churchSlug(trimmedName);

      if (!slug) {
        setError("Church name must be at least 2 characters.");
        return;
      }

      const result = await authClient.organization.create({
        name: trimmedName,
        slug,
      });

      if (result.error) {
        setError(result.error.message ?? "Could not create Church.");
      }
    },
  });

  if (activeChurch === undefined) {
    return <div>Loading Church...</div>;
  }

  if (hasActiveChurch) {
    return <PrivateDashboardContent />;
  }

  if (pendingInvitations === undefined) {
    return <div>Loading Church Invitations...</div>;
  }

  if (pendingInvitations.length > 0) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col justify-center p-6">
        <Card>
          <CardHeader>
            <CardTitle>Accept Church Invitation</CardTitle>
            <CardDescription>
              You have pending Church Invitations. Join one before creating a new Church.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {invitationError ? <p className="text-sm text-destructive">{invitationError}</p> : null}
            {pendingInvitations.map((invitation) => {
              const isAccepting = acceptingInvitationId === invitation.id;

              return (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between gap-4 rounded-lg border p-4"
                >
                  <div>
                    <p className="font-medium">{invitation.organizationName}</p>
                    <p className="text-sm text-muted-foreground">
                      Role: {invitationRoleLabel(invitation.role)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    disabled={isAccepting}
                    onClick={async () => {
                      setInvitationError(null);
                      setAcceptingInvitationId(invitation.id);
                      const result = await authClient.organization.acceptInvitation({
                        invitationId: invitation.id,
                      });
                      setAcceptingInvitationId(null);

                      if (result.error) {
                        setInvitationError(
                          result.error.message ?? "Could not accept Church Invitation.",
                        );
                        return;
                      }
                    }}
                  >
                    {isAccepting ? "Accepting..." : "Accept Invitation"}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Your First Church</CardTitle>
          <CardDescription>
            Church Task needs an active Church before you can enter the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitationError ? (
            <p className="mb-4 text-sm text-destructive">{invitationError}</p>
          ) : null}
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              firstChurchForm.handleSubmit();
            }}
          >
            <firstChurchForm.AppField name="name">
              {(field) => (
                <field.InputField
                  label="Church Name"
                  placeholder="Grace Community Church"
                  required
                />
              )}
            </firstChurchForm.AppField>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <firstChurchForm.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? "Creating Church..." : "Create Church"}
                </Button>
              )}
            </firstChurchForm.Subscribe>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function RouteComponent() {
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <>
      <Authenticated>
        <ChurchOnboardingGate />
      </Authenticated>
      <Unauthenticated>
        {showSignIn ? (
          <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
        ) : (
          <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
        )}
      </Unauthenticated>
      <AuthLoading>
        <div>Loading...</div>
      </AuthLoading>
    </>
  );
}
