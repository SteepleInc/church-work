import { api } from "@church-task/backend/convex/_generated/api";
import refs from "@church-task/backend/confect/_generated/refs";
import { useAppForm } from "@/components/form/ts-form";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QueryResult, useQuery as useConfectQuery } from "@confect/react";
import { CheckoutLink, CustomerPortalLink } from "@convex-dev/polar/react";
import { revalidateLogic } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
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
  const [activePanel, setActivePanel] = useState<"dashboard" | "settings">("dashboard");
  const pendingInvitations =
    activeChurch?.invitations.filter((invitation) => invitation.status === "pending") ?? [];

  const product = products?.find((product: { isRecurring?: boolean }) => product.isRecurring);
  const hasActiveSubscription = Boolean(subscription);

  return (
    <SidebarProvider className="min-h-[calc(100vh-4rem)] bg-muted/30">
      <Sidebar className="top-16 h-[calc(100svh-4rem)]" collapsible="offcanvas">
        <SidebarHeader>
          <div className="px-2 py-1">
            <p className="text-sm font-semibold">Church Task</p>
            <p className="text-xs text-muted-foreground">Church workspace</p>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <ChurchSwitcher
            activeChurchId={activeChurch?.id ?? null}
            activeChurchName={activeChurch?.name}
          />
          {activeChurch ? (
            <SidebarGroup>
              <SidebarGroupLabel>Church Setup</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      type="button"
                      isActive={activePanel === "settings"}
                      onClick={() => setActivePanel("settings")}
                    >
                      <span>Active Church Settings</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="bg-muted/30">
        <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
          <div className="flex flex-col gap-4 rounded-xl border bg-background p-4 shadow-xs sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <SidebarTrigger className="mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Church Task</p>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {activePanel === "settings" ? "Active Church Settings" : "Dashboard"}
                </h1>
                {activeChurch ? (
                  <p className="text-sm text-muted-foreground">
                    Active Church: {activeChurch.name}
                  </p>
                ) : null}
              </div>
            </div>
            <UserMenu />
          </div>
          {activePanel === "settings" && activeChurch ? (
            <ActiveChurchSettings activeChurch={activeChurch} />
          ) : (
            <>
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
            </>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

type ActiveChurch = NonNullable<
  ReturnType<typeof useQuery<typeof api.dashboard.getActiveOrganization>>
>;

function ActiveChurchSettings({ activeChurch }: { activeChurch: ActiveChurch }) {
  const teams = useQuery(api.teams.listForChurch, { churchId: activeChurch.id });
  const teamMemberships = useQuery(api.teams.listMembershipsForChurch, {
    churchId: activeChurch.id,
  });
  const members = useQuery(api.dashboard.listMembers, { organizationId: activeChurch.id });
  const workDefaults = useQuery(api.workDefaults.readForChurch, { churchId: activeChurch.id });

  const activeTeams = teams?.ok && teams.operation === "listTeams" ? teams.data.teams : [];
  const memberships =
    teamMemberships?.ok && teamMemberships.operation === "listTeamMemberships"
      ? teamMemberships.data.teamMemberships
      : [];
  const workflows = workDefaults?.ok ? workDefaults.data.workflows : [];
  const workflowStatuses = workDefaults?.ok ? workDefaults.data.workflowStatuses : [];
  const churchTimeZone = activeChurch.churchTimeZone ?? "Not set";

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <TeamSettingsCard
        activeChurch={activeChurch}
        teams={activeTeams}
        isLoading={teams === undefined}
      />
      <TeamMembershipSettingsCard
        activeChurch={activeChurch}
        teams={activeTeams}
        members={members ?? []}
        memberships={memberships}
        isLoading={teamMemberships === undefined || members === undefined}
      />
      <Card>
        <CardHeader>
          <CardTitle>Workflows</CardTitle>
          <CardDescription>Church-scoped processes available to Teams and Tasks.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {workDefaults === undefined ? "Loading Workflows..." : `${workflows.length} Workflows`}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Workflow Statuses</CardTitle>
          <CardDescription>Visible process steps mapped to Task States.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {workDefaults === undefined
              ? "Loading Workflow Statuses..."
              : `${workflowStatuses.length} Workflow Statuses`}
          </p>
        </CardContent>
      </Card>
      <ChurchTimeZoneSettings activeChurch={activeChurch} churchTimeZone={churchTimeZone} />
    </section>
  );
}

type TeamSetupTeam = {
  id: string;
  name: string;
  sortOrder: number;
};

type TeamSetupMember = {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

type TeamSetupMembership = {
  id: string;
  teamId: string;
  userId: string;
};

function TeamSettingsCard({
  activeChurch,
  teams,
  isLoading,
}: {
  activeChurch: ActiveChurch;
  teams: readonly TeamSetupTeam[];
  isLoading: boolean;
}) {
  const createTeam = useMutation(api.teams.createForChurch);
  const renameTeam = useMutation(api.teams.renameForChurch);
  const archiveTeam = useMutation(api.teams.archiveForChurch);
  const reorderTeams = useMutation(api.teams.reorderForChurch);
  const canManage = canMutateChurchSettings(activeChurch.role);
  const [newTeamName, setNewTeamName] = useState("");
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const runTeamMutation = async (
    action: string,
    mutation: () => Promise<{ ok: boolean; error?: { message: string } }>,
    onSuccess: () => void,
  ) => {
    setError(null);
    setSuccess(null);
    setPendingAction(action);
    const result = await mutation();
    setPendingAction(null);

    if (!result.ok) {
      setError(result.error?.message ?? "Could not update Teams.");
      return;
    }

    onSuccess();
  };

  const moveTeam = (team: TeamSetupTeam, direction: -1 | 1) => {
    const fromIndex = teams.findIndex((candidate) => candidate.id === team.id);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= teams.length) return;

    const teamIds = teams.map((candidate) => candidate.id);
    const [teamId] = teamIds.splice(fromIndex, 1);
    teamIds.splice(toIndex, 0, teamId);
    void runTeamMutation(
      `reorder-${team.id}`,
      () => reorderTeams({ churchId: activeChurch.id, teamIds }),
      () => setSuccess("Reordered Teams."),
    );
  };

  return (
    <Card role="region" aria-labelledby="teams-settings-title">
      <CardHeader>
        <CardTitle id="teams-settings-title">Teams</CardTitle>
        <CardDescription>Active work areas for this Church.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading Teams..." : `${teams.length} active Teams`}
        </p>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {success ? (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}
        {canManage ? (
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              const name = newTeamName.trim();
              if (!name) return;
              void runTeamMutation(
                "create",
                () => createTeam({ churchId: activeChurch.id, name }),
                () => {
                  setNewTeamName("");
                  setSuccess(`Created Team ${name}.`);
                },
              );
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="new-team-name">New Team Name</Label>
              <Input
                id="new-team-name"
                value={newTeamName}
                disabled={pendingAction === "create"}
                onChange={(event) => setNewTeamName(event.currentTarget.value)}
              />
            </div>
            <Button type="submit" disabled={pendingAction === "create" || !newTeamName.trim()}>
              {pendingAction === "create" ? "Creating..." : "Create Team"}
            </Button>
          </form>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team, index) => {
              const draftName = renameDrafts[team.id] ?? team.name;

              return (
                <TableRow key={team.id}>
                  <TableCell>
                    {canManage ? (
                      <div className="grid gap-2">
                        <Label className="sr-only" htmlFor={`rename-team-${team.id}`}>
                          Rename {team.name}
                        </Label>
                        <Input
                          id={`rename-team-${team.id}`}
                          value={draftName}
                          disabled={pendingAction === `rename-${team.id}`}
                          onChange={(event) =>
                            setRenameDrafts((drafts) => ({
                              ...drafts,
                              [team.id]: event.currentTarget.value,
                            }))
                          }
                        />
                      </div>
                    ) : (
                      team.name
                    )}
                  </TableCell>
                  {canManage ? (
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            pendingAction === `rename-${team.id}` ||
                            !draftName.trim() ||
                            draftName.trim() === team.name
                          }
                          onClick={() => {
                            const name = draftName.trim();
                            void runTeamMutation(
                              `rename-${team.id}`,
                              () =>
                                renameTeam({ churchId: activeChurch.id, teamId: team.id, name }),
                              () => setSuccess(`Renamed Team to ${name}.`),
                            );
                          }}
                        >
                          Rename Team {team.name}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={index === 0 || pendingAction === `reorder-${team.id}`}
                          onClick={() => moveTeam(team, -1)}
                        >
                          Move {team.name} Up
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            index === teams.length - 1 || pendingAction === `reorder-${team.id}`
                          }
                          onClick={() => moveTeam(team, 1)}
                        >
                          Move {team.name} Down
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pendingAction === `archive-${team.id}`}
                          onClick={() =>
                            void runTeamMutation(
                              `archive-${team.id}`,
                              () => archiveTeam({ churchId: activeChurch.id, teamId: team.id }),
                              () => setSuccess(`Archived Team ${team.name}.`),
                            )
                          }
                        >
                          Archive Team {team.name}
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TeamMembershipSettingsCard({
  activeChurch,
  teams,
  members,
  memberships,
  isLoading,
}: {
  activeChurch: ActiveChurch;
  teams: readonly TeamSetupTeam[];
  members: readonly TeamSetupMember[];
  memberships: readonly TeamSetupMembership[];
  isLoading: boolean;
}) {
  const addTeamMember = useMutation(api.teams.addMemberForChurch);
  const removeTeamMember = useMutation(api.teams.removeMemberForChurch);
  const canManage = canMutateChurchSettings(activeChurch.role);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const membersByUserId = new Map(members.map((member) => [member.user.id, member]));
  const visibleMemberships = memberships.filter(
    (membership) => teamsById.has(membership.teamId) && membersByUserId.has(membership.userId),
  );

  const runMembershipMutation = async (
    action: string,
    mutation: () => Promise<{ ok: boolean; error?: { message: string } }>,
    onSuccess: () => void,
  ) => {
    setError(null);
    setSuccess(null);
    setPendingAction(action);
    const result = await mutation();
    setPendingAction(null);

    if (!result.ok) {
      setError(result.error?.message ?? "Could not update Team Memberships.");
      return;
    }

    onSuccess();
  };

  return (
    <Card role="region" aria-labelledby="team-memberships-settings-title">
      <CardHeader>
        <CardTitle id="team-memberships-settings-title">Team Memberships</CardTitle>
        <CardDescription>Church Members connected to their relevant Teams.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Loading Team Memberships..."
            : `${visibleMemberships.length} Team Memberships`}
        </p>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {success ? (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}
        {canManage ? (
          <form
            className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (!selectedTeamId || !selectedUserId) return;
              const team = teamsById.get(selectedTeamId);
              const member = membersByUserId.get(selectedUserId);
              void runMembershipMutation(
                "add",
                () =>
                  addTeamMember({
                    churchId: activeChurch.id,
                    teamId: selectedTeamId,
                    userId: selectedUserId,
                  }),
                () => setSuccess(`Added ${memberLabel(member)} to ${team?.name ?? "Team"}.`),
              );
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="team-membership-team">Team</Label>
              <NativeSelect
                id="team-membership-team"
                value={selectedTeamId}
                disabled={pendingAction === "add"}
                onChange={(event) => setSelectedTeamId(event.currentTarget.value)}
              >
                <NativeSelectOption value="">Select a Team</NativeSelectOption>
                {teams.map((team) => (
                  <NativeSelectOption key={team.id} value={team.id}>
                    {team.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="team-membership-member">Church Member</Label>
              <NativeSelect
                id="team-membership-member"
                value={selectedUserId}
                disabled={pendingAction === "add"}
                onChange={(event) => setSelectedUserId(event.currentTarget.value)}
              >
                <NativeSelectOption value="">Select a Church Member</NativeSelectOption>
                {members.map((member) => (
                  <NativeSelectOption key={member.id} value={member.user.id}>
                    {memberLabel(member)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <Button
              type="submit"
              disabled={pendingAction === "add" || !selectedTeamId || !selectedUserId}
            >
              {pendingAction === "add" ? "Adding..." : "Add Team Member"}
            </Button>
          </form>
        ) : null}
        <ItemGroup className="gap-2">
          {visibleMemberships.map((membership) => {
            const team = teamsById.get(membership.teamId)!;
            const member = membersByUserId.get(membership.userId)!;
            const label = memberLabel(member);

            return (
              <Item key={membership.id} variant="outline">
                <ItemContent>
                  <ItemTitle>{label}</ItemTitle>
                  <ItemDescription>{team.name}</ItemDescription>
                </ItemContent>
                {canManage ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pendingAction === `remove-${membership.id}`}
                    onClick={() =>
                      void runMembershipMutation(
                        `remove-${membership.id}`,
                        () =>
                          removeTeamMember({
                            churchId: activeChurch.id,
                            teamId: membership.teamId,
                            userId: membership.userId,
                          }),
                        () => setSuccess(`Removed ${label} from ${team.name}.`),
                      )
                    }
                  >
                    Remove {label} from {team.name}
                  </Button>
                ) : null}
              </Item>
            );
          })}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

function memberLabel(member: TeamSetupMember | undefined) {
  return member?.user.email ?? member?.user.name ?? "Church Member";
}

function ChurchTimeZoneSettings({
  activeChurch,
  churchTimeZone,
}: {
  activeChurch: ActiveChurch;
  churchTimeZone: string;
}) {
  const updateTimeZone = useMutation(api.churchSettings.updateTimeZone);
  const canUpdate = canMutateChurchSettings(activeChurch.role);
  const [selectedTimeZone, setSelectedTimeZone] = useState(
    activeChurch.churchTimeZone ?? detectedChurchTimeZone(),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  return (
    <Card className="md:col-span-2" role="region" aria-labelledby="church-time-zone-title">
      <CardHeader>
        <CardTitle id="church-time-zone-title">Church Time Zone</CardTitle>
        <CardDescription>Weekly Cycle boundaries use this Church-local time zone.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">Current Church Time Zone: {churchTimeZone}</p>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {success ? (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}
        {canUpdate ? (
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              setSuccess(null);
              setIsSaving(true);

              const result = await updateTimeZone({
                churchId: activeChurch.id,
                churchTimeZone: selectedTimeZone,
              });
              setIsSaving(false);

              if (!result.ok) {
                setError(result.error.message);
                return;
              }

              setSuccess(`Updated Church Time Zone to ${result.data.church.churchTimeZone}.`);
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="church-time-zone-select">Church Time Zone</Label>
              <NativeSelect
                id="church-time-zone-select"
                value={selectedTimeZone}
                disabled={isSaving}
                onChange={(event) => setSelectedTimeZone(event.currentTarget.value)}
              >
                {churchTimeZoneOptions(activeChurch.churchTimeZone).map((timeZone) => (
                  <NativeSelectOption key={timeZone} value={timeZone}>
                    {timeZone}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <Button
              type="submit"
              disabled={isSaving || selectedTimeZone === activeChurch.churchTimeZone}
            >
              {isSaving ? "Updating..." : "Update Time Zone"}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
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
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {pendingInvitations.map((invitation) => {
          const isAccepting = acceptingInvitationId === invitation.id;

          return (
            <Item key={invitation.id} variant="outline">
              <ItemContent>
                <ItemTitle>{invitation.organizationName}</ItemTitle>
                <ItemDescription>Role: {invitationRoleLabel(invitation.role)}</ItemDescription>
              </ItemContent>
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
            </Item>
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
  churchTimeZone: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Church Time Zone is required." }),
  ),
});

function detectedChurchTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
}

const supportedChurchTimeZones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Africa/Johannesburg",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function churchTimeZoneOptions(churchTimeZone: string | null) {
  if (!churchTimeZone || supportedChurchTimeZones.includes(churchTimeZone)) {
    return supportedChurchTimeZones;
  }

  return [churchTimeZone, ...supportedChurchTimeZones];
}

function canMutateChurchSettings(role: string | string[]) {
  return memberHasRole(role, "owner") || memberHasRole(role, "admin");
}

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
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {success ? (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}
        {members !== undefined && !error && members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Church Members found.</p>
        ) : null}
        {(members ?? []).map((member) => {
          const isOwner = memberHasRole(member.role, "owner");
          const roleLabel = invitationRoleLabel(member.role);
          const isUpdating = updatingMemberId === member.id;
          const isRemoving = removingMemberId === member.id;

          return (
            <Item key={member.id} variant="outline">
              <ItemContent>
                <ItemTitle>{member.user.name ?? "Unnamed member"}</ItemTitle>
                <ItemDescription>{member.user.email ?? "No email"}</ItemDescription>
              </ItemContent>
              {isOwner ? (
                <Badge variant="secondary" className="capitalize">
                  {roleLabel}
                </Badge>
              ) : (
                <ItemActions className="flex-wrap">
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
                </ItemActions>
              )}
            </Item>
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
          {inviteError ? (
            <Alert variant="destructive">
              <AlertDescription>{inviteError}</AlertDescription>
            </Alert>
          ) : null}
          {inviteSuccess ? (
            <Alert>
              <AlertDescription>{inviteSuccess}</AlertDescription>
            </Alert>
          ) : null}
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
            <ItemGroup className="gap-2">
              {pendingInvitations.map((invitation) => (
                <Item key={invitation.id} variant="outline">
                  <ItemContent>
                    <ItemTitle>{invitation.email}</ItemTitle>
                  </ItemContent>
                  <Badge variant="outline" className="capitalize">
                    {invitationRoleLabel(invitation.role)}
                  </Badge>
                </Item>
              ))}
            </ItemGroup>
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
      churchTimeZone: detectedChurchTimeZone(),
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
      const churchTimeZone = value.churchTimeZone.trim();
      const slug = churchSlug(trimmedName);

      if (!slug) {
        setError("Church name must be at least 2 characters.");
        return;
      }

      const result = await authClient.organization.create({
        name: trimmedName,
        slug,
        churchTimeZone,
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
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Active Church</SidebarGroupLabel>
        <SidebarGroupContent>
          <Item variant="muted">
            <ItemContent>
              <ItemTitle>{activeChurchName ?? "Loading..."}</ItemTitle>
            </ItemContent>
          </Item>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Switch Church</SidebarGroupLabel>
        <SidebarGroupContent>
          {churches === undefined ? (
            <p className="text-sm text-muted-foreground">Loading Churches...</p>
          ) : null}
          <SidebarMenu>
            {churchList.map((church) => {
              const isActive = church.id === activeChurchId;
              const isPending = pendingChurchId === church.id;

              return (
                <SidebarMenuItem key={church.id}>
                  <SidebarMenuButton
                    type="button"
                    isActive={isActive}
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
                    <span>{isPending ? "Switching..." : church.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarSeparator />
      <SidebarFooter>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            createChurchForm.handleSubmit();
          }}
        >
          <createChurchForm.AppField name="name">
            {(field) => (
              <field.InputField
                label="Create Another Church"
                placeholder="Second Church"
                required
              />
            )}
          </createChurchForm.AppField>
          <createChurchForm.AppField name="churchTimeZone">
            {(field) => (
              <field.InputField label="Church Time Zone" placeholder="America/New_York" required />
            )}
          </createChurchForm.AppField>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
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
      </SidebarFooter>
    </>
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
      churchTimeZone: detectedChurchTimeZone(),
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
      const churchTimeZone = value.churchTimeZone.trim();
      const slug = churchSlug(trimmedName);

      if (!slug) {
        setError("Church name must be at least 2 characters.");
        return;
      }

      const result = await authClient.organization.create({
        name: trimmedName,
        slug,
        churchTimeZone,
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
            {invitationError ? (
              <Alert variant="destructive">
                <AlertDescription>{invitationError}</AlertDescription>
              </Alert>
            ) : null}
            {pendingInvitations.map((invitation) => {
              const isAccepting = acceptingInvitationId === invitation.id;

              return (
                <Item key={invitation.id} variant="outline">
                  <ItemContent>
                    <ItemTitle>{invitation.organizationName}</ItemTitle>
                    <ItemDescription>Role: {invitationRoleLabel(invitation.role)}</ItemDescription>
                  </ItemContent>
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
                </Item>
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
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{invitationError}</AlertDescription>
            </Alert>
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
            <firstChurchForm.AppField name="churchTimeZone">
              {(field) => (
                <field.InputField
                  label="Church Time Zone"
                  placeholder="America/New_York"
                  required
                />
              )}
            </firstChurchForm.AppField>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
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
