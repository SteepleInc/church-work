export const AGENT_PARITY_COVERAGE_STATUSES = [
  "covered",
  "partial",
  "missing",
  "generic-passthrough",
] as const;

export type AgentParityCoverageStatus = (typeof AGENT_PARITY_COVERAGE_STATUSES)[number];

export type AgentParitySurfaceCoverage = {
  readonly status: AgentParityCoverageStatus;
  readonly command?: string;
  readonly notes?: string;
  readonly tool?: string;
};

export type AgentOperationRegistryEntry = {
  readonly authorization: string;
  readonly context: {
    readonly requiresActiveChurch: boolean;
    readonly requiresChurchMembership: boolean;
    readonly session: "authenticated" | "anonymous";
  };
  readonly domainArea: string;
  readonly id: string;
  readonly inputContract: string;
  readonly kind: "read" | "write";
  readonly operation: string;
  readonly outputContract: string;
  readonly surfaces: {
    readonly cli: AgentParitySurfaceCoverage;
    readonly mcp: AgentParitySurfaceCoverage;
    readonly ui: AgentParitySurfaceCoverage;
  };
  readonly uiBehavior: string;
};

const TEAM_MANAGEMENT_AUTHORIZATION = "Church owner, Church admin, or App Administrator";
const TASK_COMMENT_MODERATION_AUTHORIZATION =
  "Task Comment author, Church owner, Church admin, or App Administrator";

const ACTIVE_CHURCH_MEMBERSHIP_CONTEXT = {
  requiresActiveChurch: true,
  requiresChurchMembership: true,
  session: "authenticated",
} as const satisfies AgentOperationRegistryEntry["context"];

const missingNamedAgentSurface = {
  notes: "No named CLI command yet.",
  status: "missing",
} as const satisfies AgentParitySurfaceCoverage;

const missingFocusedAgentSurface = {
  notes: "No focused MCP/API operation yet.",
  status: "missing",
} as const satisfies AgentParitySurfaceCoverage;

const UI_ONLY_TEAM_SURFACES = {
  cli: missingNamedAgentSurface,
  mcp: missingFocusedAgentSurface,
  ui: { status: "covered" },
} as const satisfies AgentOperationRegistryEntry["surfaces"];

const UI_ONLY_COMMENT_SURFACES = {
  cli: missingNamedAgentSurface,
  mcp: missingFocusedAgentSurface,
  ui: {
    notes:
      "Inspected TaskActivityFeed, taskCommentsData.app hooks, taskCommentModeration-utils, and Zero Task Comment mutators.",
    status: "covered",
  },
} as const satisfies AgentOperationRegistryEntry["surfaces"];

const coveredTaskOperation = (
  entry: Pick<
    AgentOperationRegistryEntry,
    "id" | "inputContract" | "kind" | "operation" | "outputContract" | "uiBehavior"
  > & { readonly command: string; readonly tool: string },
): AgentOperationRegistryEntry => ({
  authorization: "Church Membership",
  context: {
    requiresActiveChurch: true,
    requiresChurchMembership: true,
    session: "authenticated",
  },
  domainArea: "Task",
  id: entry.id,
  inputContract: entry.inputContract,
  kind: entry.kind,
  operation: entry.operation,
  outputContract: entry.outputContract,
  surfaces: {
    cli: { command: entry.command, status: "covered" },
    mcp: { status: "covered", tool: entry.tool },
    ui: {
      notes:
        "Inspected Work page TaskExecutionSurface, Task details pane, and Task field controls.",
      status: "covered",
    },
  },
  uiBehavior: entry.uiBehavior,
});

export const AGENT_OPERATION_REGISTRY = [
  {
    authorization: "Authenticated User",
    context: {
      requiresActiveChurch: false,
      requiresChurchMembership: false,
      session: "anonymous",
    },
    domainArea: "User",
    id: "user.current",
    inputContract: "optional browser session cookie or CLI API key bearer token",
    kind: "read",
    operation: "Read Current User",
    outputContract: "current User identity or null for an anonymous caller",
    surfaces: {
      cli: { command: "church-work current-user", status: "covered" },
      mcp: { status: "covered", tool: "GET /api/agent/current-user" },
      ui: {
        notes: "Inspected shared useSession hook and auth guard consumers.",
        status: "covered",
      },
    },
    uiBehavior:
      "Shared useSession reads the current User and allows anonymous/null while auth resolves",
  },
  {
    authorization: "Church Membership",
    context: {
      requiresActiveChurch: true,
      requiresChurchMembership: true,
      session: "authenticated",
    },
    domainArea: "Church",
    id: "church.active.resolve",
    inputContract: "optional churchId override; otherwise session Active Church",
    kind: "read",
    operation: "Resolve Active Church",
    outputContract:
      "Active Church, Church Membership role, noActiveChurch state, or structured authentication/membership error",
    surfaces: {
      cli: { command: "church-work active-church", status: "covered" },
      mcp: { status: "covered", tool: "POST /api/agent/active-church" },
      ui: {
        notes:
          "Inspected useCurrentOrgOpt/useAuthGuard and Work page Active Church fallback behavior.",
        status: "covered",
      },
    },
    uiBehavior:
      "App shell and Work page resolve Active Church from session activeOrganizationId and membership-backed Church data",
  },
  {
    authorization: "Church Membership",
    context: {
      requiresActiveChurch: true,
      requiresChurchMembership: true,
      session: "authenticated",
    },
    domainArea: "Task",
    id: "task.list",
    inputContract:
      "churchId plus optional surface, Week/Cycle, Team, assignee, Workflow Status, Task State, and priority filters",
    kind: "read",
    operation: "List Tasks",
    outputContract:
      "Task collection rows with Task Identifier, Team, Status, Week/Cycle, assignee, due date, and priority fields",
    surfaces: {
      cli: {
        command: "church-work task list",
        status: "covered",
      },
      mcp: {
        status: "covered",
        tool: "list-tasks",
      },
      ui: {
        notes:
          "Inspected apps/web/src/routes/-work-page.tsx and useTasksCollection in tasksData.app.ts.",
        status: "covered",
      },
    },
    uiBehavior: "Work page TaskExecutionSurface lists Tasks from useTasksCollection",
  },
  {
    authorization: TEAM_MANAGEMENT_AUTHORIZATION,
    context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
    domainArea: "Team",
    id: "team.create",
    inputContract: "churchId and Team name",
    kind: "write",
    operation: "Create Team",
    outputContract: "created Team plus creator Team Membership and default Workflow setup",
    surfaces: UI_ONLY_TEAM_SURFACES,
    uiBehavior:
      "Settings and sidebar Team creation use useCreateTeamMutation, which creates the Team, creator Team Membership, owned Workflow, and default Workflow Statuses",
  },
  {
    authorization: TEAM_MANAGEMENT_AUTHORIZATION,
    context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
    domainArea: "Team",
    id: "team.rename",
    inputContract: "churchId, teamId, and non-empty Team name",
    kind: "write",
    operation: "Rename Team",
    outputContract: "updated Team name or validation error",
    surfaces: UI_ONLY_TEAM_SURFACES,
    uiBehavior: "Team settings use useRenameTeamMutation and trim blank Team names",
  },
  {
    authorization: TEAM_MANAGEMENT_AUTHORIZATION,
    context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
    domainArea: "Team",
    id: "team.identifier.change",
    inputContract: "churchId, teamId, and 1-6 character Team Identifier",
    kind: "write",
    operation: "Change Team Identifier",
    outputContract: "updated Team Identifier with prior identifier retained as a route alias",
    surfaces: UI_ONLY_TEAM_SURFACES,
    uiBehavior:
      "Team settings use useSetTeamIdentifierMutation, normalize to uppercase, reject invalid or duplicate identifiers, and preserve previous identifiers",
  },
  {
    authorization: TEAM_MANAGEMENT_AUTHORIZATION,
    context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
    domainArea: "Team",
    id: "team.delete",
    inputContract: "churchId and teamId",
    kind: "write",
    operation: "Delete Team",
    outputContract: "soft-deleted Team plus owned Workflow and Workflow Status cleanup",
    surfaces: UI_ONLY_TEAM_SURFACES,
    uiBehavior:
      "Team settings use useDeleteTeamMutation after confirmation and remove Team Memberships for that Team",
  },
  {
    authorization: TEAM_MANAGEMENT_AUTHORIZATION,
    context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
    domainArea: "Team",
    id: "team.reorder",
    inputContract: "churchId and ordered Team IDs",
    kind: "write",
    operation: "Reorder Teams",
    outputContract: "updated Team sort_order values",
    surfaces: UI_ONLY_TEAM_SURFACES,
    uiBehavior: "Settings Team list uses useReorderTeamsMutation to persist Team order per Church",
  },
  {
    authorization: TEAM_MANAGEMENT_AUTHORIZATION,
    context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
    domainArea: "Team Membership",
    id: "team.membership.add",
    inputContract: "churchId, teamId, and userId",
    kind: "write",
    operation: "Add Team Membership",
    outputContract: "created Team Membership or no-op when it already exists",
    surfaces: UI_ONLY_TEAM_SURFACES,
    uiBehavior:
      "Team navigation membership action uses useAddTeamMemberMutation and de-duplicates existing Team Memberships",
  },
  {
    authorization: TEAM_MANAGEMENT_AUTHORIZATION,
    context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
    domainArea: "Team Membership",
    id: "team.membership.remove",
    inputContract: "churchId, teamId, and userId",
    kind: "write",
    operation: "Remove Team Membership",
    outputContract: "removed Team Membership",
    surfaces: UI_ONLY_TEAM_SURFACES,
    uiBehavior: "Team navigation membership action uses useRemoveTeamMemberMutation",
  },
  coveredTaskOperation({
    command: "church-work task get",
    id: "task.get",
    inputContract: "churchId plus taskId or Task Identifier (for example TEAM-123)",
    kind: "read",
    operation: "Get Task",
    outputContract:
      "Task row with Task Identifier, Team, Status, Week/Cycle, assignee, due date, and priority fields",
    tool: "get-task",
    uiBehavior: "Task details pane opens a Task by its selected collection row/identifier",
  }),
  coveredTaskOperation({
    command: "church-work task create",
    id: "task.create",
    inputContract:
      "churchId, title, Team, Workflow Status, due date, optional assignee, parent Task, and priority",
    kind: "write",
    operation: "Create Task",
    outputContract:
      "created Task with Team-derived Task Identifier and Workflow Status-derived Task State",
    tool: "create-task",
    uiBehavior:
      "Create Task flow requires a Team, Workflow Status, title, and Due Date before creating work",
  }),
  coveredTaskOperation({
    command: "church-work task update",
    id: "task.update",
    inputContract: "churchId plus taskId or Task Identifier and editable Task fields",
    kind: "write",
    operation: "Update Task",
    outputContract:
      "updated Task with Team, Workflow Status, Task State, assignee, priority, parent, Week/Cycle, and Due Date changes",
    tool: "update-task",
    uiBehavior:
      "Task field controls persist title, Team, Workflow Status, assignee, priority, parent, Week/Cycle, and Due Date edits",
  }),
  coveredTaskOperation({
    command: "church-work task complete",
    id: "task.complete",
    inputContract: "churchId plus taskId or Task Identifier",
    kind: "write",
    operation: "Complete Task",
    outputContract:
      "Task moved to done Task State with matching Workflow Status and finished timestamp",
    tool: "complete-task",
    uiBehavior: "Task status controls can move a Task to a completed Workflow Status",
  }),
  coveredTaskOperation({
    command: "church-work task cancel",
    id: "task.cancel",
    inputContract: "churchId plus taskId or Task Identifier",
    kind: "write",
    operation: "Cancel Task",
    outputContract:
      "Task moved to canceled Task State with matching Workflow Status and finished timestamp",
    tool: "cancel-task",
    uiBehavior: "Task status controls can move a Task to a canceled Workflow Status",
  }),
  coveredTaskOperation({
    command: "church-work task reopen",
    id: "task.reopen",
    inputContract: "churchId plus taskId or Task Identifier",
    kind: "write",
    operation: "Reopen Task",
    outputContract:
      "Task moved back to todo Task State with matching Workflow Status and no finished timestamp",
    tool: "reopen-task",
    uiBehavior: "Task status controls can reopen finished or canceled Tasks into active work",
  }),
  {
    authorization: "Church Membership",
    context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
    domainArea: "Task Comment",
    id: "task.comment.create",
    inputContract: "churchId, taskId, and non-empty Markdown/plaintext comment body",
    kind: "write",
    operation: "Create Task Comment",
    outputContract: "created root Task Comment plus comment_created Activity Feed item",
    surfaces: UI_ONLY_COMMENT_SURFACES,
    uiBehavior:
      "Task Activity Feed composer creates a root Task Comment after requiring an Active Church and non-empty body",
  },
  {
    authorization: "Church Membership",
    context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
    domainArea: "Task Comment",
    id: "task.comment.reply",
    inputContract:
      "churchId, taskId, root parent Task Comment only; replies are one level deep, and non-empty reply body",
    kind: "write",
    operation: "Reply to Task Comment",
    outputContract:
      "created reply Task Comment plus reply_created Activity Feed item and subscribed-user reply notifications",
    surfaces: UI_ONLY_COMMENT_SURFACES,
    uiBehavior:
      "Task Activity Feed Reply composer creates a one-level reply under a root Task Comment and rejects nested replies in the Zero mutator",
  },
  {
    authorization: TASK_COMMENT_MODERATION_AUTHORIZATION,
    context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
    domainArea: "Task Comment",
    id: "task.comment.update",
    inputContract: "churchId, commentId, and non-empty replacement body",
    kind: "write",
    operation: "Edit Task Comment",
    outputContract:
      "updated Task Comment body, updated timestamp, and comment_updated Activity Feed item",
    surfaces: UI_ONLY_COMMENT_SURFACES,
    uiBehavior:
      "Task Comment and reply action menus expose inline Edit only to the author, Church owner/admin, or App Administrator",
  },
  {
    authorization: TASK_COMMENT_MODERATION_AUTHORIZATION,
    context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
    domainArea: "Task Comment",
    id: "task.comment.delete",
    inputContract: "churchId and commentId",
    kind: "write",
    operation: "Delete Task Comment",
    outputContract: "soft-deleted Task Comment tombstone plus comment_deleted Activity Feed item",
    surfaces: UI_ONLY_COMMENT_SURFACES,
    uiBehavior:
      "Task Comment and reply action menus expose confirmed Delete only to the author, Church owner/admin, or App Administrator and leave a tombstone",
  },
  {
    authorization: "Church Membership",
    context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
    domainArea: "Comment Thread",
    id: "task.comment.thread.subscribe",
    inputContract: "churchId and rootCommentId for a non-deleted root Task Comment",
    kind: "write",
    operation: "Subscribe to Comment Thread",
    outputContract: "persisted current-User Comment Thread subscription",
    surfaces: UI_ONLY_COMMENT_SURFACES,
    uiBehavior:
      "Root Task Comment action menu toggles a persisted Comment Thread subscription and shows a subscribed indicator for the current User",
  },
  {
    authorization: "Church Membership",
    context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
    domainArea: "Comment Thread",
    id: "task.comment.thread.unsubscribe",
    inputContract: "churchId and rootCommentId for the current User's Comment Thread subscription",
    kind: "write",
    operation: "Unsubscribe from Comment Thread",
    outputContract: "soft-deleted current-User Comment Thread subscription",
    surfaces: UI_ONLY_COMMENT_SURFACES,
    uiBehavior:
      "Root Task Comment action menu can unsubscribe the current User from the Comment Thread and removes the subscribed indicator",
  },
] as const satisfies ReadonlyArray<AgentOperationRegistryEntry>;

const surfaceStatus = (surface: AgentParitySurfaceCoverage) => surface.status;

const markdownTableCell = (value: string) => value.replaceAll("\\", "\\\\").replaceAll("|", "\\|");

const contextSummary = (entry: AgentOperationRegistryEntry) =>
  [
    entry.context.session,
    entry.context.requiresActiveChurch ? "Active Church" : null,
    entry.context.requiresChurchMembership ? "Church Membership" : null,
  ]
    .filter((value): value is string => value !== null)
    .join(", ");

export const generateAgentParityReport = (
  registry: ReadonlyArray<AgentOperationRegistryEntry> = AGENT_OPERATION_REGISTRY,
) => {
  const rows = registry.map(
    (entry) =>
      `| ${[
        entry.domainArea,
        entry.operation,
        entry.kind,
        surfaceStatus(entry.surfaces.ui),
        surfaceStatus(entry.surfaces.mcp),
        surfaceStatus(entry.surfaces.cli),
        contextSummary(entry),
        entry.uiBehavior,
      ]
        .map(markdownTableCell)
        .join(" | ")} |`,
  );

  return [
    "# Church Work Agent Operation Parity Report",
    "",
    `Coverage statuses: ${AGENT_PARITY_COVERAGE_STATUSES.join(", ")}`,
    "",
    "| Domain Area | Operation | Kind | UI | MCP | CLI | Context | UI Behavior |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
};
