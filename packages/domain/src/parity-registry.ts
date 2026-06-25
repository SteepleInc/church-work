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

const templateCliSurface = (command: string): AgentParitySurfaceCoverage =>
  command === "church-work template create-weekly-service"
    ? { command, status: "covered" }
    : {
        command,
        notes:
          "Available through the generic CLI MCP passthrough; no named Template lifecycle command yet.",
        status: "generic-passthrough",
      };

const coveredTemplateOperation = (
  entry: Pick<
    AgentOperationRegistryEntry,
    "id" | "inputContract" | "kind" | "operation" | "outputContract" | "uiBehavior"
  > & { readonly command: string; readonly tool: string },
): AgentOperationRegistryEntry => ({
  authorization: "Church Membership",
  context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
  domainArea: "Template",
  id: entry.id,
  inputContract: entry.inputContract,
  kind: entry.kind,
  operation: entry.operation,
  outputContract: entry.outputContract,
  surfaces: {
    cli: templateCliSurface(entry.command),
    mcp: { status: "covered", tool: entry.tool },
    ui: {
      notes:
        "Inspected Template Library, Template detail, template-soft-delete, and templatesData.app Zero mutation seams.",
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
  coveredTemplateOperation({
    command: "church-work mcp call template-list",
    id: "template.list",
    inputContract: "churchId",
    kind: "read",
    operation: "List Templates",
    outputContract: "active Template rows for the Active Church",
    tool: "template-list",
    uiBehavior: "Template Library lists non-deleted Templates through useTemplatesCollection",
  }),
  coveredTemplateOperation({
    command: "church-work mcp call template-get",
    id: "template.get",
    inputContract: "churchId and templateId",
    kind: "read",
    operation: "Get Template",
    outputContract: "Template with active Template Tasks and Template Schedules",
    tool: "template-get",
    uiBehavior:
      "Template detail opens a selected Template with its Template Tasks and Template Schedules",
  }),
  coveredTemplateOperation({
    command: "church-work template create-weekly-service",
    id: "template.create.weekly-service",
    inputContract:
      "churchId, Template name/key/description, service weekday, start date, Template Teams, Template Tasks, and optional Template Schedule",
    kind: "write",
    operation: "Create Weekly Service Template",
    outputContract:
      "created weekly-service Template plus optional Template Schedule, Template Teams, and Template Tasks",
    tool: "template-create-weekly-service",
    uiBehavior:
      "Template creation flow creates weekly-service Templates through mutators.templates.create",
  }),
  coveredTemplateOperation({
    command: "church-work mcp call template-update",
    id: "template.update",
    inputContract:
      "churchId, templateId, and editable Template fields such as name, recurrence, and placement shape",
    kind: "write",
    operation: "Update Template",
    outputContract: "updated Template row",
    tool: "template-update",
    uiBehavior: "Template detail persists Template field changes through Template update actions",
  }),
  coveredTemplateOperation({
    command: "church-work mcp call template-delete",
    id: "template.delete",
    inputContract: "churchId and templateId",
    kind: "write",
    operation: "Delete Template",
    outputContract: "soft-deleted Template with deleted_at/deleted_by audit fields",
    tool: "template-delete",
    uiBehavior:
      "Template Library and Template detail soft-delete a Template through useTemplateSoftDeleteActions.deleteTemplate",
  }),
  coveredTemplateOperation({
    command: "church-work mcp call template-restore",
    id: "template.restore",
    inputContract: "churchId and templateId",
    kind: "write",
    operation: "Restore Template",
    outputContract: "restored Template with deletion audit fields cleared",
    tool: "template-restore",
    uiBehavior:
      "Template deleted-item controls restore a Template through useTemplateSoftDeleteActions.restoreTemplate",
  }),
  coveredTemplateOperation({
    command: "church-work mcp call template-duplicate",
    id: "template.duplicate",
    inputContract: "churchId, templateId, and optional duplicate name",
    kind: "write",
    operation: "Duplicate Template",
    outputContract:
      "new Template copy with copied Template Teams, Template Tasks, and Template Schedules",
    tool: "template-duplicate",
    uiBehavior: "Template detail duplicates a Template through useDuplicateTemplateAction",
  }),
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
