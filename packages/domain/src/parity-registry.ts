export const AGENT_PARITY_COVERAGE_STATUSES = [
  "covered",
  "partial",
  "missing",
  "generic-passthrough",
  "intentionally-ui-only",
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
const CHURCH_MEMBERSHIP_AUTHORIZATION = "Church Membership";
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

const UI_ONLY_LABEL_SURFACES = {
  cli: missingNamedAgentSurface,
  mcp: missingFocusedAgentSurface,
  ui: {
    notes:
      "Inspected SettingsLabelsPanel, labelsData.app Zero mutator hooks, and Zero Label mutator tests.",
    status: "covered",
  },
} as const satisfies AgentOperationRegistryEntry["surfaces"];

const coveredTaskOperation = (
  entry: Pick<
    AgentOperationRegistryEntry,
    "id" | "inputContract" | "kind" | "operation" | "outputContract" | "uiBehavior"
  > & { readonly command: string; readonly tool: string },
): AgentOperationRegistryEntry => ({
  authorization: CHURCH_MEMBERSHIP_AUTHORIZATION,
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

const uiOnlyTaskCommentOperation = (
  entry: Pick<
    AgentOperationRegistryEntry,
    | "authorization"
    | "domainArea"
    | "id"
    | "inputContract"
    | "kind"
    | "operation"
    | "outputContract"
    | "uiBehavior"
  >,
): AgentOperationRegistryEntry => ({
  context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
  surfaces: UI_ONLY_COMMENT_SURFACES,
  ...entry,
});

type TemplateOperationEntry = Pick<
  AgentOperationRegistryEntry,
  "id" | "inputContract" | "kind" | "operation" | "outputContract" | "uiBehavior"
> & {
  readonly cliStatus: Extract<AgentParityCoverageStatus, "covered" | "generic-passthrough">;
  readonly command: string;
  readonly tool: string;
};

const templateCliSurface = (entry: TemplateOperationEntry): AgentParitySurfaceCoverage =>
  entry.cliStatus === "covered"
    ? { command: entry.command, status: "covered" }
    : {
        command: entry.command,
        notes:
          "Available through the generic CLI MCP passthrough; no named Template lifecycle command yet.",
        status: "generic-passthrough",
      };

const coveredTemplateOperation = (entry: TemplateOperationEntry): AgentOperationRegistryEntry => ({
  authorization: "Church Membership",
  context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
  domainArea: "Template",
  id: entry.id,
  inputContract: entry.inputContract,
  kind: entry.kind,
  operation: entry.operation,
  outputContract: entry.outputContract,
  surfaces: {
    cli: templateCliSurface(entry),
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
    authorization: CHURCH_MEMBERSHIP_AUTHORIZATION,
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
    authorization: CHURCH_MEMBERSHIP_AUTHORIZATION,
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
    authorization: "App Administrator",
    context: {
      requiresActiveChurch: false,
      requiresChurchMembership: false,
      session: "authenticated",
    },
    domainArea: "App Administration",
    id: "app-administration.access.check",
    inputContract: "authenticated session with Better Auth User role",
    kind: "read",
    operation: "Check App Administrator Access",
    outputContract: "App Administrator access allowed or restricted support-surface state",
    surfaces: {
      cli: {
        notes: "No named CLI support command exposes app-admin authorization checks yet.",
        status: "missing",
      },
      mcp: {
        notes: "No agent endpoint exposes app-admin authorization checks yet.",
        status: "missing",
      },
      ui: {
        notes:
          "Inspected InternalAccessGate, useIsAppAdmin, AdminNav, and Zero is_app_admin context.",
        status: "covered",
      },
    },
    uiBehavior:
      "InternalAccessGate renders App Administrator access required unless useIsAppAdmin and authenticated Zero context allow support surfaces",
  },
  {
    authorization: "App Administrator",
    context: {
      requiresActiveChurch: false,
      requiresChurchMembership: false,
      session: "authenticated",
    },
    domainArea: "App Administration",
    id: "app-administration.church.collection",
    inputContract:
      "admin list args for Church collection search, sort, selection, limit, and pagination",
    kind: "read",
    operation: "List Churches for Support",
    outputContract: "Church collection rows with support details and available row actions",
    surfaces: {
      cli: { notes: "No named CLI support command lists Churches.", status: "missing" },
      mcp: { notes: "No MCP support tool lists Churches.", status: "missing" },
      ui: {
        notes:
          "Inspected /admin/orgs OrgsCollection, orgsData admin_list/admin_all queries, and OrgActions edit support action.",
        status: "covered",
      },
    },
    uiBehavior:
      "Admin Churches collection reads Zero-backed admin Church rows and shows App Administrator-only edit org row actions",
  },
  {
    authorization: "App Administrator",
    context: {
      requiresActiveChurch: false,
      requiresChurchMembership: false,
      session: "authenticated",
    },
    domainArea: "App Administration",
    id: "app-administration.user.collection",
    inputContract:
      "admin list args for User collection search, sort, selection, limit, and pagination",
    kind: "read",
    operation: "List Users for Support",
    outputContract: "User collection rows with support details and available row actions",
    surfaces: {
      cli: { notes: "No named CLI support command lists Users.", status: "missing" },
      mcp: { notes: "No MCP support tool lists Users.", status: "missing" },
      ui: {
        notes:
          "Inspected /admin/users UsersCollection, usersData admin_list/admin_all queries, and UserActions edit/impersonate support actions.",
        status: "covered",
      },
    },
    uiBehavior:
      "Admin Users collection reads Zero-backed admin User rows and shows App Administrator-only edit user and impersonate row actions",
  },
  {
    authorization: "App Administrator",
    context: {
      requiresActiveChurch: false,
      requiresChurchMembership: false,
      session: "authenticated",
    },
    domainArea: "App Administration",
    id: "app-administration.church.edit-support-action",
    inputContract: "target Church id selected from the App Administration Churches collection",
    kind: "write",
    operation: "Edit Church Support Details",
    outputContract: "edit Church quick action state opened for App Administrator review/update",
    surfaces: {
      cli: {
        notes: "No named CLI support command edits Church support details.",
        status: "missing",
      },
      mcp: { notes: "No MCP support tool edits Church support details.", status: "missing" },
      ui: {
        notes:
          "Inspected OrgActions useIsAppAdmin guard and editOrgQuickActionStateAtom details-pane support action.",
        status: "covered",
      },
    },
    uiBehavior:
      "Admin Church details pane action opens the App Administrator-only edit Church quick action from OrgActions",
  },
  {
    authorization: "App Administrator",
    context: {
      requiresActiveChurch: false,
      requiresChurchMembership: false,
      session: "authenticated",
    },
    domainArea: "App Administration",
    id: "app-administration.user.edit-support-action",
    inputContract: "target User id selected from the App Administration Users collection",
    kind: "write",
    operation: "Edit User Support Details",
    outputContract: "edit User quick action state opened for App Administrator review/update",
    surfaces: {
      cli: { notes: "No named CLI support command edits User support details.", status: "missing" },
      mcp: { notes: "No MCP support tool edits User support details.", status: "missing" },
      ui: {
        notes:
          "Inspected UserActions useIsAppAdmin guard and editUserQuickActionStateAtom details-pane support action.",
        status: "covered",
      },
    },
    uiBehavior:
      "Admin User details pane action opens the App Administrator-only edit User quick action from UserActions",
  },
  {
    authorization: "App Administrator",
    context: {
      requiresActiveChurch: false,
      requiresChurchMembership: false,
      session: "authenticated",
    },
    domainArea: "App Administration",
    id: "app-administration.user.impersonate",
    inputContract: "target User id selected from the App Administration Users collection",
    kind: "write",
    operation: "Start User Impersonation",
    outputContract: "Better Auth impersonation session refetched into the browser session",
    surfaces: {
      cli: {
        notes:
          "Intentionally not exposed to CLI in this parity slice; impersonation remains a browser support action gated by Better Auth adminClient.",
        status: "intentionally-ui-only",
      },
      mcp: {
        notes:
          "Intentionally not exposed to MCP in this parity slice to avoid adding an agent-controlled support impersonation path.",
        status: "intentionally-ui-only",
      },
      ui: {
        notes:
          "Inspected UserActions useIsAppAdmin guard and authClient.admin.impersonateUser behavior.",
        status: "covered",
      },
    },
    uiBehavior:
      "Admin User actions call Better Auth admin.impersonateUser only after useIsAppAdmin gating",
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
  {
    authorization: "Church Membership",
    context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
    domainArea: "Label",
    id: "label.create",
    inputContract: "churchId, Label name, and optional teamId for a Team Label",
    kind: "write",
    operation: "Create Label",
    outputContract:
      "created Church Label or Team Label with deterministic default Label color and scoped uniqueness",
    surfaces: UI_ONLY_LABEL_SURFACES,
    uiBehavior:
      "Label settings use useCreateLabelMutation for Church Labels; Zero label creation also supports Team Labels with same-name scoped uniqueness and deterministic default color",
  },
  {
    authorization: "Church Membership",
    context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
    domainArea: "Label",
    id: "label.update",
    inputContract: "churchId, labelId, optional Label name, and optional Label color",
    kind: "write",
    operation: "Update Label",
    outputContract: "updated Label name and/or Label color",
    surfaces: UI_ONLY_LABEL_SURFACES,
    uiBehavior:
      "Label settings inline name form and color picker use useUpdateLabelMutation; invalid stored colors fall back to deterministic name-derived Label colors in the UI",
  },
  {
    authorization: "Church Membership",
    context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
    domainArea: "Label",
    id: "label.delete",
    inputContract: "churchId and labelId",
    kind: "write",
    operation: "Delete Label",
    outputContract: "deleted Label and Task label_ids cleaned of the deleted Label",
    surfaces: UI_ONLY_LABEL_SURFACES,
    uiBehavior:
      "Label settings delete action uses useDeleteLabelMutation; deleting a Label removes it from every Task label_ids list",
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
    command: "church-work task update --parent-task-id/--clear-parent",
    id: "task.subtask.parent.change",
    inputContract:
      "churchId plus taskId or Task Identifier and parentTaskId, or clear parent with null",
    kind: "write",
    operation: "Assign or Clear Subtask Parent",
    outputContract:
      "updated Task preserving Task Identifier and setting or clearing parent Task within the same Church",
    tool: "update-task",
    uiBehavior:
      "Task parent field assigns a parent Task or clears parentTaskId to return the Task to top-level work",
  }),
  coveredTaskOperation({
    command: "church-work task update --cycle-id",
    id: "task.cycle.move",
    inputContract: "churchId plus taskId or Task Identifier and cycleId",
    kind: "write",
    operation: "Move Task Between Weeks",
    outputContract:
      "updated Task preserving Task Identifier and moving to the requested Week/Cycle in the same Church",
    tool: "update-task",
    uiBehavior:
      "Task Week field and Board/List controls update cycleId while preserving the Team-derived Task Identifier",
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
  uiOnlyTaskCommentOperation({
    authorization: CHURCH_MEMBERSHIP_AUTHORIZATION,
    domainArea: "Task Comment",
    id: "task.comment.create",
    inputContract: "churchId, taskId, and non-empty Markdown/plaintext comment body",
    kind: "write",
    operation: "Create Task Comment",
    outputContract: "created root Task Comment plus comment_created Activity Feed item",
    uiBehavior:
      "Task Activity Feed composer creates a root Task Comment after requiring an Active Church and non-empty body",
  }),
  uiOnlyTaskCommentOperation({
    authorization: CHURCH_MEMBERSHIP_AUTHORIZATION,
    domainArea: "Task Comment",
    id: "task.comment.reply",
    inputContract:
      "churchId, taskId, root parent Task Comment only; replies are one level deep, and non-empty reply body",
    kind: "write",
    operation: "Reply to Task Comment",
    outputContract:
      "created reply Task Comment plus reply_created Activity Feed item and subscribed-user reply notifications",
    uiBehavior:
      "Task Activity Feed Reply composer creates a one-level reply under a root Task Comment and rejects nested replies in the Zero mutator",
  }),
  uiOnlyTaskCommentOperation({
    authorization: TASK_COMMENT_MODERATION_AUTHORIZATION,
    domainArea: "Task Comment",
    id: "task.comment.update",
    inputContract: "churchId, commentId, and non-empty replacement body",
    kind: "write",
    operation: "Edit Task Comment",
    outputContract:
      "updated Task Comment body, updated timestamp, and comment_updated Activity Feed item",
    uiBehavior:
      "Task Comment and reply action menus expose inline Edit only to the author, Church owner/admin, or App Administrator",
  }),
  uiOnlyTaskCommentOperation({
    authorization: TASK_COMMENT_MODERATION_AUTHORIZATION,
    domainArea: "Task Comment",
    id: "task.comment.delete",
    inputContract: "churchId and commentId",
    kind: "write",
    operation: "Delete Task Comment",
    outputContract: "soft-deleted Task Comment tombstone plus comment_deleted Activity Feed item",
    uiBehavior:
      "Task Comment and reply action menus expose confirmed Delete only to the author, Church owner/admin, or App Administrator and leave a tombstone",
  }),
  uiOnlyTaskCommentOperation({
    authorization: CHURCH_MEMBERSHIP_AUTHORIZATION,
    domainArea: "Comment Thread",
    id: "task.comment.thread.subscribe",
    inputContract: "churchId and rootCommentId for a non-deleted root Task Comment",
    kind: "write",
    operation: "Subscribe to Comment Thread",
    outputContract: "persisted current-User Comment Thread subscription",
    uiBehavior:
      "Root Task Comment action menu toggles a persisted Comment Thread subscription and shows a subscribed indicator for the current User",
  }),
  uiOnlyTaskCommentOperation({
    authorization: CHURCH_MEMBERSHIP_AUTHORIZATION,
    domainArea: "Comment Thread",
    id: "task.comment.thread.unsubscribe",
    inputContract: "churchId and rootCommentId for the current User's Comment Thread subscription",
    kind: "write",
    operation: "Unsubscribe from Comment Thread",
    outputContract: "soft-deleted current-User Comment Thread subscription",
    uiBehavior:
      "Root Task Comment action menu can unsubscribe the current User from the Comment Thread and removes the subscribed indicator",
  }),
  {
    authorization: CHURCH_MEMBERSHIP_AUTHORIZATION,
    context: ACTIVE_CHURCH_MEMBERSHIP_CONTEXT,
    domainArea: "Activity",
    id: "activity.feed.read",
    inputContract:
      "churchId, entityType, and entityId for a UI Activity entity (Task, Template, Cycle, Team, Workflow, Key Date, or Church)",
    kind: "read",
    operation: "Read Activity Feed",
    outputContract:
      "reverse-chronological Activity rows with event_type, actor, occurred_at, and metadata needed to render human-readable history",
    surfaces: {
      cli: {
        command: "church-work mcp call list-activities",
        notes:
          "Available through the generic CLI MCP passthrough; no named Activity Feed command yet.",
        status: "generic-passthrough",
      },
      mcp: { status: "covered", tool: "list-activities" },
      ui: {
        notes:
          "Inspected useActivitiesForEntityCollection, TaskActivityFeed, and describeActivity surfaced event filtering.",
        status: "covered",
      },
    },
    uiBehavior:
      "Task Details Pane shows reverse-chronological Task Activity rows for task lifecycle, field, label, and comment events; other UI Activity entity types are queryable for agent history, but non-task entity events are not rendered by describeActivity yet",
  },
  coveredTemplateOperation({
    cliStatus: "generic-passthrough",
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
    cliStatus: "generic-passthrough",
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
    cliStatus: "covered",
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
    cliStatus: "generic-passthrough",
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
    cliStatus: "generic-passthrough",
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
    cliStatus: "generic-passthrough",
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
    cliStatus: "generic-passthrough",
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
        entry.authorization,
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
    "| Domain Area | Operation | Kind | UI | MCP | CLI | Context | Authorization | UI Behavior |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
};
