import refs from "@church-task/backend/confect/_generated/refs";
import { MainContainer, PageContainer, PageWrapper } from "@/components/pageComponents";
import { useAppForm } from "@/components/form/ts-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QueryResult, useQuery as useConfectQuery } from "@/data/query-hooks";
import { normalizeTeamIdentifier } from "@church-task/domain/Team";
import { revalidateLogic } from "@tanstack/react-form";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { Schema } from "effect";
import { useEffect, useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { TaskExecutionSurface } from "@/components/tasks/task-execution-surface";
import {
  resolveInsightsState,
  toInsightsSearchValue,
  type ResolvedInsightsState,
} from "@/components/tasks/task-insights-options";
import { TaskViewTopBar } from "@/components/tasks/task-view-top-bar";
import {
  getDefaultTaskViewTab,
  resolveTaskViewOptions,
  resolveTaskViewTab,
  toTaskViewSearchValue,
  type ResolvedTaskViewOptions,
  type TaskViewTab,
} from "@/components/tasks/task-view-options";
import { useUserInvitationsCollection } from "@/data/invitations/invitationsData.app";
import {
  useCurrentOrgOpt,
  useUpdateChurchTimeZoneMutation,
  type CurrentOrg,
} from "@/data/orgs/orgData.app";
import {
  useAddTeamMemberMutation,
  useArchiveTeamMutation,
  useCreateTeamMutation,
  useRemoveTeamMemberMutation,
  useRenameTeamMutation,
  useReorderTeamsMutation,
  useTeamMembershipsCollection,
  useTeamsCollection,
} from "@/data/teams/teamsData.app";
import { useChurchUsersCollection, type UserCollectionItem } from "@/data/users/usersData.app";
import {
  useAddWorkflowStatusMutation,
  useArchiveWorkflowMutation,
  useArchiveWorkflowStatusMutation,
  useRenameWorkflowMutation,
  useRenameWorkflowStatusMutation,
  useReorderWorkflowStatusesMutation,
  useReorderWorkflowsMutation,
  useWorkflowStatusesCollection,
  useWorkflowsCollection,
} from "@/data/workflows/workflowsData.app";
import { authClient } from "@/lib/auth-client";
import { InviteMemberButton, InviteMemberQuickAction } from "@/features/settings/invite-member";
import { useQuickActionOpeners } from "@/features/quick-actions/quick-actions-state";
import {
  getDashboardSearchForPanel,
  getUnavailableTeamBoardActions,
  resolveTeamByRouteIdentifier,
  type DashboardSearch,
} from "@/routes/-dashboard-utils";

export type ActiveDashboardPanel =
  | "my_work"
  | "our_work"
  | "settings"
  | { kind: "team"; teamIdentifier: string };

function PrivateDashboardContent({ activePanel }: { activePanel: ActiveDashboardPanel }) {
  const search = useSearch({ strict: false }) as DashboardSearch;
  const navigate = useNavigate();
  const privateData = useConfectQuery(refs.public.privateData.get);
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const setActivePanel = (panel: ActiveDashboardPanel) => {
    const routeSearch = getDashboardSearchForPanel(search);

    if (typeof panel === "object") {
      navigate({
        to: "/team/$teamIdentifier",
        params: { teamIdentifier: panel.teamIdentifier },
        search: routeSearch,
      });
      return;
    }

    navigate({
      to: panel === "my_work" ? "/my-work" : panel === "our_work" ? "/our-work" : "/settings",
      search: routeSearch,
    });
  };
  const currentUserId = activeChurch?.currentUserId ?? null;
  const teams = useTeamsCollection({ churchId: activeChurch?.id ?? null });
  const pendingInvitations =
    activeChurch?.invitations.filter((invitation) => invitation.status === "pending") ?? [];
  const activeTeams = teams.teamsCollection;
  const selectedTeam =
    typeof activePanel === "object"
      ? resolveTeamByRouteIdentifier(activeTeams, activePanel.teamIdentifier)
      : null;
  const canonicalTeamIdentifier = selectedTeam?.identifier ?? null;
  const unavailableTeamBoardActions = getUnavailableTeamBoardActions();
  const { openCreateTask } = useQuickActionOpeners();
  const showCreateTask =
    activePanel !== "settings" && Boolean(activeChurch) && Boolean(currentUserId);
  const showBoardSurface =
    activePanel !== "settings" &&
    Boolean(activeChurch) &&
    Boolean(currentUserId) &&
    !(typeof activePanel === "object" && !selectedTeam);

  const surface =
    typeof activePanel === "object"
      ? ("team_board" as const)
      : activePanel === "settings"
        ? ("my_work" as const)
        : activePanel;
  const showTopBar = showCreateTask && (typeof activePanel !== "object" || selectedTeam !== null);
  const activeTab = resolveTaskViewTab(surface, search.tab);
  const activeView = resolveTaskViewOptions(search.view);
  const activeInsights = resolveInsightsState(search.insights);

  useEffect(() => {
    if (typeof activePanel !== "object" || canonicalTeamIdentifier === null) return;

    if (normalizeTeamIdentifier(activePanel.teamIdentifier) !== canonicalTeamIdentifier) {
      void navigate({
        to: "/team/$teamIdentifier",
        params: { teamIdentifier: canonicalTeamIdentifier },
        replace: true,
        search: true,
      });
    }
  }, [activePanel, canonicalTeamIdentifier, navigate, search]);

  const setTab = (tab: TaskViewTab) => {
    void navigate({
      to: ".",
      replace: true,
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        tab: tab === getDefaultTaskViewTab(surface) ? undefined : tab,
      }),
    });
  };

  const setView = (view: ResolvedTaskViewOptions) => {
    void navigate({
      to: ".",
      replace: true,
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        view: toTaskViewSearchValue(view),
      }),
    });
  };

  const setInsights = (insights: ResolvedInsightsState) => {
    void navigate({
      to: ".",
      replace: true,
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        insights: toInsightsSearchValue(insights),
      }),
    });
  };

  const content = (
    <>
      {showTopBar ? (
        <TaskViewTopBar
          surface={surface}
          tab={activeTab}
          onTabChange={setTab}
          view={activeView}
          onViewChange={setView}
          insightsOpen={activeInsights.open}
          onToggleInsights={() => setInsights({ ...activeInsights, open: !activeInsights.open })}
          onCreateTask={() =>
            openCreateTask({
              assignTo: activePanel === "my_work" ? currentUserId : null,
              // On a Team Board the picker is preset to that Team (ADR 0013).
              teamId: selectedTeam?.id ?? null,
            })
          }
        />
      ) : null}
      {activePanel === "settings" && activeChurch ? (
        <ActiveChurchSettings activeChurch={activeChurch} />
      ) : typeof activePanel === "object" && !selectedTeam ? (
        <section className="grid gap-4 rounded-xl border bg-background p-4 shadow-xs">
          <h2 className="text-base font-semibold">Team board</h2>
          {teams.loading ? (
            <Skeleton className="h-4 w-44" />
          ) : (
            <p className="text-sm text-muted-foreground">Team board is unavailable.</p>
          )}
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
        </section>
      ) : activeChurch && currentUserId ? (
        <TaskExecutionSurface
          churchId={activeChurch.id}
          currentUserId={currentUserId}
          surface={surface}
          team={selectedTeam}
          teams={activeTeams.map((candidate) => ({ id: candidate.id, name: candidate.name }))}
          tab={activeTab}
          view={search.view}
          insights={activeInsights}
          onInsightsChange={setInsights}
        />
      ) : (
        <>
          <section className="grid gap-4 rounded-xl border bg-background p-4 shadow-xs">
            <div className="grid gap-1">
              <h2 className="text-base font-semibold">Church Home</h2>
              {QueryResult.isSuccess(privateData) ? (
                <p className="text-sm text-muted-foreground">
                  privateData: {privateData.value.message}
                </p>
              ) : (
                <Skeleton className="h-4 w-48" />
              )}
            </div>
          </section>
          <ActiveChurchInvitationPrompt />
          {activeChurch ? (
            <>
              <ChurchMembersPanel activeChurchId={activeChurch.id} />
              <ChurchInvitationPanel
                activeChurchId={activeChurch.id}
                activeChurchRole={activeChurch.role}
                pendingInvitations={pendingInvitations}
              />
            </>
          ) : null}
        </>
      )}
    </>
  );

  return (
    <MainContainer>
      {showBoardSurface ? (
        <PageWrapper variant="noPageContainer" className="gap-6">
          {content}
        </PageWrapper>
      ) : (
        <PageContainer wrapperClassName="gap-6">{content}</PageContainer>
      )}
    </MainContainer>
  );
}

type ActiveChurch = CurrentOrg;

function ActiveChurchSettings({ activeChurch }: { activeChurch: ActiveChurch }) {
  const teams = useTeamsCollection({ churchId: activeChurch.id });
  const teamMemberships = useTeamMembershipsCollection({ churchId: activeChurch.id });
  const members = useChurchUsersCollection({ churchId: activeChurch.id });
  const workflows = useWorkflowsCollection({ churchId: activeChurch.id });
  const workflowStatuses = useWorkflowStatusesCollection({ churchId: activeChurch.id });

  const activeTeams = teams.teamsCollection;
  const memberships = teamMemberships.teamMembershipsCollection;
  const churchTimeZone = activeChurch.churchTimeZone ?? "Not set";

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <TeamSettingsCard activeChurch={activeChurch} teams={activeTeams} isLoading={teams.loading} />
      <TeamMembershipSettingsCard
        activeChurch={activeChurch}
        teams={activeTeams}
        members={members.usersCollection}
        memberships={memberships}
        isLoading={teamMemberships.loading || members.loading}
      />
      <WorkflowSettingsCard
        activeChurch={activeChurch}
        teams={activeTeams}
        workflows={workflows.workflowsCollection}
        isLoading={workflows.loading}
      />
      <WorkflowStatusSettingsCard
        activeChurch={activeChurch}
        workflows={workflows.workflowsCollection}
        workflowStatuses={workflowStatuses.workflowStatusesCollection}
        isLoading={workflows.loading || workflowStatuses.loading}
      />
      <ChurchInvitationPanel
        activeChurchId={activeChurch.id}
        activeChurchRole={activeChurch.role}
        pendingInvitations={activeChurch.invitations.filter(
          (invitation) => invitation.status === "pending",
        )}
      />
      <ChurchTimeZoneSettings activeChurch={activeChurch} churchTimeZone={churchTimeZone} />
    </section>
  );
}

export function ChurchSettingsPanel() {
  const { currentOrgOpt: activeChurch, loading } = useCurrentOrgOpt();
  const churchTimeZone = activeChurch?.churchTimeZone ?? "Not set";

  if (loading) {
    return (
      <section className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 8 }, (_, index) => (
              <div className="grid gap-1" key={index}>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    );
  }

  if (!activeChurch) {
    return <p className="text-sm text-muted-foreground">No active Church selected.</p>;
  }

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Church Profile</CardTitle>
          <CardDescription>Core profile details for this Church.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <SettingsDetail label="Name" value={activeChurch.name} />
          <SettingsDetail label="Website" value={activeChurch.url ?? "Not set"} />
          <SettingsDetail label="Street" value={activeChurch.street ?? "Not set"} />
          <SettingsDetail label="City" value={activeChurch.city ?? "Not set"} />
          <SettingsDetail label="State / Region" value={activeChurch.state ?? "Not set"} />
          <SettingsDetail label="Postal Code" value={activeChurch.zip ?? "Not set"} />
          <SettingsDetail label="Country Code" value={activeChurch.countryCode ?? "Not set"} />
          <SettingsDetail label="Size" value={activeChurch.size ?? "Not set"} />
        </CardContent>
      </Card>
      <ChurchTimeZoneSettings activeChurch={activeChurch} churchTimeZone={churchTimeZone} />
      <Card>
        <CardHeader>
          <CardTitle>Technical</CardTitle>
          <CardDescription>Details you may need when contacting support.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsDetail label="Org Id" value={activeChurch.id} />
        </CardContent>
      </Card>
    </section>
  );
}

export function TeamMembersSettingsPanel() {
  const { currentOrgOpt: activeChurch, loading } = useCurrentOrgOpt();
  const teams = useTeamsCollection({ churchId: activeChurch?.id ?? null });
  const teamMemberships = useTeamMembershipsCollection({ churchId: activeChurch?.id ?? null });
  const members = useChurchUsersCollection({ churchId: activeChurch?.id ?? null });

  if (loading) {
    return (
      <section className="grid gap-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="grid gap-3">
            {[0, 1, 2].map((index) => (
              <Skeleton className="h-16 w-full rounded-lg" key={index} />
            ))}
          </CardContent>
        </Card>
      </section>
    );
  }

  if (!activeChurch) {
    return <p className="text-sm text-muted-foreground">No active Church selected.</p>;
  }

  return (
    <section className="grid gap-4">
      <ChurchMembersPanel activeChurchId={activeChurch.id} />
      <div className="grid gap-4 xl:grid-cols-2">
        <TeamSettingsCard
          activeChurch={activeChurch}
          teams={teams.teamsCollection}
          isLoading={teams.loading}
        />
        <TeamMembershipSettingsCard
          activeChurch={activeChurch}
          teams={teams.teamsCollection}
          members={members.usersCollection}
          memberships={teamMemberships.teamMembershipsCollection}
          isLoading={teamMemberships.loading || members.loading}
        />
      </div>
    </section>
  );
}

export function TeamInvitationsSettingsPanel() {
  const { currentOrgOpt: activeChurch, loading } = useCurrentOrgOpt();
  const pendingInvitations =
    activeChurch?.invitations.filter((invitation) => invitation.status === "pending") ?? [];

  if (loading) {
    return (
      <section className="grid gap-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </CardHeader>
          <CardContent className="grid gap-3">
            {[0, 1].map((index) => (
              <Skeleton className="h-12 w-full rounded-lg" key={index} />
            ))}
          </CardContent>
        </Card>
      </section>
    );
  }

  if (!activeChurch) {
    return <p className="text-sm text-muted-foreground">No active Church selected.</p>;
  }

  return (
    <section className="grid gap-4">
      <ActiveChurchInvitationPrompt />
      <ChurchInvitationPanel
        activeChurchId={activeChurch.id}
        activeChurchRole={activeChurch.role}
        pendingInvitations={pendingInvitations}
      />
    </section>
  );
}

function SettingsDetail({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="grid gap-1">
      <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </div>
      <div className="break-all">{value}</div>
    </div>
  );
}

type TeamSetupTeam = {
  id: string;
  name: string;
  sortOrder: number;
};

type WorkflowSetupWorkflow = {
  id: string;
  // Every Team owns its Workflow (ADR 0013): the owning Team's id.
  teamId: string;
  key: string;
  name: string;
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

type TeamSetupMember = UserCollectionItem;

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
  const createTeam = useCreateTeamMutation();
  const renameTeam = useRenameTeamMutation();
  const archiveTeam = useArchiveTeamMutation();
  const reorderTeams = useReorderTeamsMutation();
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
        {isLoading ? (
          <Skeleton className="h-4 w-32" />
        ) : (
          <p className="text-sm text-muted-foreground">{teams.length} active Teams</p>
        )}
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
  const addTeamMember = useAddTeamMemberMutation();
  const removeTeamMember = useRemoveTeamMemberMutation();
  const canManage = canMutateChurchSettings(activeChurch.role);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const membersByUserId = new Map(members.map((member) => [member.id, member]));
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
        {isLoading ? (
          <Skeleton className="h-4 w-40" />
        ) : (
          <p className="text-sm text-muted-foreground">
            {visibleMemberships.length} Team Memberships
          </p>
        )}
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
                  <NativeSelectOption key={member.memberId} value={member.id}>
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
  const renameWorkflow = useRenameWorkflowMutation();
  const reorderWorkflows = useReorderWorkflowsMutation();
  const archiveWorkflow = useArchiveWorkflowMutation();
  const canManage = canMutateChurchSettings(activeChurch.role);
  const activeWorkflows = workflows.filter((workflow) => workflow.archivedAt === null);
  const teamsById = new Map(teams.map((team) => [team.id, team]));
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
          Every Team owns its Workflow. New Teams start with To Do, In Progress, and Done, and each
          Team's Workflow can be customized independently.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {isLoading ? (
          <Skeleton className="h-4 w-36" />
        ) : (
          <p className="text-sm text-muted-foreground">{activeWorkflows.length} active Workflows</p>
        )}
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
        {canManage ? null : (
          <p className="text-sm text-muted-foreground">
            Only Church owners and admins can change Workflows.
          </p>
        )}
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
                        {teamsById.has(workflow.teamId) ? (
                          <Badge variant="secondary">{teamsById.get(workflow.teamId)?.name}</Badge>
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
      </CardContent>
      <Dialog open={archiveBlockMessage !== null} onOpenChange={() => setArchiveBlockMessage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workflow Cannot Be Archived</DialogTitle>
            <DialogDescription>
              {archiveBlockMessage} A Workflow owned by an active Team or referenced by Tasks cannot
              be archived.
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
  const addStatus = useAddWorkflowStatusMutation();
  const renameStatus = useRenameWorkflowStatusMutation();
  const reorderStatuses = useReorderWorkflowStatusesMutation();
  const archiveStatus = useArchiveWorkflowStatusMutation();
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
        {isLoading ? (
          <Skeleton className="h-4 w-44" />
        ) : (
          <p className="text-sm text-muted-foreground">
            {activeStatuses.length} active Workflow Statuses
          </p>
        )}
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
  return member?.email ?? member?.name ?? "Church Member";
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
  const updateTimeZone = useUpdateChurchTimeZoneMutation();
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
  const invitations = useUserInvitationsCollection();
  const [error, setError] = useState<string | null>(null);
  const [acceptingInvitationId, setAcceptingInvitationId] = useState<string | null>(null);
  const pendingInvitations = invitations.invitationsCollection;

  if (invitations.loading || (!error && pendingInvitations.length === 0)) {
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
  const members = useChurchUsersCollection({ churchId: activeChurchId });
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
        {members.loading ? (
          <>
            {[0, 1, 2].map((index) => (
              <Skeleton className="h-16 w-full rounded-lg" key={index} />
            ))}
          </>
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
        {!members.loading && !error && members.usersCollection.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Church Members found.</p>
        ) : null}
        {members.usersCollection.map((member) => {
          const isOwner = memberHasRole(member.role, "owner");
          const roleLabel = invitationRoleLabel(member.role);
          const isUpdating = updatingMemberId === member.memberId;
          const isRemoving = removingMemberId === member.memberId;

          return (
            <Item key={member.memberId} variant="outline">
              <ItemContent>
                <ItemTitle>{member.name ?? "Unnamed member"}</ItemTitle>
                <ItemDescription>{member.email ?? "No email"}</ItemDescription>
              </ItemContent>
              {isOwner ? (
                <Badge variant="secondary" className="capitalize">
                  {roleLabel}
                </Badge>
              ) : (
                <ItemActions className="flex-wrap">
                  <Label className="sr-only" htmlFor={`member-role-${member.memberId}`}>
                    Role for {member.email ?? member.name ?? "Church member"}
                  </Label>
                  <Select
                    value={memberHasRole(member.role, "admin") ? "admin" : "member"}
                    disabled={isUpdating || isRemoving}
                    onValueChange={async (value) => {
                      const nextRole = value as InvitationRole;
                      setError(null);
                      setSuccess(null);
                      setUpdatingMemberId(member.memberId);
                      const result = await authClient.organization.updateMemberRole({
                        organizationId: activeChurchId,
                        memberId: member.memberId,
                        role: nextRole,
                      });
                      setUpdatingMemberId(null);

                      if (result.error) {
                        setError(result.error.message ?? "Could not update Church Member role.");
                        return;
                      }

                      setSuccess(`Updated ${member.email ?? "Church Member"} to ${nextRole}.`);
                    }}
                  >
                    <SelectTrigger id={`member-role-${member.memberId}`} className="w-32">
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
                    aria-label={`Remove ${member.email ?? member.name ?? "Church Member"}`}
                    disabled={isUpdating || isRemoving}
                    onClick={async () => {
                      setError(null);
                      setSuccess(null);
                      setRemovingMemberId(member.memberId);
                      const result = await authClient.organization.removeMember({
                        organizationId: activeChurchId,
                        memberIdOrEmail: member.memberId,
                      });
                      setRemovingMemberId(null);

                      if (result.error) {
                        setError(result.error.message ?? "Could not remove Church Member.");
                        return;
                      }

                      setSuccess(`Removed ${member.email ?? "Church Member"}.`);
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
  activeChurchRole,
  pendingInvitations,
}: {
  activeChurchId: string;
  activeChurchRole: string | string[];
  pendingInvitations: PendingInvitation[];
}) {
  const canInvite = canMutateChurchSettings(activeChurchRole);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1.5">
          <CardTitle>Church Invitations</CardTitle>
          <CardDescription>
            Invite people to this Church and track pending invitations.
          </CardDescription>
        </div>
        <InviteMemberButton disabled={!canInvite} size="sm" variant="secondary" />
      </CardHeader>
      <CardContent className="grid gap-3">
        {!canInvite ? (
          <Alert>
            <AlertDescription>
              Only Church owners and admins can invite Church members.
            </AlertDescription>
          </Alert>
        ) : null}
        <InviteMemberQuickAction
          activeChurchId={activeChurchId}
          activeChurchRole={activeChurchRole}
          source="settings"
        />
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

function ChurchOnboardingGate({ activePanel }: { activePanel: ActiveDashboardPanel }) {
  const { currentOrgOpt: activeChurch, loading: activeChurchLoading } = useCurrentOrgOpt();
  const hasActiveChurch = Boolean(activeChurch);
  const [error, setError] = useState<string | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const pendingInvitations = useUserInvitationsCollection();
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

  if (activeChurchLoading) {
    return (
      <MainContainer>
        <PageContainer wrapperClassName="gap-6">
          <div className="flex justify-end">
            <Skeleton className="h-9 w-28" />
          </div>
          <section className="grid gap-4 rounded-xl border bg-background p-4 shadow-xs">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </section>
        </PageContainer>
      </MainContainer>
    );
  }

  if (hasActiveChurch) {
    return <PrivateDashboardContent activePanel={activePanel} />;
  }

  if (pendingInvitations.loading) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col justify-center p-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-4 w-full max-w-md" />
          </CardHeader>
          <CardContent className="grid gap-4">
            <Skeleton className="h-16 w-full rounded-lg" />
          </CardContent>
        </Card>
      </main>
    );
  }

  if (pendingInvitations.invitationsCollection.length > 0) {
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
            {pendingInvitations.invitationsCollection.map((invitation) => {
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
        {showSignIn ? <SignInForm /> : <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />}
      </Unauthenticated>
    </>
  );
}
