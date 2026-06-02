import { api } from "@church-task/backend/convex/_generated/api";
import refs from "@church-task/backend/confect/_generated/refs";
import { useAppForm } from "@/components/form/ts-form";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
import { Schema } from "effect";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import {
  TaskExecutionSurface,
  type TaskExecutionFilters,
} from "@/components/tasks/task-execution-surface";
import UserMenu from "@/components/user-menu";
import { authClient } from "@/lib/auth-client";

export type ActiveDashboardPanel =
  | "my_work"
  | "our_work"
  | "settings"
  | { kind: "team"; teamId: string };

type DashboardSearch = {
  readonly taskState?: "todo" | "in_progress" | "done" | "canceled";
  readonly workflowStatusId?: string;
};

export function validateDashboardSearch(search: Record<string, unknown>): DashboardSearch {
  const taskState = search.taskState;
  const workflowStatusId = search.workflowStatusId;

  return {
    taskState:
      taskState === "todo" ||
      taskState === "in_progress" ||
      taskState === "done" ||
      taskState === "canceled"
        ? taskState
        : undefined,
    workflowStatusId:
      typeof workflowStatusId === "string" && workflowStatusId.length > 0
        ? workflowStatusId
        : undefined,
  };
}

type DashboardTeamSummary = {
  readonly id: string;
};

type DashboardTeamMembershipSummary = {
  readonly teamId: string;
  readonly userId: string;
};

export function getUnavailableTeamBoardActions() {
  return [
    { panel: "my_work" as const, label: "Open My Work" },
    { panel: "our_work" as const, label: "Open Our Work" },
  ];
}

function getDashboardFilterSearch(search: DashboardSearch): DashboardSearch {
  return {
    ...(search.taskState ? { taskState: search.taskState } : {}),
    ...(search.workflowStatusId ? { workflowStatusId: search.workflowStatusId } : {}),
  };
}

export function getDashboardSearchForPanel(currentSearch: DashboardSearch = {}): DashboardSearch {
  return getDashboardFilterSearch(currentSearch);
}

export function getDashboardSearchForExecutionFilters(
  search: DashboardSearch,
  filters: TaskExecutionFilters,
): DashboardSearch {
  return {
    ...getDashboardFilterSearch(search),
    taskState: filters.taskState,
    workflowStatusId: filters.workflowStatusId,
  };
}

export function getMemberTeams<Team extends DashboardTeamSummary>(
  teams: readonly Team[],
  memberships: readonly DashboardTeamMembershipSummary[],
  currentUserId: string | null,
): Team[] {
  const currentUserTeamIds = new Set(
    memberships
      .filter((membership) => membership.userId === currentUserId)
      .map((membership) => membership.teamId),
  );

  return teams.filter((team) => currentUserTeamIds.has(team.id));
}

function PrivateDashboardContent({ activePanel }: { activePanel: ActiveDashboardPanel }) {
  const search = useSearch({ strict: false }) as DashboardSearch;
  const navigate = useNavigate();
  const privateData = useConfectQuery(refs.public.privateData.get);
  const products = useQuery(api.polar.listAllProducts);
  const subscription = useQuery(api.polar.getCurrentSubscription);
  const activeChurch = useQuery(api.dashboard.getActiveOrganization);
  const setActivePanel = (panel: ActiveDashboardPanel) => {
    const routeSearch = getDashboardSearchForPanel(search);

    if (typeof panel === "object") {
      navigate({
        to: "/team/$teamId",
        params: { teamId: panel.teamId },
        search: routeSearch,
      });
      return;
    }

    navigate({
      to:
        panel === "my_work"
          ? "/my-work"
          : panel === "our_work"
            ? "/our-work"
            : "/settings",
      search: routeSearch,
    });
  };
  const setExecutionFilters = (filters: TaskExecutionFilters) => {
    const routeSearch = getDashboardSearchForExecutionFilters(search, filters);

    if (typeof activePanel === "object") {
      navigate({
        to: "/team/$teamId",
        params: { teamId: activePanel.teamId },
        search: routeSearch,
      });
      return;
    }

    navigate({
      to:
        activePanel === "my_work"
          ? "/my-work"
          : activePanel === "our_work"
            ? "/our-work"
            : "/settings",
      search: routeSearch,
    });
  };
  const currentUserId = activeChurch?.currentUserId ?? null;
  const teams = useQuery(
    api.teams.listForChurch,
    activeChurch ? { churchId: activeChurch.id } : "skip",
  );
  const teamMemberships = useQuery(
    api.teams.listMembershipsForChurch,
    activeChurch ? { churchId: activeChurch.id } : "skip",
  );
  const pendingInvitations =
    activeChurch?.invitations.filter((invitation) => invitation.status === "pending") ?? [];
  const activeTeams = teams?.ok && teams.operation === "listTeams" ? teams.data.teams : [];
  const memberships =
    teamMemberships?.ok && teamMemberships.operation === "listTeamMemberships"
      ? teamMemberships.data.teamMemberships
      : [];
  const memberTeams = getMemberTeams(activeTeams, memberships, currentUserId);
  const selectedTeam =
    typeof activePanel === "object"
      ? (activeTeams.find((team) => team.id === activePanel.teamId) ?? null)
      : null;
  const unavailableTeamBoardActions = getUnavailableTeamBoardActions();

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
              <SidebarGroupLabel>My Work</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      type="button"
                      isActive={activePanel === "my_work"}
                      onClick={() => setActivePanel("my_work")}
                    >
                      <span>My Work</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
          {activeChurch ? (
            <SidebarGroup>
              <SidebarGroupLabel>Our Work</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      type="button"
                      isActive={activePanel === "our_work"}
                      onClick={() => setActivePanel("our_work")}
                    >
                      <span>Our Work</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
          {activeChurch ? (
            <SidebarGroup>
              <SidebarGroupLabel>Your Teams</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {teamMemberships === undefined || teams === undefined ? (
                    <SidebarMenuItem>
                      <SidebarMenuButton type="button" disabled>
                        <span>Loading Teams...</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ) : memberTeams.length > 0 ? (
                    memberTeams.map((team) => (
                      <SidebarMenuItem key={team.id}>
                        <SidebarMenuButton
                          type="button"
                          isActive={
                            typeof activePanel === "object" && activePanel.teamId === team.id
                          }
                          onClick={() => setActivePanel({ kind: "team", teamId: team.id })}
                        >
                          <span>{team.name}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))
                  ) : (
                    <SidebarMenuItem>
                      <SidebarMenuButton type="button" disabled>
                        <span>No Team memberships</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
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
                  {activePanel === "settings"
                    ? "Active Church Settings"
                    : activePanel === "my_work"
                      ? "My Work"
                      : activePanel === "our_work"
                        ? "Our Work"
                        : (selectedTeam?.name ?? "Team")}
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
          ) : typeof activePanel === "object" && !selectedTeam ? (
            <section className="grid gap-4 rounded-xl border bg-background p-4 shadow-xs">
              <h2 className="text-base font-semibold">Team board</h2>
              <p className="text-sm text-muted-foreground">
                {teams === undefined ? "Loading Team board..." : "Team board is unavailable."}
              </p>
              {teams !== undefined ? (
                <div className="flex flex-wrap gap-2">
                  {unavailableTeamBoardActions.map((action) => (
                    <Button
                      key={action.panel}
                      type="button"
                      variant={action.panel === "my_work" ? "default" : "outline"}
                      onClick={() => setActivePanel(action.panel)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              ) : null}
            </section>
          ) : activeChurch && currentUserId ? (
            <TaskExecutionSurface
              churchId={activeChurch.id}
              currentUserId={currentUserId}
              surface={
                typeof activePanel === "object"
                  ? "team_board"
                  : activePanel === "settings"
                    ? "my_work"
                    : activePanel
              }
              team={selectedTeam}
              myWorkEmptyStateTeams={memberTeams}
              filters={{
                taskState: search.taskState,
                workflowStatusId: search.workflowStatusId,
              }}
              onFiltersChange={setExecutionFilters}
              onOpenOurWork={() => setActivePanel("our_work")}
              onOpenTeamBoard={(teamId) => setActivePanel({ kind: "team", teamId })}
            />
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
      <WorkflowSettingsCard
        activeChurch={activeChurch}
        teams={activeTeams}
        workflows={workflows}
        isLoading={workDefaults === undefined}
      />
      <WorkflowStatusSettingsCard
        activeChurch={activeChurch}
        workflows={workflows}
        workflowStatuses={workflowStatuses}
        isLoading={workDefaults === undefined}
      />
      <ChurchInvitationPanel
        activeChurchId={activeChurch.id}
        pendingInvitations={activeChurch.invitations.filter(
          (invitation) => invitation.status === "pending",
        )}
      />
      <ChurchTimeZoneSettings activeChurch={activeChurch} churchTimeZone={churchTimeZone} />
    </section>
  );
}

type TeamSetupTeam = {
  id: string;
  name: string;
  sortOrder: number;
  defaultWorkflowId: string | null;
};

type WorkflowSetupWorkflow = {
  id: string;
  key: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  archivedAt: string | null;
};

type WorkflowSetupStatus = {
  id: string;
  workflowId: string;
  key: string;
  name: string;
  taskState: "todo" | "in_progress" | "done" | "canceled";
  sortOrder: number;
  archivedAt: string | null;
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
        ) : (
          <p className="text-sm text-muted-foreground">
            Only Church owners and admins can change Teams.
          </p>
        )}
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
        ) : (
          <p className="text-sm text-muted-foreground">
            Only Church owners and admins can change Team Memberships.
          </p>
        )}
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

function WorkflowSettingsCard({
  activeChurch,
  teams,
  workflows,
  isLoading,
}: {
  activeChurch: ActiveChurch;
  teams: readonly TeamSetupTeam[];
  workflows: readonly WorkflowSetupWorkflow[];
  isLoading: boolean;
}) {
  const createWorkflow = useMutation(api.workflows.createForChurch);
  const renameWorkflow = useMutation(api.workflows.renameForChurch);
  const reorderWorkflows = useMutation(api.workflows.reorderForChurch);
  const archiveWorkflow = useMutation(api.workflows.archiveForChurch);
  const setDefaultWorkflow = useMutation(api.workflows.setDefaultForChurch);
  const updateTeamProductFields = useMutation(api.teams.updateProductFields);
  const canManage = canMutateChurchSettings(activeChurch.role);
  const activeWorkflows = workflows.filter((workflow) => workflow.archivedAt === null);
  const defaultWorkflow = activeWorkflows.find((workflow) => workflow.isDefault);
  const workflowsById = new Map(activeWorkflows.map((workflow) => [workflow.id, workflow]));
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [archiveBlockMessage, setArchiveBlockMessage] = useState<string | null>(null);

  const runWorkflowMutation = async (
    action: string,
    mutation: () => Promise<{ ok: boolean; error?: { message: string } }>,
    onSuccess: () => void,
    onBlocked?: (message: string) => void,
  ) => {
    setError(null);
    setSuccess(null);
    setPendingAction(action);
    const result = await mutation();
    setPendingAction(null);

    if (!result.ok) {
      const message = result.error?.message ?? "Could not update Workflows.";
      if (onBlocked) onBlocked(message);
      else setError(message);
      return;
    }

    onSuccess();
  };

  const moveWorkflow = (workflow: WorkflowSetupWorkflow, direction: -1 | 1) => {
    const fromIndex = activeWorkflows.findIndex((candidate) => candidate.id === workflow.id);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= activeWorkflows.length) return;

    const workflowIds = activeWorkflows.map((candidate) => candidate.id);
    const [workflowId] = workflowIds.splice(fromIndex, 1);
    workflowIds.splice(toIndex, 0, workflowId);
    void runWorkflowMutation(
      `reorder-${workflow.id}`,
      () => reorderWorkflows({ churchId: activeChurch.id, workflowIds }),
      () => setSuccess("Reordered Workflows."),
    );
  };

  return (
    <Card role="region" aria-labelledby="workflows-settings-title">
      <CardHeader>
        <CardTitle id="workflows-settings-title">Workflows</CardTitle>
        <CardDescription>
          Church-scoped processes available to Teams and Tasks. Teams fall back to the Church
          default Workflow unless one is assigned here.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading Workflows..." : `${activeWorkflows.length} active Workflows`}
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
              const name = newWorkflowName.trim();
              if (!name) return;
              void runWorkflowMutation(
                "create",
                () =>
                  createWorkflow({
                    churchId: activeChurch.id,
                    key: workflowKey(name),
                    name,
                    isDefault: activeWorkflows.length === 0,
                    sortOrder: activeWorkflows.length,
                    statuses: defaultWorkflowStatuses(),
                  }),
                () => {
                  setNewWorkflowName("");
                  setSuccess(`Created Workflow ${name}.`);
                },
              );
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="new-workflow-name">New Workflow Name</Label>
              <Input
                id="new-workflow-name"
                value={newWorkflowName}
                disabled={pendingAction === "create"}
                onChange={(event) => setNewWorkflowName(event.currentTarget.value)}
              />
            </div>
            <Button type="submit" disabled={pendingAction === "create" || !newWorkflowName.trim()}>
              {pendingAction === "create" ? "Creating..." : "Create Workflow"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            Only Church owners and admins can change Workflows.
          </p>
        )}
        {canManage ? (
          <div className="grid gap-2">
            <Label htmlFor="church-default-workflow">Church Default Workflow</Label>
            <NativeSelect
              id="church-default-workflow"
              value={defaultWorkflow?.id ?? ""}
              disabled={pendingAction === "set-default" || activeWorkflows.length === 0}
              onChange={(event) => {
                const workflowId = event.currentTarget.value;
                const workflow = workflowsById.get(workflowId);
                if (!workflow || workflow.isDefault) return;
                void runWorkflowMutation(
                  "set-default",
                  () => setDefaultWorkflow({ churchId: activeChurch.id, workflowId }),
                  () => setSuccess(`Set ${workflow.name} as the Church default Workflow.`),
                );
              }}
            >
              {activeWorkflows.map((workflow) => (
                <NativeSelectOption key={workflow.id} value={workflow.id}>
                  {workflow.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workflow</TableHead>
              {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeWorkflows.map((workflow, index) => {
              const draftName = renameDrafts[workflow.id] ?? workflow.name;

              return (
                <TableRow key={workflow.id}>
                  <TableCell>
                    {canManage ? (
                      <div className="grid gap-2">
                        <Label className="sr-only" htmlFor={`rename-workflow-${workflow.id}`}>
                          Rename {workflow.name}
                        </Label>
                        <Input
                          id={`rename-workflow-${workflow.id}`}
                          value={draftName}
                          disabled={pendingAction === `rename-${workflow.id}`}
                          onChange={(event) =>
                            setRenameDrafts((drafts) => ({
                              ...drafts,
                              [workflow.id]: event.currentTarget.value,
                            }))
                          }
                        />
                        {workflow.isDefault ? (
                          <Badge variant="secondary">Church default</Badge>
                        ) : null}
                      </div>
                    ) : (
                      <span>{workflow.name}</span>
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
                            pendingAction === `rename-${workflow.id}` ||
                            !draftName.trim() ||
                            draftName.trim() === workflow.name
                          }
                          onClick={() => {
                            const name = draftName.trim();
                            void runWorkflowMutation(
                              `rename-${workflow.id}`,
                              () =>
                                renameWorkflow({
                                  churchId: activeChurch.id,
                                  workflowId: workflow.id,
                                  name,
                                }),
                              () => setSuccess(`Renamed Workflow to ${name}.`),
                            );
                          }}
                        >
                          Rename Workflow {workflow.name}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={index === 0 || pendingAction === `reorder-${workflow.id}`}
                          onClick={() => moveWorkflow(workflow, -1)}
                        >
                          Move {workflow.name} Up
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            index === activeWorkflows.length - 1 ||
                            pendingAction === `reorder-${workflow.id}`
                          }
                          onClick={() => moveWorkflow(workflow, 1)}
                        >
                          Move {workflow.name} Down
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pendingAction === `archive-${workflow.id}`}
                          onClick={() =>
                            void runWorkflowMutation(
                              `archive-${workflow.id}`,
                              () =>
                                archiveWorkflow({
                                  churchId: activeChurch.id,
                                  workflowId: workflow.id,
                                }),
                              () => setSuccess(`Archived Workflow ${workflow.name}.`),
                              (message) => setArchiveBlockMessage(message),
                            )
                          }
                        >
                          Archive Workflow {workflow.name}
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {canManage && teams.length > 0 ? (
          <div className="grid gap-3">
            <h3 className="text-sm font-medium">Team Default Workflows</h3>
            {teams.map((team) => (
              <div key={team.id} className="grid gap-2">
                <Label htmlFor={`team-default-workflow-${team.id}`}>
                  Default Workflow for {team.name}
                </Label>
                <NativeSelect
                  id={`team-default-workflow-${team.id}`}
                  value={team.defaultWorkflowId ?? "church-default"}
                  disabled={pendingAction === `team-default-${team.id}`}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    const defaultWorkflowId = value === "church-default" ? null : value;
                    const workflow = defaultWorkflowId
                      ? workflowsById.get(defaultWorkflowId)
                      : null;
                    void runWorkflowMutation(
                      `team-default-${team.id}`,
                      () =>
                        updateTeamProductFields({
                          churchId: activeChurch.id,
                          updates: [{ teamId: team.id, fields: { defaultWorkflowId } }],
                        }),
                      () =>
                        setSuccess(
                          defaultWorkflowId && workflow
                            ? `Set ${team.name} to use ${workflow.name} by default.`
                            : `Set ${team.name} to use the Church default Workflow.`,
                        ),
                    );
                  }}
                >
                  <NativeSelectOption value="church-default">
                    Use Church default Workflow
                  </NativeSelectOption>
                  {activeWorkflows.map((workflow) => (
                    <NativeSelectOption key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
      <Dialog open={archiveBlockMessage !== null} onOpenChange={() => setArchiveBlockMessage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workflow Cannot Be Archived</DialogTitle>
            <DialogDescription>
              {archiveBlockMessage} Please reassign the Church default Workflow, Teams, or Tasks
              that still reference this Workflow first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function WorkflowStatusSettingsCard({
  activeChurch,
  workflows,
  workflowStatuses,
  isLoading,
}: {
  activeChurch: ActiveChurch;
  workflows: readonly WorkflowSetupWorkflow[];
  workflowStatuses: readonly WorkflowSetupStatus[];
  isLoading: boolean;
}) {
  const addStatus = useMutation(api.workflows.addStatus);
  const renameStatus = useMutation(api.workflows.renameStatus);
  const reorderStatuses = useMutation(api.workflows.reorderStatuses);
  const archiveStatus = useMutation(api.workflows.archiveStatus);
  const canManage = canMutateChurchSettings(activeChurch.role);
  const activeWorkflows = workflows.filter((workflow) => workflow.archivedAt === null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const currentWorkflowId = selectedWorkflowId || activeWorkflows[0]?.id || "";
  const currentWorkflow = activeWorkflows.find((workflow) => workflow.id === currentWorkflowId);
  const activeStatuses = workflowStatuses.filter(
    (status) => status.workflowId === currentWorkflowId && status.archivedAt === null,
  );
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusTaskState, setNewStatusTaskState] = useState<"todo" | "in_progress" | "done">(
    "in_progress",
  );
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [archiveBlockMessage, setArchiveBlockMessage] = useState<string | null>(null);

  const runStatusMutation = async (
    action: string,
    mutation: () => Promise<{ ok: boolean; error?: { message: string } }>,
    onSuccess: () => void,
    onFailure?: (message: string) => void,
  ) => {
    setError(null);
    setSuccess(null);
    setPendingAction(action);
    const result = await mutation();
    setPendingAction(null);

    if (!result.ok) {
      const message = result.error?.message ?? "Could not update Workflow Statuses.";
      if (onFailure) {
        onFailure(message);
        return;
      }

      setError(message);
      return;
    }

    onSuccess();
  };

  const moveStatus = (status: WorkflowSetupStatus, direction: -1 | 1) => {
    const fromIndex = activeStatuses.findIndex((candidate) => candidate.id === status.id);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= activeStatuses.length) return;

    const statusIds = activeStatuses.map((candidate) => candidate.id);
    const [statusId] = statusIds.splice(fromIndex, 1);
    statusIds.splice(toIndex, 0, statusId);
    void runStatusMutation(
      `reorder-${status.id}`,
      () =>
        reorderStatuses({ churchId: activeChurch.id, workflowId: currentWorkflowId, statusIds }),
      () => setSuccess("Reordered Workflow Statuses."),
    );
  };

  return (
    <Card role="region" aria-labelledby="workflow-statuses-settings-title">
      <CardHeader>
        <CardTitle id="workflow-statuses-settings-title">Workflow Statuses</CardTitle>
        <CardDescription>Visible process steps mapped to Task States.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Loading Workflow Statuses..."
            : `${activeStatuses.length} active Workflow Statuses`}
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
        <div className="grid gap-2">
          <Label htmlFor="workflow-status-workflow">Workflow for Status Editing</Label>
          <NativeSelect
            id="workflow-status-workflow"
            value={currentWorkflowId}
            disabled={activeWorkflows.length === 0}
            onChange={(event) => setSelectedWorkflowId(event.currentTarget.value)}
          >
            {activeWorkflows.map((workflow) => (
              <NativeSelectOption key={workflow.id} value={workflow.id}>
                {workflow.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        {canManage && currentWorkflow ? (
          <form
            className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              const name = newStatusName.trim();
              if (!name) return;
              void runStatusMutation(
                "add",
                () =>
                  addStatus({
                    churchId: activeChurch.id,
                    workflowId: currentWorkflow.id,
                    status: {
                      key: workflowKey(name),
                      name,
                      taskState: newStatusTaskState,
                      sortOrder: activeStatuses.length,
                    },
                  }),
                () => {
                  setNewStatusName("");
                  setSuccess(`Added Workflow Status ${name}.`);
                },
              );
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="new-workflow-status-name">New Workflow Status Name</Label>
              <Input
                id="new-workflow-status-name"
                value={newStatusName}
                disabled={pendingAction === "add"}
                onChange={(event) => setNewStatusName(event.currentTarget.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-workflow-status-task-state">New Workflow Status Task State</Label>
              <NativeSelect
                id="new-workflow-status-task-state"
                value={newStatusTaskState}
                disabled={pendingAction === "add"}
                onChange={(event) =>
                  setNewStatusTaskState(
                    event.currentTarget.value as "todo" | "in_progress" | "done",
                  )
                }
              >
                <NativeSelectOption value="todo">To Do</NativeSelectOption>
                <NativeSelectOption value="in_progress">In Progress</NativeSelectOption>
                <NativeSelectOption value="done">Done</NativeSelectOption>
              </NativeSelect>
            </div>
            <Button type="submit" disabled={pendingAction === "add" || !newStatusName.trim()}>
              {pendingAction === "add" ? "Adding..." : "Add Workflow Status"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            Only Church owners and admins can change Workflow Statuses.
          </p>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Task State</TableHead>
              {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeStatuses.map((status, index) => {
              const draftName = renameDrafts[status.id] ?? status.name;

              return (
                <TableRow key={status.id}>
                  <TableCell>
                    {canManage ? (
                      <div className="grid gap-2">
                        <Label className="sr-only" htmlFor={`rename-workflow-status-${status.id}`}>
                          Rename {status.name}
                        </Label>
                        <Input
                          id={`rename-workflow-status-${status.id}`}
                          value={draftName}
                          disabled={pendingAction === `rename-${status.id}`}
                          onChange={(event) =>
                            setRenameDrafts((drafts) => ({
                              ...drafts,
                              [status.id]: event.currentTarget.value,
                            }))
                          }
                        />
                      </div>
                    ) : (
                      status.name
                    )}
                  </TableCell>
                  <TableCell>{taskStateLabel(status.taskState)}</TableCell>
                  {canManage ? (
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            pendingAction === `rename-${status.id}` ||
                            !draftName.trim() ||
                            draftName.trim() === status.name
                          }
                          onClick={() => {
                            const name = draftName.trim();
                            void runStatusMutation(
                              `rename-${status.id}`,
                              () =>
                                renameStatus({
                                  churchId: activeChurch.id,
                                  statusId: status.id,
                                  name,
                                }),
                              () => setSuccess(`Renamed Workflow Status to ${name}.`),
                            );
                          }}
                        >
                          Rename Workflow Status {status.name}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={index === 0 || pendingAction === `reorder-${status.id}`}
                          onClick={() => moveStatus(status, -1)}
                        >
                          Move {status.name} Up
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            index === activeStatuses.length - 1 ||
                            pendingAction === `reorder-${status.id}`
                          }
                          onClick={() => moveStatus(status, 1)}
                        >
                          Move {status.name} Down
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pendingAction === `archive-${status.id}`}
                          onClick={() =>
                            void runStatusMutation(
                              `archive-${status.id}`,
                              () =>
                                archiveStatus({
                                  churchId: activeChurch.id,
                                  statusId: status.id,
                                  archivedAt: new Date().toISOString(),
                                }),
                              () => setSuccess(`Archived Workflow Status ${status.name}.`),
                              (message) => setArchiveBlockMessage(message),
                            )
                          }
                        >
                          Archive Workflow Status {status.name}
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
      <Dialog open={archiveBlockMessage !== null} onOpenChange={() => setArchiveBlockMessage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workflow Status Cannot Be Archived</DialogTitle>
            <DialogDescription>
              {archiveBlockMessage} Move Tasks using this status or keep one To Do, In Progress, and
              Done status before archiving it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function memberLabel(member: TeamSetupMember | undefined) {
  return member?.user.email ?? member?.user.name ?? "Church Member";
}

function workflowKey(name: string) {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return key || "workflow";
}

function defaultWorkflowStatuses() {
  return [
    { key: "to-do", name: "To Do", taskState: "todo" as const, sortOrder: 0 },
    { key: "in-progress", name: "In Progress", taskState: "in_progress" as const, sortOrder: 1 },
    { key: "done", name: "Done", taskState: "done" as const, sortOrder: 2 },
  ];
}

function taskStateLabel(taskState: WorkflowSetupStatus["taskState"]) {
  if (taskState === "todo") return "To Do";
  if (taskState === "in_progress") return "In Progress";
  return "Done";
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
  const [search, setSearch] = useState("");

  const churchList = churches ?? [];
  const filteredChurches = churchList.filter((church) =>
    church.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const activeChurchInitial = (activeChurchName?.trim().charAt(0) || "C").toLocaleUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {churches === undefined && !activeChurchName ? (
          <SidebarMenuButton className="pointer-events-none cursor-default" size="lg">
            <Skeleton className="size-8 shrink-0 rounded-lg bg-muted-foreground/20" />
            <div className="grid flex-1 gap-1.5 text-left text-sm leading-tight">
              <Skeleton className="h-3 w-24 bg-muted-foreground/20" />
              <Skeleton className="h-2.5 w-16 bg-muted-foreground/20" />
            </div>
            <span className="ml-auto text-muted-foreground/40">v</span>
          </SidebarMenuButton>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  className="cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  size="lg"
                />
              }
            >
              <>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground text-sm">
                  {activeChurchInitial}
                </span>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{activeChurchName ?? "No Church"}</span>
                  <span className="truncate text-muted-foreground text-xs">Church</span>
                </div>
                <span className="ml-auto text-muted-foreground">v</span>
              </>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              className="flex min-w-56 flex-col rounded-lg p-0"
              side="bottom"
              sideOffset={4}
            >
              {churchList.length > 5 ? (
                <div className="border-b p-2">
                  <Input
                    aria-label="Search churches"
                    className="h-8"
                    onChange={(event) => setSearch(event.currentTarget.value)}
                    onKeyDown={(event) => event.stopPropagation()}
                    placeholder="Search"
                    value={search}
                  />
                </div>
              ) : null}
              <div className="flex overflow-hidden">
                <ScrollArea className="w-full max-h-72">
                  <div className="p-1">
                    <DropdownMenuLabel className="text-muted-foreground text-xs">
                      Your Churches
                    </DropdownMenuLabel>
                    {churches === undefined ? (
                      <DropdownMenuItem disabled>Loading Churches...</DropdownMenuItem>
                    ) : filteredChurches.length > 0 ? (
                      filteredChurches.map((church) => {
                        const isActive = church.id === activeChurchId;
                        const isPending = pendingChurchId === church.id;
                        const churchInitial =
                          church.name.trim().charAt(0).toLocaleUpperCase() || "C";

                        return (
                          <DropdownMenuItem
                            className="gap-2"
                            disabled={isActive || isPending}
                            key={church.id}
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
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-md border bg-background font-medium text-xs">
                              {churchInitial}
                            </span>
                            <span className="line-clamp-2">
                              {isPending ? "Switching..." : church.name}
                            </span>
                            {isActive ? (
                              <span className="ml-auto text-muted-foreground text-xs">Active</span>
                            ) : null}
                          </DropdownMenuItem>
                        );
                      })
                    ) : (
                      <DropdownMenuItem disabled>No Churches found</DropdownMenuItem>
                    )}
                    {error ? (
                      <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5 text-destructive text-xs">{error}</div>
                      </>
                    ) : null}
                  </div>
                </ScrollArea>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function ChurchOnboardingGate({ activePanel }: { activePanel: ActiveDashboardPanel }) {
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
    return <PrivateDashboardContent activePanel={activePanel} />;
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

export function DashboardPage({ activePanel }: { activePanel: ActiveDashboardPanel }) {
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <>
      <Authenticated>
        <ChurchOnboardingGate activePanel={activePanel} />
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
