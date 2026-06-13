import { formatTaskIdentifier } from "@church-task/domain/Task";
import {
  deriveTeamIdentifierBase,
  generateTeamIdentifier,
  getTeamColorForName,
  isTeamColor,
  isValidTeamIdentifier,
  normalizeTeamIdentifier,
  TEAM_IDENTIFIER_MAX_LENGTH,
} from "@church-task/domain/Team";
import { FunctionImpl, GroupImpl, MutationCtx, QueryCtx } from "@confect/server";
import { Effect, Layer } from "effect";

import {
  invalidActivityMetadataResponse,
  listActivitiesForEntityResponse,
  recordActivityResponse,
} from "../agent/activityOperations";
import {
  churchSettingsErrorResponse,
  churchSettingsResponse,
} from "../agent/churchSettingsOperations";
import {
  cycleMaintenanceErrorResponse,
  cycleMaintenanceResponse,
} from "../agent/cycleMaintenanceOperations";
import {
  coreWorkBatchReadResponse,
  coreWorkBatchWriteResponse,
  type CoreWorkBatchReadArgs,
  type CoreWorkBatchWriteArgs,
} from "../agent/coreWorkOperations";
import { keyDateErrorResponse, keyDateResponse } from "../agent/keyDateOperations";
import { labelErrorResponse, labelsResponse } from "../agent/labelOperations";
import {
  activeChurchResponse,
  batchReadResponse,
  currentUserResponse,
  noActiveChurchResponse,
  notChurchMemberResponse,
} from "../agent/operations";
import {
  teamErrorResponse,
  teamMembershipErrorResponse,
  teamMembershipsResponse,
  teamsResponse,
} from "../agent/teamOperations";
import { templateErrorResponse, templateResponse } from "../agent/templateOperations";
import { taskErrorResponse, taskResponse } from "../agent/taskOperations";
import { workDefaultsResponse } from "../agent/workDefaultsOperations";
import { workflowErrorResponse, workflowResponse } from "../agent/workflowOperations";
import { listActivitiesForEntity, serializeActivity, writeActivity } from "../activityRegistry";
import { authComponent } from "../authCore";
import { isValidChurchTimeZone } from "../churchTimeZone";
import { api as convexApi, components } from "../convex/_generated/api";
import type { DataModel, Id } from "../convex/_generated/dataModel";
import { maintainCyclesForChurch } from "../cycleMaintenance";
import {
  createKeyDateOccurrences,
  createKeyDates,
  readKeyDateModel,
  resolveKeyDateOccurrences,
} from "../keyDateScheduling";
import { resolveTaskByIdentifier } from "../identifierResolution";
import {
  createLabelForChurch,
  deleteLabelForChurch,
  listLabelsForChurch,
  serializeLabel,
  updateLabelForChurch,
} from "../labels";
import { readDefaultWorkModel, seedDefaultWorkModel, seedTeamWorkflow } from "../workDefaults";
import {
  cancelTasks,
  completeTasks,
  createTasks,
  readTaskModel,
  reopenTasks,
  updateTasks,
} from "../tasks";
import {
  createTemplates,
  materializeProjectedTasks,
  previewCycleAdjustmentMerge,
  readTemplateModel,
  repairTemplateTeamsForTeamRemoval,
  resolveTemplateTaskSchedules,
  setCycleAdjustments,
  updateTemplateTasksAndSyncFutureProjectedTasks,
} from "../templates";
import {
  addWorkflowStatus,
  archiveWorkflow,
  archiveWorkflowStatus,
  getTeamWorkflow,
  readWorkflowModel,
  renameWorkflow,
  renameWorkflowStatus,
  remapWorkflowStatusForTaskTeam,
  reorderWorkflowStatuses,
  reorderWorkflows,
} from "../workflows";
import api from "./_generated/api";

const convexFunctionRefs = convexApi as any;

type BetterAuthSession = {
  readonly activeOrganizationId?: string | null;
};

type BetterAuthMember = {
  readonly _id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly role: string;
};

type BetterAuthOrganization = {
  readonly _id: string;
  readonly name: string;
  readonly slug?: string | null;
  readonly churchTimeZone?: string | null;
};

type BetterAuthTeam = {
  readonly _id: string;
  readonly name: string;
  readonly organizationId: string;
  readonly archivedAt?: string | null;
  readonly sortOrder?: number | null;
  readonly color?: string | null;
  readonly identifier?: string | null;
  readonly previousIdentifiers?: ReadonlyArray<string> | null;
};

type BetterAuthTeamMember = {
  readonly _id: string;
  readonly teamId: string;
  readonly userId: string;
  readonly createdAt: number;
};

type BetterAuthModel = "member" | "organization" | "session" | "team" | "teamMember";
type BetterAuthWhere = {
  field: string;
  operator?: "eq" | "gt" | "in";
  value: string | number | boolean | Array<string> | Array<number> | null;
};

const getCurrentAgentUserData = Effect.gen(function* () {
  const ctx = yield* QueryCtx.QueryCtx<DataModel>();
  const authUser = yield* Effect.promise(() => authComponent.safeGetAuthUser(ctx)).pipe(
    Effect.orDie,
  );

  return {
    user: authUser
      ? {
          id: authUser._id,
          email: authUser.email ?? null,
          name: authUser.name ?? null,
        }
      : null,
  };
});

const findBetterAuthDoc = <T>(args: {
  readonly model: BetterAuthModel;
  readonly where: Array<BetterAuthWhere>;
}) =>
  Effect.gen(function* () {
    const ctx = yield* QueryCtx.QueryCtx<DataModel>();

    return (yield* Effect.promise(() =>
      ctx.runQuery(components.betterAuth.adapter.findOne, args),
    ).pipe(Effect.orDie)) as T | null;
  });

const findBetterAuthDocs = <T>(args: {
  readonly model: BetterAuthModel;
  readonly where: Array<BetterAuthWhere>;
}) =>
  Effect.gen(function* () {
    const ctx = yield* QueryCtx.QueryCtx<DataModel>();

    const result = (yield* Effect.promise(() =>
      ctx.runQuery(components.betterAuth.adapter.findMany, {
        ...args,
        paginationOpts: { cursor: null, numItems: 100 },
      }),
    ).pipe(Effect.orDie)) as { readonly page: ReadonlyArray<T> };

    return result.page;
  });

// Teams created outside the app's create paths (e.g. raw Better Auth
// endpoints) may lack a stored identifier; fall back to the same name-derived
// base the create path would have used, mirroring the Team Color fallback.
const currentTeamIdentifier = (team: BetterAuthTeam) =>
  team.identifier ?? deriveTeamIdentifierBase(team.name);

const serializeTeam = (team: BetterAuthTeam) => ({
  id: team._id,
  name: team.name,
  churchId: team.organizationId,
  identifier: currentTeamIdentifier(team),
  previousIdentifiers: team.previousIdentifiers ?? [],
  // Teams created before colors were stored fall back to the same
  // name-derived color the create path would have assigned.
  color: isTeamColor(team.color) ? team.color : getTeamColorForName(team.name),
  archivedAt: team.archivedAt ?? null,
  sortOrder: team.sortOrder ?? 0,
});

const serializeTeamMembership = (churchId: string, membership: BetterAuthTeamMember) => ({
  id: membership._id,
  churchId,
  teamId: membership.teamId,
  userId: membership.userId,
});

const getAuthenticatedChurchMember = (churchId: string) =>
  Effect.gen(function* () {
    const ctx = yield* QueryCtx.QueryCtx<DataModel>();
    const authUser = yield* Effect.promise(() => authComponent.safeGetAuthUser(ctx)).pipe(
      Effect.orDie,
    );

    if (!authUser) return { status: "notAuthenticated" as const };

    const membership = yield* findBetterAuthDoc<BetterAuthMember>({
      model: "member",
      where: [
        { field: "organizationId", value: churchId },
        { field: "userId", value: authUser._id },
      ],
    });

    if (!membership) return { status: "notChurchMember" as const };

    return { status: "ready" as const, authUser, membership };
  });

const listTeamsForChurch = (churchId: string) =>
  findBetterAuthDocs<BetterAuthTeam>({
    model: "team",
    where: [{ field: "organizationId", value: churchId }],
  }).pipe(
    Effect.map((teams) =>
      [...teams].sort((left, right) => {
        const sortDifference = (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
        return sortDifference === 0 ? left.name.localeCompare(right.name) : sortDifference;
      }),
    ),
  );

const activeTeamsForChurch = (churchId: string) =>
  listTeamsForChurch(churchId).pipe(
    Effect.map((teams) => teams.filter((team) => (team.archivedAt ?? null) === null)),
  );

const isLastActiveTeam = (churchId: string, team: BetterAuthTeam) =>
  Effect.gen(function* () {
    if ((team.archivedAt ?? null) !== null) return false;

    const activeTeams = yield* activeTeamsForChurch(churchId);
    return activeTeams.length <= 1;
  });

const listTeamMembershipsForChurch = (churchId: string) =>
  Effect.gen(function* () {
    const teams = yield* listTeamsForChurch(churchId);
    if (teams.length === 0) return [];

    const teamIds = teams.map((team) => team._id);
    const memberships = yield* findBetterAuthDocs<BetterAuthTeamMember>({
      model: "teamMember",
      where: [{ field: "teamId", operator: "in", value: teamIds }],
    });

    return [...memberships].sort((left, right) => {
      const teamDifference = left.teamId.localeCompare(right.teamId);
      return teamDifference === 0 ? left.userId.localeCompare(right.userId) : teamDifference;
    });
  });

const teamManageAuthError = (operation: Parameters<typeof teamErrorResponse>[0], role?: string) => {
  if (role !== "owner" && role !== "admin") {
    return teamErrorResponse(
      operation,
      "not_authorized",
      "Only Church owners and admins can manage Teams.",
    );
  }

  return null;
};

const teamMembershipManageAuthError = (
  operation: Parameters<typeof teamMembershipErrorResponse>[0],
  role?: string,
) => {
  if (role !== "owner" && role !== "admin") {
    return teamMembershipErrorResponse(
      operation,
      "not_authorized",
      "Only Church owners and admins can manage Team Membership.",
    );
  }

  return null;
};

const getActiveChurch = (churchId: string | null) =>
  Effect.gen(function* () {
    const ctx = yield* QueryCtx.QueryCtx<DataModel>();
    const authUser = yield* Effect.promise(() => authComponent.safeGetAuthUser(ctx)).pipe(
      Effect.orDie,
    );
    const identity = yield* Effect.promise(() => ctx.auth.getUserIdentity()).pipe(Effect.orDie);

    if (!authUser || !identity?.sessionId) return noActiveChurchResponse();

    const session = yield* findBetterAuthDoc<BetterAuthSession>({
      model: "session",
      where: [
        { field: "_id", value: String(identity.sessionId) },
        { field: "expiresAt", operator: "gt", value: new Date().getTime() },
      ],
    });
    const activeChurchId = churchId ?? session?.activeOrganizationId ?? null;

    if (!activeChurchId) return noActiveChurchResponse();

    const memberships = yield* findBetterAuthDocs<
      BetterAuthMember & { readonly organizationId: string }
    >({
      model: "member",
      where: [{ field: "userId", value: authUser._id }],
    });
    const membership = memberships.find((candidate) => candidate.organizationId === activeChurchId);

    if (!membership) return notChurchMemberResponse();

    const church = yield* findBetterAuthDoc<BetterAuthOrganization>({
      model: "organization",
      where: [{ field: "_id", value: activeChurchId }],
    });

    if (!church) return notChurchMemberResponse();

    return activeChurchResponse({
      church: {
        id: church._id,
        name: church.name,
        slug: church.slug ?? null,
        churchTimeZone: church.churchTimeZone ?? null,
      },
      membership: { role: membership.role },
    });
  });

const serializeWorkDefaults = (data: Awaited<ReturnType<typeof readDefaultWorkModel>>) => ({
  workflows: data.workflows.map((workflow) => ({
    id: workflow._id,
    teamId: workflow.teamId,
    key: workflow.key,
    name: workflow.name,
    sortOrder: workflow.sortOrder,
    archivedAt: workflow.archivedAt,
  })),
  workflowStatuses: data.workflowStatuses.map((status) => ({
    id: status._id,
    workflowId: status.workflowId,
    key: status.key,
    name: status.name,
    taskState: status.taskState,
    sortOrder: status.sortOrder,
    archivedAt: status.archivedAt,
  })),
  keyDates: data.keyDates.map((keyDate) => ({
    id: keyDate._id,
    key: keyDate.key,
    name: keyDate.name,
    schedule: keyDate.schedule,
    archivedAt: keyDate.archivedAt,
  })),
  labels: data.labels.map(serializeLabel),
});

const serializeKeyDateModel = (
  data: Awaited<ReturnType<typeof readKeyDateModel>>,
  resolvedOccurrences: Awaited<ReturnType<typeof resolveKeyDateOccurrences>> = [],
) => ({
  keyDates: data.keyDates.map((keyDate) => ({
    id: keyDate._id,
    key: keyDate.key,
    name: keyDate.name,
    schedule: keyDate.schedule,
    archivedAt: keyDate.archivedAt,
  })),
  occurrences: data.occurrences.map((occurrence) => ({
    id: occurrence._id,
    keyDateId: occurrence.keyDateId,
    localDate: occurrence.localDate,
    label: occurrence.label,
    archivedAt: occurrence.archivedAt,
  })),
  resolvedOccurrences,
});

const serializeWorkflowModel = (data: Awaited<ReturnType<typeof readWorkflowModel>>) => ({
  workflows: [...data.workflows]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((workflow) => ({
      id: workflow._id,
      teamId: workflow.teamId,
      key: workflow.key,
      name: workflow.name,
      sortOrder: workflow.sortOrder,
      archivedAt: workflow.archivedAt,
    })),
  workflowStatuses: [...data.workflowStatuses]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((status) => ({
      id: status._id,
      workflowId: status.workflowId,
      key: status.key,
      name: status.name,
      taskState: status.taskState,
      sortOrder: status.sortOrder,
      archivedAt: status.archivedAt,
    })),
  tasks: data.tasks.map((task) => ({
    id: task._id,
    churchId: task.churchId,
    title: task.title,
    description: task.description ?? null,
    teamId: task.teamId,
    assignedUserId: task.assignedUserId ?? null,
    cycleId: task.cycleId,
    dueDate: task.dueDate,
    createdAt: task._creationTime,
    createdByUserId: task.createdByUserId ?? null,
    parentTaskId: task.parentTaskId,
    workflowId: task.workflowId,
    workflowStatusId: task.workflowStatusId,
    taskState: task.taskState,
    estimate: task.estimate ?? null,
    boardOrder: task.boardOrder,
    finishedAt: task.finishedAt ?? null,
    sourceTemplateId: task.sourceTemplateId ?? null,
    sourceTemplateTaskId: task.sourceTemplateTaskId ?? null,
    sourceTemplateCycleId: task.sourceTemplateCycleId ?? null,
    sourceTemplateSyncEnabled: task.sourceTemplateSyncEnabled ?? false,
  })),
});

const serializeTaskModel = (data: Awaited<ReturnType<typeof readTaskModel>>) => ({
  cycles: data.cycles.map((cycle) => ({
    id: cycle._id,
    churchId: cycle.churchId,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    startsAt: cycle.startsAt,
    endsAt: cycle.endsAt,
    churchTimeZone: cycle.churchTimeZone,
  })),
  tasks: data.tasks.map((task) => ({
    id: task._id,
    churchId: task.churchId,
    title: task.title,
    description: task.description ?? null,
    teamId: task.teamId,
    number: task.number,
    // Computed at read time so a Team Identifier change re-renders every
    // Task Identifier in that Team (ADR 0013).
    identifier: formatTaskIdentifier(data.teamIdentifierById[task.teamId] ?? "TEAM", task.number),
    assignedUserId: task.assignedUserId ?? null,
    cycleId: task.cycleId,
    dueDate: task.dueDate,
    createdAt: task._creationTime,
    createdByUserId: task.createdByUserId ?? null,
    parentTaskId: task.parentTaskId,
    labelIds: task.labelIds ?? [],
    workflowId: task.workflowId,
    workflowStatusId: task.workflowStatusId,
    taskState: task.taskState,
    estimate: task.estimate ?? null,
    boardOrder: task.boardOrder,
    finishedAt: task.finishedAt ?? null,
    sourceTemplateId: task.sourceTemplateId ?? null,
    sourceTemplateTaskId: task.sourceTemplateTaskId ?? null,
    sourceTemplateCycleId: task.sourceTemplateCycleId ?? null,
    sourceTemplateSyncEnabled: task.sourceTemplateSyncEnabled ?? false,
  })),
});

const serializeTemplateModel = (
  data: Awaited<ReturnType<typeof readTemplateModel>>,
  resolvedSchedules: Awaited<ReturnType<typeof resolveTemplateTaskSchedules>> = [],
  mergedProjectedTasks: Array<{
    readonly cycleId: string;
    readonly templateTaskId: string;
    readonly skipped: boolean;
    readonly effectiveTask: {
      readonly templateTaskId: string;
      readonly templateTaskKey: string;
      readonly title: string;
      readonly dueDate: string;
      readonly parentTemplateTaskId: string | null;
    } | null;
    readonly appliedOverrides: ReadonlyArray<
      | { readonly field: "title"; readonly value: string }
      | { readonly field: "dueDate"; readonly value: string }
      | { readonly field: "parentTemplateTaskId"; readonly value: string | null }
    >;
  }> = [],
) => ({
  templates: data.templates.map((template) => ({
    id: template._id,
    key: template.key,
    name: template.name,
    recurrence: template.recurrence,
    archivedAt: template.archivedAt,
  })),
  templateTeams: data.templateTeams.map((templateTeam) => ({
    id: templateTeam._id,
    templateId: templateTeam.templateId,
    key: templateTeam.key,
    name: templateTeam.name,
    mappedTeamId: templateTeam.mappedTeamId,
    archivedAt: templateTeam.archivedAt,
  })),
  focusWindows: data.focusWindows.map((focusWindow) => ({
    id: focusWindow._id,
    templateId: focusWindow.templateId,
    key: focusWindow.key,
    name: focusWindow.name,
    type: focusWindow.type,
    startDate: focusWindow.startDate,
    endDate: focusWindow.endDate,
    anchorDate: focusWindow.anchorDate,
    keyDateId: focusWindow.keyDateId,
    archivedAt: focusWindow.archivedAt,
  })),
  templateTasks: data.templateTasks.map((templateTask) => ({
    id: templateTask._id,
    templateId: templateTask.templateId,
    templateTeamId: templateTask.templateTeamId,
    key: templateTask.key,
    title: templateTask.title,
    parentTemplateTaskId: templateTask.parentTemplateTaskId,
    schedulingRule: templateTask.schedulingRule,
    archivedAt: templateTask.archivedAt,
  })),
  cycleAdjustments: data.cycleAdjustments.map((adjustment) => ({
    id: adjustment._id,
    cycleId: adjustment.cycleId,
    templateTaskId: adjustment.templateTaskId,
    lifecycle: adjustment.lifecycle,
    overrides: adjustment.overrides,
  })),
  resolvedSchedules,
  mergedProjectedTasks,
});

const healthCheckGet = FunctionImpl.make(api, "healthCheck", "get", () =>
  Effect.succeed("OK" as const),
);

const privateDataGet = FunctionImpl.make(api, "privateData", "get", () =>
  Effect.gen(function* () {
    const ctx = yield* QueryCtx.QueryCtx<DataModel>();
    const authUser = yield* Effect.promise(() => authComponent.safeGetAuthUser(ctx)).pipe(
      Effect.orDie,
    );

    return {
      message: authUser ? "This is private" : "Not authenticated",
    };
  }),
);

const authGetCurrentUser = FunctionImpl.make(api, "auth", "getCurrentUser", () =>
  Effect.gen(function* () {
    const ctx = yield* QueryCtx.QueryCtx<DataModel>();

    return yield* Effect.promise(() => authComponent.safeGetAuthUser(ctx)).pipe(Effect.orDie);
  }),
);

const agentCurrentUser = FunctionImpl.make(api, "agent", "currentUser", () =>
  getCurrentAgentUserData.pipe(Effect.map((data) => currentUserResponse(data.user))),
);

const agentBatchRead = FunctionImpl.make(api, "agent", "batchRead", (args) =>
  getCurrentAgentUserData.pipe(Effect.map((data) => batchReadResponse(args.operations, data))),
);

const agentActiveChurch = FunctionImpl.make(api, "agent", "activeChurch", (args) =>
  getActiveChurch(args.churchId),
);

const churchSettingsReadForChurch = FunctionImpl.make(
  api,
  "churchSettings",
  "readForChurch",
  (args) =>
    Effect.gen(function* () {
      const auth = yield* getAuthenticatedChurchMember(args.churchId);

      if (auth.status === "notAuthenticated") {
        return churchSettingsErrorResponse(
          "readChurchSettings",
          "not_authenticated",
          "Authentication is required.",
        );
      }
      if (auth.status === "notChurchMember") {
        return churchSettingsErrorResponse(
          "readChurchSettings",
          "not_church_member",
          "Church membership is required.",
        );
      }

      const church = yield* findBetterAuthDoc<BetterAuthOrganization>({
        model: "organization",
        where: [{ field: "_id", value: args.churchId }],
      });

      if (!church) {
        return churchSettingsErrorResponse(
          "readChurchSettings",
          "church_not_found",
          "Church was not found.",
        );
      }

      return churchSettingsResponse("readChurchSettings", {
        id: church._id,
        churchTimeZone: church.churchTimeZone ?? null,
      });
    }),
);

const churchSettingsUpdateTimeZone = FunctionImpl.make(
  api,
  "churchSettings",
  "updateTimeZone",
  (args) =>
    Effect.gen(function* () {
      const ctx = yield* MutationCtx.MutationCtx<DataModel>();
      const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
        Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
      );

      if (auth.status === "notAuthenticated") {
        return churchSettingsErrorResponse(
          "updateChurchTimeZone",
          "not_authenticated",
          "Authentication is required.",
        );
      }
      if (auth.status === "notChurchMember") {
        return churchSettingsErrorResponse(
          "updateChurchTimeZone",
          "not_church_member",
          "Church membership is required.",
        );
      }
      if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
        return churchSettingsErrorResponse(
          "updateChurchTimeZone",
          "not_authorized",
          "Only Church owners and admins can update Church Time Zone.",
        );
      }
      if (!isValidChurchTimeZone(args.churchTimeZone)) {
        return churchSettingsErrorResponse(
          "updateChurchTimeZone",
          "invalid_church_time_zone",
          "Church Time Zone must be a valid IANA time zone.",
        );
      }

      const church = yield* findBetterAuthDoc<BetterAuthOrganization>({
        model: "organization",
        where: [{ field: "_id", value: args.churchId }],
      }).pipe(Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx));

      if (!church) {
        return churchSettingsErrorResponse(
          "updateChurchTimeZone",
          "church_not_found",
          "Church was not found.",
        );
      }

      yield* Effect.promise(() =>
        ctx.runMutation(components.betterAuth.adapter.updateOne, {
          input: {
            model: "organization",
            where: [{ field: "_id", value: args.churchId }],
            update: { churchTimeZone: args.churchTimeZone },
          },
        }),
      ).pipe(Effect.orDie);

      const updatedChurch = yield* findBetterAuthDoc<BetterAuthOrganization>({
        model: "organization",
        where: [{ field: "_id", value: args.churchId }],
      }).pipe(Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx));

      return churchSettingsResponse("updateChurchTimeZone", {
        id: args.churchId,
        churchTimeZone: updatedChurch?.churchTimeZone ?? args.churchTimeZone,
      });
    }),
);

const coreWorkBatchRead = FunctionImpl.make(
  api,
  "coreWork",
  "batchRead",
  (args: CoreWorkBatchReadArgs) =>
    Effect.gen(function* () {
      const ctx = yield* QueryCtx.QueryCtx<DataModel>();
      const results: Array<{
        readonly id: string;
        readonly operation: string;
        readonly result: unknown;
      }> = [];

      for (const operation of args.operations) {
        switch (operation.operation) {
          case "listTasks":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runQuery(convexFunctionRefs.tasks.listForChurch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "listTeams":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runQuery(convexFunctionRefs.teams.listForChurch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "listTeamMemberships":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runQuery(convexFunctionRefs.teams.listMembershipsForChurch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "readChurchSettings":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runQuery(convexFunctionRefs.churchSettings.readForChurch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "readWorkDefaults":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runQuery(convexFunctionRefs.workDefaults.readForChurch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "listKeyDates":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runQuery(convexFunctionRefs.keyDates.listForChurch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "resolveKeyDateOccurrences":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runQuery(convexFunctionRefs.keyDates.resolveOccurrences, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "resolveTemplateSchedules":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runQuery(convexFunctionRefs.templates.resolveSchedules, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "previewCycleAdjustmentMerge":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runQuery(
                  convexFunctionRefs.templates.previewCycleAdjustmentMerge,
                  operation.input,
                ),
              ).pipe(Effect.orDie),
            });
            break;
          case "listActivitiesForEntity":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runQuery(convexFunctionRefs.activities.listForEntity, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
        }
      }

      return coreWorkBatchReadResponse(results);
    }),
);

const coreWorkBatchWrite = FunctionImpl.make(
  api,
  "coreWork",
  "batchWrite",
  (args: CoreWorkBatchWriteArgs) =>
    Effect.gen(function* () {
      const ctx = yield* MutationCtx.MutationCtx<DataModel>();
      const results: Array<{
        readonly id: string;
        readonly operation: string;
        readonly result: unknown;
      }> = [];

      for (const operation of args.operations) {
        switch (operation.operation) {
          case "seedWorkDefaults":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.workDefaults.seedForChurch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "maintainCycles":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.cycleMaintenance.runForChurch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "createTasks":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.tasks.createBatch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "completeTasks":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.tasks.completeBatch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "cancelTasks":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.tasks.cancelBatch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "reopenTasks":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.tasks.reopenBatch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "createKeyDates":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.keyDates.createForChurch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "createKeyDateOccurrences":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.keyDates.createOccurrences, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "createTeam":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.teams.createForChurch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "renameTeam":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.teams.renameForChurch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "archiveTeam":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.teams.archiveForChurch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "reorderTeams":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.teams.reorderForChurch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "updateTeamProductFields":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.teams.updateProductFields, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "addTeamMember":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.teams.addMemberForChurch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "removeTeamMember":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.teams.removeMemberForChurch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "updateChurchTimeZone":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.churchSettings.updateTimeZone, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "renameWorkflow":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.workflows.renameForChurch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "reorderWorkflows":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.workflows.reorderForChurch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "archiveWorkflow":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.workflows.archiveForChurch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "addWorkflowStatus":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.workflows.addStatus, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "renameWorkflowStatus":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.workflows.renameStatus, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "reorderWorkflowStatuses":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.workflows.reorderStatuses, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "archiveWorkflowStatus":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.workflows.archiveStatus, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "remapTaskTeamWorkflow":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.workflows.remapTaskTeam, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "createTemplates":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.templates.createForChurch, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "setCycleAdjustments":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.templates.setCycleAdjustments, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
          case "materializeProjectedTasks":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(
                  convexFunctionRefs.templates.materializeProjectedTasks,
                  operation.input,
                ),
              ).pipe(Effect.orDie),
            });
            break;
          case "updateTemplateTasks":
            results.push({
              id: operation.id,
              operation: operation.operation,
              result: yield* Effect.promise(() =>
                ctx.runMutation(convexFunctionRefs.templates.updateTemplateTasks, operation.input),
              ).pipe(Effect.orDie),
            });
            break;
        }
      }

      return coreWorkBatchWriteResponse(results);
    }),
);

const cycleMaintenanceRunForChurch = FunctionImpl.make(
  api,
  "cycleMaintenance",
  "runForChurch",
  (args) =>
    Effect.gen(function* () {
      const ctx = yield* MutationCtx.MutationCtx<DataModel>();
      const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
        Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
      );

      if (auth.status === "notAuthenticated") {
        return cycleMaintenanceErrorResponse("not_authenticated", "Authentication is required.");
      }
      if (auth.status === "notChurchMember") {
        return cycleMaintenanceErrorResponse("not_church_member", "Church membership is required.");
      }
      if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
        return cycleMaintenanceErrorResponse(
          "not_authorized",
          "Only Church owners and admins can run Cycle maintenance.",
        );
      }

      const church = yield* findBetterAuthDoc<BetterAuthOrganization>({
        model: "organization",
        where: [{ field: "_id", value: args.churchId }],
      }).pipe(Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx));

      if (!church?.churchTimeZone) {
        return cycleMaintenanceErrorResponse(
          "church_time_zone_missing",
          "Church Time Zone is required before Cycles can be maintained.",
        );
      }

      const maintained = yield* Effect.tryPromise(() =>
        maintainCyclesForChurch(ctx, {
          churchId: args.churchId,
          churchTimeZone: church.churchTimeZone!,
          now: args.now,
        }),
      ).pipe(Effect.catchAll(() => Effect.succeed({ ok: false as const, code: "invalidNow" })));

      if (!maintained.ok && maintained.code === "workflowStatusNotFound") {
        return cycleMaintenanceErrorResponse(
          "workflow_status_not_found",
          "A default To Do Workflow Status is required before Template Tasks can materialize.",
        );
      }
      if (!maintained.ok && maintained.code === "teamNotFound") {
        return cycleMaintenanceErrorResponse(
          "team_not_found",
          "A Team is required before Template Tasks can materialize.",
        );
      }
      if (!maintained.ok && maintained.code === "templateTaskNotFound") {
        return cycleMaintenanceErrorResponse(
          "template_task_not_found",
          "Template Task was not found in the active Church.",
        );
      }
      if (!maintained.ok) {
        return cycleMaintenanceErrorResponse(
          "invalid_now",
          "Maintenance timestamp must be a valid ISO date-time.",
        );
      }

      const model = yield* Effect.promise(() => readTaskModel(ctx, args.churchId)).pipe(
        Effect.orDie,
      );

      return cycleMaintenanceResponse({
        ...serializeTaskModel(model),
        ensuredCycleIds: maintained.ensuredCycleIds,
        createdCycleIds: maintained.createdCycleIds,
        rolledOverTaskIds: maintained.rolledOverTaskIds,
        materializedTaskIds: maintained.materializedTaskIds,
      });
    }),
);

const workDefaultsSeedForChurch = FunctionImpl.make(api, "workDefaults", "seedForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();

    yield* Effect.promise(() => seedDefaultWorkModel(ctx, args.churchId)).pipe(Effect.orDie);

    const defaults = yield* Effect.promise(() => readDefaultWorkModel(ctx, args.churchId)).pipe(
      Effect.orDie,
    );

    return workDefaultsResponse("seedWorkDefaults", serializeWorkDefaults(defaults));
  }),
);

const workDefaultsReadForChurch = FunctionImpl.make(api, "workDefaults", "readForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* QueryCtx.QueryCtx<DataModel>();
    const defaults = yield* Effect.promise(() => readDefaultWorkModel(ctx, args.churchId)).pipe(
      Effect.orDie,
    );

    return workDefaultsResponse("readWorkDefaults", serializeWorkDefaults(defaults));
  }),
);

// Labels are open to every Church member — deliberately not role-gated
// (see CONTEXT.md "Label"). Scope rules live in the shared helpers so human
// and agent callers behave identically (ADR 0013).
const labelsListForChurch = FunctionImpl.make(api, "labels", "listForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* QueryCtx.QueryCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId);

    if (auth.status === "notAuthenticated") {
      return labelErrorResponse("listLabels", "not_authenticated", "Authentication is required.");
    }
    if (auth.status === "notChurchMember") {
      return labelErrorResponse(
        "listLabels",
        "not_church_member",
        "Church membership is required.",
      );
    }

    const labels = yield* Effect.promise(() => listLabelsForChurch(ctx, args.churchId)).pipe(
      Effect.orDie,
    );

    return labelsResponse("listLabels", labels.map(serializeLabel));
  }),
);

const labelsCreateForChurch = FunctionImpl.make(api, "labels", "createForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return labelErrorResponse("createLabel", "not_authenticated", "Authentication is required.");
    }
    if (auth.status === "notChurchMember") {
      return labelErrorResponse(
        "createLabel",
        "not_church_member",
        "Church membership is required.",
      );
    }

    const teamId = args.teamId ?? null;
    if (teamId !== null) {
      const team = yield* findBetterAuthDoc<BetterAuthTeam>({
        model: "team",
        where: [
          { field: "_id", value: teamId },
          { field: "organizationId", value: args.churchId },
        ],
      }).pipe(Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx));

      if (!team || team.archivedAt != null) {
        return labelErrorResponse(
          "createLabel",
          "team_not_found",
          "Team was not found in the active Church.",
        );
      }
    }

    const created = yield* Effect.promise(() =>
      createLabelForChurch(ctx, {
        churchId: args.churchId,
        name: args.name,
        teamId,
        ...(args.color !== undefined ? { color: args.color } : {}),
      }),
    ).pipe(Effect.orDie);

    if (!created.ok && created.code === "invalidLabelName") {
      return labelErrorResponse("createLabel", "invalid_label_name", "Label name is required.");
    }
    if (!created.ok) {
      return labelErrorResponse(
        "createLabel",
        "duplicate_label_name",
        "A Label with that name already exists in this scope.",
      );
    }

    const labels = yield* Effect.promise(() => listLabelsForChurch(ctx, args.churchId)).pipe(
      Effect.orDie,
    );

    return labelsResponse("createLabel", labels.map(serializeLabel));
  }),
);

const labelsUpdateForChurch = FunctionImpl.make(api, "labels", "updateForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return labelErrorResponse("updateLabel", "not_authenticated", "Authentication is required.");
    }
    if (auth.status === "notChurchMember") {
      return labelErrorResponse(
        "updateLabel",
        "not_church_member",
        "Church membership is required.",
      );
    }

    const updated = yield* Effect.promise(() =>
      updateLabelForChurch(ctx, {
        churchId: args.churchId,
        labelId: args.labelId,
        ...(args.name !== undefined ? { name: args.name } : {}),
        ...(args.color !== undefined ? { color: args.color } : {}),
      }),
    ).pipe(Effect.orDie);

    if (!updated.ok && updated.code === "labelNotFound") {
      return labelErrorResponse(
        "updateLabel",
        "label_not_found",
        "Label was not found in the active Church.",
      );
    }
    if (!updated.ok && updated.code === "invalidLabelName") {
      return labelErrorResponse("updateLabel", "invalid_label_name", "Label name is required.");
    }
    if (!updated.ok) {
      return labelErrorResponse(
        "updateLabel",
        "duplicate_label_name",
        "A Label with that name already exists in this scope.",
      );
    }

    const labels = yield* Effect.promise(() => listLabelsForChurch(ctx, args.churchId)).pipe(
      Effect.orDie,
    );

    return labelsResponse("updateLabel", labels.map(serializeLabel));
  }),
);

const labelsDeleteForChurch = FunctionImpl.make(api, "labels", "deleteForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return labelErrorResponse("deleteLabel", "not_authenticated", "Authentication is required.");
    }
    if (auth.status === "notChurchMember") {
      return labelErrorResponse(
        "deleteLabel",
        "not_church_member",
        "Church membership is required.",
      );
    }

    const deleted = yield* Effect.promise(() =>
      deleteLabelForChurch(ctx, { churchId: args.churchId, labelId: args.labelId }),
    ).pipe(Effect.orDie);

    if (!deleted.ok) {
      return labelErrorResponse(
        "deleteLabel",
        "label_not_found",
        "Label was not found in the active Church.",
      );
    }

    const labels = yield* Effect.promise(() => listLabelsForChurch(ctx, args.churchId)).pipe(
      Effect.orDie,
    );

    return labelsResponse("deleteLabel", labels.map(serializeLabel));
  }),
);

const keyDatesCreateForChurch = FunctionImpl.make(api, "keyDates", "createForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return keyDateErrorResponse(
        "createKeyDates",
        "not_authenticated",
        "Authentication is required.",
      );
    }
    if (auth.status === "notChurchMember") {
      return keyDateErrorResponse(
        "createKeyDates",
        "not_church_member",
        "Church membership is required.",
      );
    }
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      return keyDateErrorResponse(
        "createKeyDates",
        "not_authorized",
        "Only Church owners and admins can manage Key Dates.",
      );
    }

    const created = yield* Effect.tryPromise(() => createKeyDates(ctx, args)).pipe(
      Effect.catchAll(() =>
        Effect.succeed({ ok: false as const, code: "invalidKeyDate" as const }),
      ),
    );

    if (!created.ok && created.code === "duplicateKey") {
      return keyDateErrorResponse(
        "createKeyDates",
        "duplicate_key_date",
        "A Key Date with that key already exists in this Church.",
      );
    }
    if (!created.ok) {
      return keyDateErrorResponse(
        "createKeyDates",
        "invalid_key_date",
        "Key Date schedule fields must describe real local dates.",
      );
    }

    const model = yield* Effect.promise(() => readKeyDateModel(ctx, args.churchId)).pipe(
      Effect.orDie,
    );

    return keyDateResponse("createKeyDates", serializeKeyDateModel(model));
  }),
);

const keyDatesCreateOccurrences = FunctionImpl.make(api, "keyDates", "createOccurrences", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return keyDateErrorResponse(
        "createKeyDateOccurrences",
        "not_authenticated",
        "Authentication is required.",
      );
    }
    if (auth.status === "notChurchMember") {
      return keyDateErrorResponse(
        "createKeyDateOccurrences",
        "not_church_member",
        "Church membership is required.",
      );
    }
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      return keyDateErrorResponse(
        "createKeyDateOccurrences",
        "not_authorized",
        "Only Church owners and admins can manage Key Dates.",
      );
    }

    const created = yield* Effect.tryPromise(() => createKeyDateOccurrences(ctx, args)).pipe(
      Effect.catchAll(() =>
        Effect.succeed({ ok: false as const, code: "invalidOccurrence" as const }),
      ),
    );

    if (!created.ok && created.code === "keyDateNotFound") {
      return keyDateErrorResponse(
        "createKeyDateOccurrences",
        "key_date_not_found",
        "Key Date was not found in the active Church.",
      );
    }
    if (!created.ok && created.code === "duplicateOccurrence") {
      return keyDateErrorResponse(
        "createKeyDateOccurrences",
        "duplicate_occurrence",
        "That Key Date occurrence already exists.",
      );
    }
    if (!created.ok) {
      return keyDateErrorResponse(
        "createKeyDateOccurrences",
        "invalid_key_date",
        "Key Date Occurrence must use a real local date in YYYY-MM-DD format.",
      );
    }

    const model = yield* Effect.promise(() => readKeyDateModel(ctx, args.churchId)).pipe(
      Effect.orDie,
    );

    return keyDateResponse("createKeyDateOccurrences", serializeKeyDateModel(model));
  }),
);

const keyDatesListForChurch = FunctionImpl.make(api, "keyDates", "listForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* QueryCtx.QueryCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId);

    if (auth.status === "notAuthenticated") {
      return keyDateErrorResponse(
        "listKeyDates",
        "not_authenticated",
        "Authentication is required.",
      );
    }
    if (auth.status === "notChurchMember") {
      return keyDateErrorResponse(
        "listKeyDates",
        "not_church_member",
        "Church membership is required.",
      );
    }

    const model = yield* Effect.promise(() => readKeyDateModel(ctx, args.churchId)).pipe(
      Effect.orDie,
    );

    return keyDateResponse("listKeyDates", serializeKeyDateModel(model));
  }),
);

const keyDatesResolveOccurrences = FunctionImpl.make(
  api,
  "keyDates",
  "resolveOccurrences",
  (args) =>
    Effect.gen(function* () {
      const ctx = yield* QueryCtx.QueryCtx<DataModel>();
      const auth = yield* getAuthenticatedChurchMember(args.churchId);

      if (auth.status === "notAuthenticated") {
        return keyDateErrorResponse(
          "resolveKeyDateOccurrences",
          "not_authenticated",
          "Authentication is required.",
        );
      }
      if (auth.status === "notChurchMember") {
        return keyDateErrorResponse(
          "resolveKeyDateOccurrences",
          "not_church_member",
          "Church membership is required.",
        );
      }

      const model = yield* Effect.promise(() => readKeyDateModel(ctx, args.churchId)).pipe(
        Effect.orDie,
      );
      const resolvedOccurrences = yield* Effect.promise(() =>
        resolveKeyDateOccurrences(ctx, args),
      ).pipe(Effect.orDie);

      return keyDateResponse(
        "resolveKeyDateOccurrences",
        serializeKeyDateModel(model, resolvedOccurrences),
      );
    }),
);

const activitiesRecordForChurch = FunctionImpl.make(api, "activities", "recordForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const activityId = yield* Effect.tryPromise(() => writeActivity(ctx, args));
    const activity = yield* Effect.promise(() => ctx.db.get(activityId)).pipe(Effect.orDie);

    if (!activity) {
      return yield* Effect.dieMessage("Activity was not readable after insert.");
    }

    return recordActivityResponse(serializeActivity(activity));
  }).pipe(Effect.catchAll(() => Effect.succeed(invalidActivityMetadataResponse()))),
);

const activitiesListForEntity = FunctionImpl.make(api, "activities", "listForEntity", (args) =>
  Effect.gen(function* () {
    const ctx = yield* QueryCtx.QueryCtx<DataModel>();
    const activities = yield* Effect.promise(() => listActivitiesForEntity(ctx, args)).pipe(
      Effect.orDie,
    );

    return listActivitiesForEntityResponse(
      activities.map((activity) => serializeActivity(activity)),
    );
  }),
);

const teamListForChurch = FunctionImpl.make(api, "teams", "listForChurch", (args) =>
  Effect.gen(function* () {
    const auth = yield* getAuthenticatedChurchMember(args.churchId);

    if (auth.status === "notAuthenticated") {
      return teamErrorResponse("listTeams", "not_authenticated", "Authentication is required.");
    }
    if (auth.status === "notChurchMember") {
      return teamErrorResponse("listTeams", "not_church_member", "Church membership is required.");
    }

    const teams = yield* "includeArchived" in args && args.includeArchived
      ? listTeamsForChurch(args.churchId)
      : activeTeamsForChurch(args.churchId);

    return teamsResponse("listTeams", teams.map(serializeTeam));
  }),
);

const teamListMembershipsForChurch = FunctionImpl.make(
  api,
  "teams",
  "listMembershipsForChurch",
  (args) =>
    Effect.gen(function* () {
      const auth = yield* getAuthenticatedChurchMember(args.churchId);

      if (auth.status === "notAuthenticated") {
        return teamMembershipErrorResponse(
          "listTeamMemberships",
          "not_authenticated",
          "Authentication is required.",
        );
      }
      if (auth.status === "notChurchMember") {
        return teamMembershipErrorResponse(
          "listTeamMemberships",
          "not_church_member",
          "Church membership is required.",
        );
      }

      const memberships = yield* listTeamMembershipsForChurch(args.churchId);

      return teamMembershipsResponse(
        "listTeamMemberships",
        memberships.map((membership) => serializeTeamMembership(args.churchId, membership)),
      );
    }),
);

const teamAddMemberForChurch = FunctionImpl.make(api, "teams", "addMemberForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return teamMembershipErrorResponse(
        "addTeamMember",
        "not_authenticated",
        "Authentication is required.",
      );
    }
    if (auth.status === "notChurchMember") {
      return teamMembershipErrorResponse(
        "addTeamMember",
        "not_church_member",
        "Church membership is required.",
      );
    }
    const authError = teamMembershipManageAuthError("addTeamMember", auth.membership.role);
    if (authError) return authError;

    const team = (yield* Effect.promise(() =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "team",
        where: [
          { field: "_id", value: args.teamId },
          { field: "organizationId", value: args.churchId },
          { field: "archivedAt", value: null },
        ],
      }),
    ).pipe(Effect.orDie)) as BetterAuthTeam | null;
    if (!team) {
      return teamMembershipErrorResponse(
        "addTeamMember",
        "team_not_found",
        "Team was not found in the active Church.",
      );
    }

    const churchMember = (yield* Effect.promise(() =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "member",
        where: [
          { field: "organizationId", value: args.churchId },
          { field: "userId", value: args.userId },
        ],
      }),
    ).pipe(Effect.orDie)) as BetterAuthMember | null;
    if (!churchMember) {
      return teamMembershipErrorResponse(
        "addTeamMember",
        "member_not_found",
        "Church Member was not found in the active Church.",
      );
    }

    const existing = (yield* Effect.promise(() =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "teamMember",
        where: [
          { field: "teamId", value: args.teamId },
          { field: "userId", value: args.userId },
        ],
      }),
    ).pipe(Effect.orDie)) as BetterAuthTeamMember | null;

    if (!existing) {
      yield* Effect.promise(() =>
        ctx.runMutation(components.betterAuth.adapter.create, {
          input: {
            model: "teamMember",
            data: { teamId: args.teamId, userId: args.userId, createdAt: Date.now() },
          },
        }),
      ).pipe(Effect.orDie);
      yield* Effect.promise(() =>
        writeActivity(ctx, {
          churchId: args.churchId,
          entityType: "team",
          entityId: args.teamId,
          eventType: "team.member.added",
          actorType: "user",
          actorId: auth.authUser._id,
          occurredAt: new Date().toISOString(),
          cycleId: null,
          metadata: { memberUserId: args.userId },
        }),
      ).pipe(Effect.orDie);
    }

    const memberships = yield* listTeamMembershipsForChurch(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    return teamMembershipsResponse(
      "addTeamMember",
      memberships.map((membership) => serializeTeamMembership(args.churchId, membership)),
    );
  }),
);

const teamRemoveMemberForChurch = FunctionImpl.make(api, "teams", "removeMemberForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return teamMembershipErrorResponse(
        "removeTeamMember",
        "not_authenticated",
        "Authentication is required.",
      );
    }
    if (auth.status === "notChurchMember") {
      return teamMembershipErrorResponse(
        "removeTeamMember",
        "not_church_member",
        "Church membership is required.",
      );
    }
    const authError = teamMembershipManageAuthError("removeTeamMember", auth.membership.role);
    if (authError) return authError;

    const team = (yield* Effect.promise(() =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "team",
        where: [
          { field: "_id", value: args.teamId },
          { field: "organizationId", value: args.churchId },
        ],
      }),
    ).pipe(Effect.orDie)) as BetterAuthTeam | null;
    if (!team) {
      return teamMembershipErrorResponse(
        "removeTeamMember",
        "team_not_found",
        "Team was not found in the active Church.",
      );
    }

    const existing = (yield* Effect.promise(() =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "teamMember",
        where: [
          { field: "teamId", value: args.teamId },
          { field: "userId", value: args.userId },
        ],
      }),
    ).pipe(Effect.orDie)) as BetterAuthTeamMember | null;

    if (existing) {
      yield* Effect.promise(() =>
        ctx.runMutation(components.betterAuth.adapter.deleteOne, {
          input: {
            model: "teamMember",
            where: [{ field: "_id", value: existing._id }],
          },
        }),
      ).pipe(Effect.orDie);
      yield* Effect.promise(() =>
        writeActivity(ctx, {
          churchId: args.churchId,
          entityType: "team",
          entityId: args.teamId,
          eventType: "team.member.removed",
          actorType: "user",
          actorId: auth.authUser._id,
          occurredAt: new Date().toISOString(),
          cycleId: null,
          metadata: { memberUserId: args.userId },
        }),
      ).pipe(Effect.orDie);
    }

    const memberships = yield* listTeamMembershipsForChurch(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    return teamMembershipsResponse(
      "removeTeamMember",
      memberships.map((membership) => serializeTeamMembership(args.churchId, membership)),
    );
  }),
);

const teamCreateForChurch = FunctionImpl.make(api, "teams", "createForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return teamErrorResponse("createTeam", "not_authenticated", "Authentication is required.");
    }
    if (auth.status === "notChurchMember") {
      return teamErrorResponse("createTeam", "not_church_member", "Church membership is required.");
    }
    const authError = teamManageAuthError("createTeam", auth.membership.role);
    if (authError) return authError;

    const teams = yield* listTeamsForChurch(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );
    const sortOrder = teams.reduce((max, team) => Math.max(max, team.sortOrder ?? -1), -1) + 1;
    // Retired identifiers are not reserved: only current identifiers block
    // generation.
    const identifier = generateTeamIdentifier(args.name, teams.map(currentTeamIdentifier));
    yield* Effect.promise(() =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: "team",
          data: {
            name: args.name,
            organizationId: args.churchId,
            createdAt: Date.now(),
            updatedAt: null,
            archivedAt: null,
            sortOrder,
            color: getTeamColorForName(args.name),
            identifier,
            previousIdentifiers: [],
          },
        },
      }),
    ).pipe(Effect.orDie);

    const createdTeams = yield* activeTeamsForChurch(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );
    const createdTeam = [...createdTeams]
      .reverse()
      .find((team) => team.name === args.name && (team.sortOrder ?? 0) === sortOrder);

    if (createdTeam) {
      // Every Team owns its Workflow (ADR 0013): seed To Do / In Progress /
      // Done for the new Team.
      yield* Effect.promise(() =>
        seedTeamWorkflow(ctx, {
          churchId: args.churchId,
          teamId: createdTeam._id,
          name: args.name,
        }),
      ).pipe(Effect.orDie);

      yield* Effect.promise(() =>
        writeActivity(ctx, {
          churchId: args.churchId,
          entityType: "team",
          entityId: createdTeam._id,
          eventType: "team.created",
          actorType: "user",
          actorId: auth.authUser._id,
          occurredAt: new Date().toISOString(),
          cycleId: null,
          metadata: { name: args.name },
        }),
      ).pipe(Effect.orDie);
    }

    return teamsResponse("createTeam", createdTeams.map(serializeTeam));
  }),
);

const teamRenameForChurch = FunctionImpl.make(api, "teams", "renameForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return teamErrorResponse("renameTeam", "not_authenticated", "Authentication is required.");
    }
    if (auth.status === "notChurchMember") {
      return teamErrorResponse("renameTeam", "not_church_member", "Church membership is required.");
    }
    const authError = teamManageAuthError("renameTeam", auth.membership.role);
    if (authError) return authError;

    const team = (yield* Effect.promise(() =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "team",
        where: [
          { field: "_id", value: args.teamId },
          { field: "organizationId", value: args.churchId },
        ],
      }),
    ).pipe(Effect.orDie)) as BetterAuthTeam | null;

    if (!team) {
      return teamErrorResponse(
        "renameTeam",
        "team_not_found",
        "Team was not found in the active Church.",
      );
    }

    yield* Effect.promise(() =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "team",
          where: [{ field: "_id", value: args.teamId }],
          update: { name: args.name, updatedAt: Date.now() },
        },
      }),
    ).pipe(Effect.orDie);
    yield* Effect.promise(() =>
      writeActivity(ctx, {
        churchId: args.churchId,
        entityType: "team",
        entityId: args.teamId,
        eventType: "team.renamed",
        actorType: "user",
        actorId: auth.authUser._id,
        occurredAt: new Date().toISOString(),
        cycleId: null,
        metadata: { previousName: team.name, name: args.name },
      }),
    ).pipe(Effect.orDie);

    const teams = yield* activeTeamsForChurch(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );
    return teamsResponse("renameTeam", teams.map(serializeTeam));
  }),
);

const teamSetIdentifierForChurch = FunctionImpl.make(
  api,
  "teams",
  "setIdentifierForChurch",
  (args) =>
    Effect.gen(function* () {
      const ctx = yield* MutationCtx.MutationCtx<DataModel>();
      const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
        Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
      );

      if (auth.status === "notAuthenticated") {
        return teamErrorResponse(
          "setTeamIdentifier",
          "not_authenticated",
          "Authentication is required.",
        );
      }
      if (auth.status === "notChurchMember") {
        return teamErrorResponse(
          "setTeamIdentifier",
          "not_church_member",
          "Church membership is required.",
        );
      }
      const authError = teamManageAuthError("setTeamIdentifier", auth.membership.role);
      if (authError) return authError;

      const identifier = normalizeTeamIdentifier(args.identifier);
      if (!isValidTeamIdentifier(identifier)) {
        return teamErrorResponse(
          "setTeamIdentifier",
          "invalid_team_identifier",
          `Team Identifier must be 1-${TEAM_IDENTIFIER_MAX_LENGTH} letters or numbers.`,
        );
      }

      const teams = yield* listTeamsForChurch(args.churchId).pipe(
        Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
      );
      const team = teams.find((candidate) => candidate._id === args.teamId);

      if (!team) {
        return teamErrorResponse(
          "setTeamIdentifier",
          "team_not_found",
          "Team was not found in the active Church.",
        );
      }

      const previousIdentifier = currentTeamIdentifier(team);
      const isTaken = teams.some(
        (candidate) =>
          candidate._id !== args.teamId && currentTeamIdentifier(candidate) === identifier,
      );
      if (isTaken) {
        return teamErrorResponse(
          "setTeamIdentifier",
          "team_identifier_taken",
          "Another Team in this Church already uses that identifier.",
        );
      }

      if (identifier !== previousIdentifier) {
        // Remember the old identifier so existing links keep resolving; drop
        // re-claimed values so the list never shadows the current identifier.
        const previousIdentifiers = [
          ...(team.previousIdentifiers ?? []).filter((value) => value !== identifier),
          previousIdentifier,
        ];
        yield* Effect.promise(() =>
          ctx.runMutation(components.betterAuth.adapter.updateOne, {
            input: {
              model: "team",
              where: [{ field: "_id", value: args.teamId }],
              update: { identifier, previousIdentifiers, updatedAt: Date.now() },
            },
          }),
        ).pipe(Effect.orDie);
        yield* Effect.promise(() =>
          writeActivity(ctx, {
            churchId: args.churchId,
            entityType: "team",
            entityId: args.teamId,
            eventType: "team.identifier_changed",
            actorType: "user",
            actorId: auth.authUser._id,
            occurredAt: new Date().toISOString(),
            cycleId: null,
            metadata: { previousIdentifier, identifier },
          }),
        ).pipe(Effect.orDie);
      }

      const updatedTeams = yield* activeTeamsForChurch(args.churchId).pipe(
        Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
      );
      return teamsResponse("setTeamIdentifier", updatedTeams.map(serializeTeam));
    }),
);

const teamArchiveForChurch = FunctionImpl.make(api, "teams", "archiveForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return teamErrorResponse("archiveTeam", "not_authenticated", "Authentication is required.");
    }
    if (auth.status === "notChurchMember") {
      return teamErrorResponse(
        "archiveTeam",
        "not_church_member",
        "Church membership is required.",
      );
    }
    const authError = teamManageAuthError("archiveTeam", auth.membership.role);
    if (authError) return authError;

    const team = (yield* Effect.promise(() =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "team",
        where: [
          { field: "_id", value: args.teamId },
          { field: "organizationId", value: args.churchId },
        ],
      }),
    ).pipe(Effect.orDie)) as BetterAuthTeam | null;

    if (!team) {
      return teamErrorResponse(
        "archiveTeam",
        "team_not_found",
        "Team was not found in the active Church.",
      );
    }

    const isLastTeam = yield* isLastActiveTeam(args.churchId, team).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );
    if (isLastTeam) {
      return teamErrorResponse(
        "archiveTeam",
        "last_team_required",
        "A Church must keep at least one active Team.",
      );
    }

    const archivedAt = new Date().toISOString();
    const repairedTemplateTeams = yield* Effect.promise(() =>
      repairTemplateTeamsForTeamRemoval(ctx, {
        churchId: args.churchId,
        teamId: args.teamId,
        repairs: args.templateTeamRepairs ?? [],
        now: archivedAt,
      }),
    ).pipe(Effect.orDie);
    if (!repairedTemplateTeams.ok) {
      if (repairedTemplateTeams.code === "teamNotFound") {
        return teamErrorResponse(
          "archiveTeam",
          "team_not_found",
          "Template Team remap target was not found in the active Church.",
        );
      }
      return teamErrorResponse(
        "archiveTeam",
        "template_team_repair_required",
        "Template Teams mapped to this Team must be remapped or abandoned before archiving.",
      );
    }

    yield* Effect.promise(() =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "team",
          where: [{ field: "_id", value: args.teamId }],
          update: { archivedAt, updatedAt: Date.now() },
        },
      }),
    ).pipe(Effect.orDie);
    yield* Effect.promise(() =>
      writeActivity(ctx, {
        churchId: args.churchId,
        entityType: "team",
        entityId: args.teamId,
        eventType: "team.archived",
        actorType: "user",
        actorId: auth.authUser._id,
        occurredAt: archivedAt,
        cycleId: null,
        metadata: { name: team.name },
      }),
    ).pipe(Effect.orDie);

    const teams = yield* activeTeamsForChurch(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );
    return teamsResponse("archiveTeam", teams.map(serializeTeam));
  }),
);

const teamDeleteForChurch = FunctionImpl.make(api, "teams", "deleteForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return teamErrorResponse("deleteTeam", "not_authenticated", "Authentication is required.");
    }
    if (auth.status === "notChurchMember") {
      return teamErrorResponse("deleteTeam", "not_church_member", "Church membership is required.");
    }
    const authError = teamManageAuthError("deleteTeam", auth.membership.role);
    if (authError) return authError;

    const team = (yield* Effect.promise(() =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "team",
        where: [
          { field: "_id", value: args.teamId },
          { field: "organizationId", value: args.churchId },
        ],
      }),
    ).pipe(Effect.orDie)) as BetterAuthTeam | null;

    if (!team) {
      return teamErrorResponse(
        "deleteTeam",
        "team_not_found",
        "Team was not found in the active Church.",
      );
    }

    const isLastTeam = yield* isLastActiveTeam(args.churchId, team).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );
    if (isLastTeam) {
      return teamErrorResponse(
        "deleteTeam",
        "last_team_required",
        "A Church must keep at least one active Team.",
      );
    }

    const taskUsingTeam = yield* Effect.promise(() =>
      ctx.db
        .query("tasks")
        .withIndex("by_churchId", (q) => q.eq("churchId", args.churchId))
        .filter((q) => q.eq(q.field("teamId"), args.teamId))
        .first(),
    ).pipe(Effect.orDie);

    if (taskUsingTeam) {
      return teamErrorResponse(
        "deleteTeam",
        "team_has_tasks",
        "Teams with Tasks can be archived but not deleted.",
      );
    }

    const deletedAt = new Date().toISOString();
    const repairedTemplateTeams = yield* Effect.promise(() =>
      repairTemplateTeamsForTeamRemoval(ctx, {
        churchId: args.churchId,
        teamId: args.teamId,
        repairs: args.templateTeamRepairs ?? [],
        now: deletedAt,
      }),
    ).pipe(Effect.orDie);
    if (!repairedTemplateTeams.ok) {
      if (repairedTemplateTeams.code === "teamNotFound") {
        return teamErrorResponse(
          "deleteTeam",
          "team_not_found",
          "Template Team remap target was not found in the active Church.",
        );
      }
      return teamErrorResponse(
        "deleteTeam",
        "template_team_repair_required",
        "Template Teams mapped to this Team must be remapped or abandoned before deleting.",
      );
    }

    const teamMemberships = yield* findBetterAuthDocs<{ _id: string }>({
      model: "teamMember",
      where: [{ field: "teamId", value: args.teamId }],
    }).pipe(Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx));

    for (const teamMembership of teamMemberships) {
      yield* Effect.promise(() =>
        ctx.runMutation(components.betterAuth.adapter.deleteOne, {
          input: {
            model: "teamMember",
            where: [{ field: "_id", value: teamMembership._id }],
          },
        }),
      ).pipe(Effect.orDie);
    }

    yield* Effect.promise(() =>
      ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: {
          model: "team",
          where: [{ field: "_id", value: args.teamId }],
        },
      }),
    ).pipe(Effect.orDie);
    yield* Effect.promise(() =>
      writeActivity(ctx, {
        churchId: args.churchId,
        entityType: "team",
        entityId: args.teamId,
        eventType: "team.deleted",
        actorType: "user",
        actorId: auth.authUser._id,
        occurredAt: deletedAt,
        cycleId: null,
        metadata: { name: team.name },
      }),
    ).pipe(Effect.orDie);

    const teams = yield* activeTeamsForChurch(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );
    return teamsResponse("deleteTeam", teams.map(serializeTeam));
  }),
);

const teamReorderForChurch = FunctionImpl.make(api, "teams", "reorderForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return teamErrorResponse("reorderTeams", "not_authenticated", "Authentication is required.");
    }
    if (auth.status === "notChurchMember") {
      return teamErrorResponse(
        "reorderTeams",
        "not_church_member",
        "Church membership is required.",
      );
    }
    const authError = teamManageAuthError("reorderTeams", auth.membership.role);
    if (authError) return authError;

    const teams = yield* activeTeamsForChurch(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );
    const teamsById = new Map(teams.map((team) => [team._id, team]));
    const uniqueTeamIds = new Set(args.teamIds);
    if (
      uniqueTeamIds.size !== args.teamIds.length ||
      args.teamIds.some((id) => !teamsById.has(id))
    ) {
      return teamErrorResponse(
        "reorderTeams",
        "invalid_team_reorder",
        "Team reorder must include active Teams from the requested Church only.",
      );
    }

    const occurredAt = new Date().toISOString();
    for (const [sortOrder, teamId] of args.teamIds.entries()) {
      const team = teamsById.get(teamId)!;
      yield* Effect.promise(() =>
        ctx.runMutation(components.betterAuth.adapter.updateOne, {
          input: {
            model: "team",
            where: [{ field: "_id", value: teamId }],
            update: { sortOrder, updatedAt: Date.now() },
          },
        }),
      ).pipe(Effect.orDie);
      if ((team.sortOrder ?? 0) !== sortOrder) {
        yield* Effect.promise(() =>
          writeActivity(ctx, {
            churchId: args.churchId,
            entityType: "team",
            entityId: teamId,
            eventType: "team.reordered",
            actorType: "user",
            actorId: auth.authUser._id,
            occurredAt,
            cycleId: null,
            metadata: { previousSortOrder: team.sortOrder ?? 0, sortOrder },
          }),
        ).pipe(Effect.orDie);
      }
    }

    const reorderedTeams = yield* activeTeamsForChurch(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );
    return teamsResponse("reorderTeams", reorderedTeams.map(serializeTeam));
  }),
);

const teamUpdateProductFields = FunctionImpl.make(api, "teams", "updateProductFields", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return teamErrorResponse(
        "updateTeamProductFields",
        "not_authenticated",
        "Authentication is required.",
      );
    }
    if (auth.status === "notChurchMember") {
      return teamErrorResponse(
        "updateTeamProductFields",
        "not_church_member",
        "Church membership is required.",
      );
    }
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      return teamErrorResponse(
        "updateTeamProductFields",
        "not_authorized",
        "Only Church owners and admins can update Team product settings.",
      );
    }

    for (const update of args.updates) {
      const team = (yield* Effect.promise(() =>
        ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: "team",
          where: [
            { field: "_id", value: update.teamId },
            { field: "organizationId", value: args.churchId },
          ],
        }),
      ).pipe(Effect.orDie)) as BetterAuthTeam | null;

      if (!team) {
        return teamErrorResponse(
          "updateTeamProductFields",
          "team_not_found",
          "Team was not found in the active Church.",
        );
      }

      yield* Effect.promise(() =>
        ctx.runMutation(components.betterAuth.adapter.updateOne, {
          input: {
            model: "team",
            where: [{ field: "_id", value: update.teamId }],
            update: update.fields,
          },
        }),
      ).pipe(Effect.orDie);
    }

    const teams = yield* listTeamsForChurch(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    return teamsResponse("updateTeamProductFields", teams.map(serializeTeam));
  }),
);

const tasksCreateBatch = FunctionImpl.make(api, "tasks", "createBatch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return taskErrorResponse("createTasks", "not_authenticated", "Authentication is required.");
    }
    if (auth.status === "notChurchMember") {
      return taskErrorResponse(
        "createTasks",
        "not_church_member",
        "Church membership is required.",
      );
    }

    const church = yield* findBetterAuthDoc<BetterAuthOrganization>({
      model: "organization",
      where: [{ field: "_id", value: args.churchId }],
    }).pipe(Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx));

    if (!church?.churchTimeZone) {
      return taskErrorResponse(
        "createTasks",
        "church_time_zone_missing",
        "Church Time Zone is required before Tasks can be scheduled.",
      );
    }

    const assignedUserIds = [
      ...new Set(
        args.tasks
          .map((task) => task.assignedUserId ?? null)
          .filter((userId): userId is string => userId !== null),
      ),
    ];
    for (const assignedUserId of assignedUserIds) {
      const assignedMembership = yield* findBetterAuthDoc<BetterAuthMember>({
        model: "member",
        where: [
          { field: "organizationId", value: args.churchId },
          { field: "userId", value: assignedUserId },
        ],
      }).pipe(Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx));

      if (!assignedMembership) {
        return taskErrorResponse(
          "createTasks",
          "assigned_user_not_church_member",
          "Assigned User must be a Church Member of the Task's Church.",
        );
      }
    }

    const teamIds = [...new Set(args.tasks.map((task) => task.teamId))];
    const teamWorkflowIds: Record<string, string> = {};
    for (const teamId of teamIds) {
      const team = (yield* Effect.promise(() =>
        ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: "team",
          where: [
            { field: "_id", value: teamId },
            { field: "organizationId", value: args.churchId },
          ],
        }),
      ).pipe(Effect.orDie)) as BetterAuthTeam | null;

      if (!team || team.archivedAt != null) {
        return taskErrorResponse(
          "createTasks",
          "team_not_found",
          "Team was not found in the active Church.",
        );
      }

      // Every Team owns its Workflow (ADR 0013); there is no Church default
      // Workflow to fall back to.
      const teamWorkflow = yield* Effect.promise(() =>
        getTeamWorkflow(ctx, { churchId: args.churchId, teamId }),
      ).pipe(Effect.orDie);

      if (!teamWorkflow) {
        return taskErrorResponse(
          "createTasks",
          "team_workflow_not_configured",
          "The Team's Workflow is missing.",
        );
      }

      teamWorkflowIds[teamId] = teamWorkflow._id;
    }

    for (const task of args.tasks) {
      const workflowStatus = yield* Effect.promise(() =>
        ctx.db.get(task.workflowStatusId as Id<"workflowStatuses">),
      ).pipe(Effect.orDie);
      if (
        !workflowStatus ||
        workflowStatus.churchId !== args.churchId ||
        workflowStatus.archivedAt !== null
      ) {
        return taskErrorResponse(
          "createTasks",
          "workflow_status_not_found",
          "Workflow Status was not found in the active Church.",
        );
      }

      const effectiveWorkflowId = teamWorkflowIds[task.teamId];
      if (workflowStatus.workflowId !== effectiveWorkflowId) {
        return taskErrorResponse(
          "createTasks",
          "workflow_status_not_in_effective_workflow",
          "Workflow Status must belong to the Task's effective Workflow.",
        );
      }
    }

    const created = yield* Effect.promise(() =>
      createTasks(ctx, {
        churchId: args.churchId,
        churchTimeZone: church.churchTimeZone!,
        tasks: args.tasks.map((task) => ({
          ...task,
          createdByUserId: auth.authUser._id,
        })),
      }),
    ).pipe(Effect.orDie);

    if (!created.ok && created.code === "workflowStatusNotFound") {
      return taskErrorResponse(
        "createTasks",
        "workflow_status_not_found",
        "Workflow Status was not found in the active Church.",
      );
    }
    if (!created.ok && created.code === "parentTaskNotFound") {
      return taskErrorResponse(
        "createTasks",
        "parent_task_not_found",
        "Parent Task was not found in the active Church.",
      );
    }
    if (!created.ok && created.code === "invalidDueDate") {
      return taskErrorResponse(
        "createTasks",
        "invalid_due_date",
        "Task Due Date must be a real Church-local date in YYYY-MM-DD format.",
      );
    }
    if (!created.ok && created.code === "labelNotFound") {
      return taskErrorResponse(
        "createTasks",
        "label_not_found",
        "Label was not found in the active Church.",
      );
    }
    if (!created.ok && created.code === "labelNotInTeamScope") {
      return taskErrorResponse(
        "createTasks",
        "label_not_in_team_scope",
        "Team Labels can only be applied to Tasks assigned to their Team.",
      );
    }
    if (!created.ok) {
      return yield* Effect.dieMessage("Unexpected Task creation result.");
    }

    const occurredAt = new Date().toISOString();
    for (const taskId of created.createdTaskIds) {
      const task = yield* Effect.promise(() => ctx.db.get(taskId)).pipe(Effect.orDie);
      if (!task) continue;

      yield* Effect.promise(() =>
        writeActivity(ctx, {
          churchId: args.churchId,
          entityType: "task",
          entityId: task._id,
          eventType: "task.created",
          actorType: "user",
          actorId: auth.authUser._id,
          occurredAt,
          cycleId: task.cycleId,
          metadata: { parentTaskId: task.parentTaskId },
        }),
      ).pipe(Effect.orDie);
    }

    const model = yield* Effect.promise(() => readTaskModel(ctx, args.churchId)).pipe(Effect.orDie);

    return taskResponse("createTasks", serializeTaskModel(model));
  }),
);

const tasksUpdateBatch = FunctionImpl.make(api, "tasks", "updateBatch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return taskErrorResponse("updateTasks", "not_authenticated", "Authentication is required.");
    }
    if (auth.status === "notChurchMember") {
      return taskErrorResponse(
        "updateTasks",
        "not_church_member",
        "Church membership is required.",
      );
    }

    const assignedUserIds = [
      ...new Set(
        args.updates
          .map((update) => update.fields.assignedUserId ?? null)
          .filter((userId): userId is string => userId !== null),
      ),
    ];
    for (const assignedUserId of assignedUserIds) {
      const assignedMembership = yield* findBetterAuthDoc<BetterAuthMember>({
        model: "member",
        where: [
          { field: "organizationId", value: args.churchId },
          { field: "userId", value: assignedUserId },
        ],
      }).pipe(Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx));

      if (!assignedMembership) {
        return taskErrorResponse(
          "updateTasks",
          "assigned_user_not_church_member",
          "Assigned User must be a Church Member of the Task's Church.",
        );
      }
    }

    const teamIds = [
      ...new Set(
        args.updates
          .map((update) => update.fields.teamId)
          .filter((teamId): teamId is string => teamId !== undefined),
      ),
    ];
    const church = yield* findBetterAuthDoc<BetterAuthOrganization>({
      model: "organization",
      where: [{ field: "_id", value: args.churchId }],
    }).pipe(Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx));

    const churchTimeZone = church?.churchTimeZone;
    if (!churchTimeZone) {
      return taskErrorResponse(
        "updateTasks",
        "church_time_zone_missing",
        "Church Time Zone is required before Tasks can be scheduled.",
      );
    }

    const teamWorkflowIds: Record<string, string> = {};
    for (const teamId of teamIds) {
      const team = (yield* Effect.promise(() =>
        ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: "team",
          where: [
            { field: "_id", value: teamId },
            { field: "organizationId", value: args.churchId },
          ],
        }),
      ).pipe(Effect.orDie)) as BetterAuthTeam | null;

      if (!team || team.archivedAt != null) {
        return taskErrorResponse(
          "updateTasks",
          "team_not_found",
          "Team was not found in the active Church.",
        );
      }

      // Every Team owns its Workflow (ADR 0013); there is no Church default
      // Workflow to fall back to.
      const teamWorkflow = yield* Effect.promise(() =>
        getTeamWorkflow(ctx, { churchId: args.churchId, teamId }),
      ).pipe(Effect.orDie);

      if (!teamWorkflow) {
        return taskErrorResponse(
          "updateTasks",
          "team_workflow_not_configured",
          "The Team's Workflow is missing.",
        );
      }

      teamWorkflowIds[teamId] = teamWorkflow._id;
    }

    const updated = yield* Effect.promise(() =>
      updateTasks(ctx, {
        churchId: args.churchId,
        updates: args.updates,
        actorId: auth.authUser._id,
        occurredAt: new Date().toISOString(),
        churchTimeZone,
        teamWorkflowResolution: { teamWorkflowIds },
      }),
    ).pipe(Effect.orDie);

    if (!updated.ok && updated.code === "taskNotFound") {
      return taskErrorResponse(
        "updateTasks",
        "task_not_found",
        "Task was not found in the active Church.",
      );
    }
    if (!updated.ok && updated.code === "teamWorkflowNotConfigured") {
      return taskErrorResponse(
        "updateTasks",
        "team_workflow_not_configured",
        "Team Workflow is not configured.",
      );
    }
    if (!updated.ok && updated.code === "workflowStatusRemapFailed") {
      return taskErrorResponse(
        "updateTasks",
        "workflow_status_remap_failed",
        "Destination Workflow cannot preserve the Task State.",
      );
    }
    if (!updated.ok && updated.code === "workflowStatusNotFound") {
      return taskErrorResponse(
        "updateTasks",
        "workflow_status_not_found",
        "Workflow Status was not found in the active Church.",
      );
    }
    if (!updated.ok && updated.code === "workflowStatusNotInEffectiveWorkflow") {
      return taskErrorResponse(
        "updateTasks",
        "workflow_status_not_in_effective_workflow",
        "Workflow Status must belong to the Task's effective Workflow.",
      );
    }
    if (!updated.ok && updated.code === "invalidTaskTransition") {
      return taskErrorResponse(
        "updateTasks",
        "invalid_task_transition",
        "Task cannot perform that transition from its current state.",
      );
    }
    if (!updated.ok && updated.code === "invalidDueDate") {
      return taskErrorResponse(
        "updateTasks",
        "invalid_due_date",
        "Task Due Date must be a real Church-local date in YYYY-MM-DD format.",
      );
    }
    if (!updated.ok && updated.code === "cycleNotFound") {
      return taskErrorResponse(
        "updateTasks",
        "cycle_not_found",
        "Cycle was not found in the active Church.",
      );
    }
    if (!updated.ok && updated.code === "parentTaskNotFound") {
      return taskErrorResponse(
        "updateTasks",
        "parent_task_not_found",
        "Parent Task was not found in the active Church.",
      );
    }
    if (!updated.ok && updated.code === "labelNotFound") {
      return taskErrorResponse(
        "updateTasks",
        "label_not_found",
        "Label was not found in the active Church.",
      );
    }
    if (!updated.ok && updated.code === "labelNotInTeamScope") {
      return taskErrorResponse(
        "updateTasks",
        "label_not_in_team_scope",
        "Team Labels can only be applied to Tasks assigned to their Team.",
      );
    }
    if (!updated.ok) {
      return yield* Effect.dieMessage("Unexpected Task update result.");
    }

    const model = yield* Effect.promise(() => readTaskModel(ctx, args.churchId)).pipe(Effect.orDie);

    return taskResponse("updateTasks", serializeTaskModel(model));
  }),
);

const tasksListForChurch = FunctionImpl.make(api, "tasks", "listForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* QueryCtx.QueryCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId);

    if (auth.status === "notAuthenticated") {
      return taskErrorResponse("listTasks", "not_authenticated", "Authentication is required.");
    }
    if (auth.status === "notChurchMember") {
      return taskErrorResponse("listTasks", "not_church_member", "Church membership is required.");
    }

    const model = yield* Effect.promise(() =>
      readTaskModel(ctx, args.churchId, {
        surface: args.surface,
        cycleId: args.cycleId,
        currentUserId: auth.authUser._id,
      }),
    ).pipe(Effect.orDie);

    return taskResponse("listTasks", serializeTaskModel(model));
  }),
);

// Identifier resolution (ADR 0013): church + Task Identifier string in, Task
// out. Case-insensitive, current-first with alias fallback; shared by the
// URL layer, the details pane, and the MCP surface.
const tasksResolveByIdentifier = FunctionImpl.make(api, "tasks", "resolveByIdentifier", (args) =>
  Effect.gen(function* () {
    const ctx = yield* QueryCtx.QueryCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId);

    if (auth.status === "notAuthenticated") {
      return taskErrorResponse("resolveTask", "not_authenticated", "Authentication is required.");
    }
    if (auth.status === "notChurchMember") {
      return taskErrorResponse(
        "resolveTask",
        "not_church_member",
        "Church membership is required.",
      );
    }

    const task = yield* Effect.promise(() =>
      resolveTaskByIdentifier(ctx, args.churchId, args.identifier),
    ).pipe(Effect.orDie);

    if (!task) {
      return taskErrorResponse(
        "resolveTask",
        "task_not_found",
        "No Task matches that Task Identifier in the active Church.",
      );
    }

    const model = yield* Effect.promise(() =>
      readTaskModel(ctx, args.churchId, { taskId: task._id }),
    ).pipe(Effect.orDie);

    return taskResponse("resolveTask", serializeTaskModel(model));
  }),
);

const taskTransitionError = (
  operation: "completeTasks" | "cancelTasks" | "reopenTasks",
  code:
    | "taskNotFound"
    | "invalidTaskTransition"
    | "inconsistentTaskStatus"
    | "workflowStatusNotFound"
    | "doneWorkflowStatusNotFound"
    | "restoreActivityNotFound"
    | "restoreWorkflowStatusNotFound",
) => {
  if (code === "taskNotFound") {
    return taskErrorResponse(
      operation,
      "task_not_found",
      "Task was not found in the active Church.",
    );
  }
  if (code === "inconsistentTaskStatus") {
    return taskErrorResponse(
      operation,
      "inconsistent_task_status",
      "Task State and Workflow Status are inconsistent.",
    );
  }
  if (code === "workflowStatusNotFound") {
    return taskErrorResponse(
      operation,
      "workflow_status_not_found",
      "Workflow Status was not found in the active Church.",
    );
  }
  if (code === "doneWorkflowStatusNotFound") {
    return taskErrorResponse(
      operation,
      "done_workflow_status_not_found",
      "The Task Workflow does not have an active Done Workflow Status.",
    );
  }
  if (code === "restoreActivityNotFound") {
    return taskErrorResponse(
      operation,
      "restore_activity_not_found",
      "Canceled Task restore metadata was not found.",
    );
  }
  if (code === "restoreWorkflowStatusNotFound") {
    return taskErrorResponse(
      operation,
      "restore_workflow_status_not_found",
      "The previous Workflow Status could not be restored.",
    );
  }

  return taskErrorResponse(
    operation,
    "invalid_task_transition",
    "Task cannot perform that transition from its current state.",
  );
};

const makeTaskTransitionMutation = (
  name: "completeBatch" | "cancelBatch" | "reopenBatch",
  operation: "completeTasks" | "cancelTasks" | "reopenTasks",
  transition: typeof completeTasks | typeof cancelTasks | typeof reopenTasks,
) =>
  FunctionImpl.make(api, "tasks", name, (args) =>
    Effect.gen(function* () {
      const ctx = yield* MutationCtx.MutationCtx<DataModel>();
      const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
        Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
      );

      if (auth.status === "notAuthenticated") {
        return taskErrorResponse(operation, "not_authenticated", "Authentication is required.");
      }
      if (auth.status === "notChurchMember") {
        return taskErrorResponse(operation, "not_church_member", "Church membership is required.");
      }

      const result = yield* Effect.promise(() =>
        transition(ctx, {
          churchId: args.churchId,
          taskIds: args.taskIds,
          actorId: auth.authUser._id,
        }),
      ).pipe(Effect.orDie);

      if (!result.ok) return taskTransitionError(operation, result.code);

      const model = yield* Effect.promise(() => readTaskModel(ctx, args.churchId)).pipe(
        Effect.orDie,
      );

      return taskResponse(operation, serializeTaskModel(model));
    }),
  );

const tasksCompleteBatch = makeTaskTransitionMutation(
  "completeBatch",
  "completeTasks",
  completeTasks,
);
const tasksCancelBatch = makeTaskTransitionMutation("cancelBatch", "cancelTasks", cancelTasks);
const tasksReopenBatch = makeTaskTransitionMutation("reopenBatch", "reopenTasks", reopenTasks);

const templatesCreateForChurch = FunctionImpl.make(api, "templates", "createForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return templateErrorResponse(
        "createTemplates",
        "not_authenticated",
        "Authentication is required.",
      );
    }
    if (auth.status === "notChurchMember") {
      return templateErrorResponse(
        "createTemplates",
        "not_church_member",
        "Church membership is required.",
      );
    }
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      return templateErrorResponse(
        "createTemplates",
        "not_authorized",
        "Only Church owners and admins can manage Templates.",
      );
    }

    const created = yield* Effect.tryPromise(() => createTemplates(ctx, args)).pipe(
      Effect.catchAll(() =>
        Effect.succeed({ ok: false as const, code: "invalidTemplate" as const }),
      ),
    );
    if (!created.ok && created.code === "teamNotFound") {
      return templateErrorResponse(
        "createTemplates",
        "team_not_found",
        "Template Team mapping must reference an active Team in the Church.",
      );
    }
    if (!created.ok) {
      return templateErrorResponse(
        "createTemplates",
        "invalid_template",
        "Template, Focus Window, and Scheduling Rule fields must be valid.",
      );
    }

    const model = yield* Effect.promise(() => readTemplateModel(ctx, args.churchId)).pipe(
      Effect.orDie,
    );

    return templateResponse("createTemplates", serializeTemplateModel(model));
  }),
);

const templatesResolveSchedules = FunctionImpl.make(api, "templates", "resolveSchedules", (args) =>
  Effect.gen(function* () {
    const ctx = yield* QueryCtx.QueryCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId);

    if (auth.status === "notAuthenticated") {
      return templateErrorResponse(
        "resolveTemplateSchedules",
        "not_authenticated",
        "Authentication is required.",
      );
    }
    if (auth.status === "notChurchMember") {
      return templateErrorResponse(
        "resolveTemplateSchedules",
        "not_church_member",
        "Church membership is required.",
      );
    }

    const church = yield* findBetterAuthDoc<BetterAuthOrganization>({
      model: "organization",
      where: [{ field: "_id", value: args.churchId }],
    });

    if (!church?.churchTimeZone) {
      return templateErrorResponse(
        "resolveTemplateSchedules",
        "church_time_zone_missing",
        "Church Time Zone is required before Template schedules can resolve.",
      );
    }

    const model = yield* Effect.promise(() => readTemplateModel(ctx, args.churchId)).pipe(
      Effect.orDie,
    );
    const resolvedSchedules = yield* Effect.tryPromise(() =>
      resolveTemplateTaskSchedules(ctx, {
        churchId: args.churchId,
        churchTimeZone: church.churchTimeZone!,
      }),
    ).pipe(Effect.catchAll(() => Effect.succeed(null)));

    if (!resolvedSchedules) {
      return templateErrorResponse(
        "resolveTemplateSchedules",
        "invalid_template",
        "A Template Scheduling Rule could not resolve to one Due Date.",
      );
    }

    return templateResponse(
      "resolveTemplateSchedules",
      serializeTemplateModel(model, resolvedSchedules),
    );
  }),
);

const templatesSetCycleAdjustments = FunctionImpl.make(
  api,
  "templates",
  "setCycleAdjustments",
  (args) =>
    Effect.gen(function* () {
      const ctx = yield* MutationCtx.MutationCtx<DataModel>();
      const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
        Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
      );

      if (auth.status === "notAuthenticated") {
        return templateErrorResponse(
          "setCycleAdjustments",
          "not_authenticated",
          "Authentication is required.",
        );
      }
      if (auth.status === "notChurchMember") {
        return templateErrorResponse(
          "setCycleAdjustments",
          "not_church_member",
          "Church membership is required.",
        );
      }
      if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
        return templateErrorResponse(
          "setCycleAdjustments",
          "not_authorized",
          "Only Church owners and admins can manage Cycle Adjustments.",
        );
      }

      const updated = yield* Effect.promise(() => setCycleAdjustments(ctx, args)).pipe(
        Effect.orDie,
      );
      if (!updated.ok && updated.code === "cycleNotFound") {
        return templateErrorResponse(
          "setCycleAdjustments",
          "cycle_not_found",
          "Cycle was not found in the active Church.",
        );
      }
      if (!updated.ok && updated.code === "templateTaskNotFound") {
        return templateErrorResponse(
          "setCycleAdjustments",
          "template_task_not_found",
          "Template Task was not found in the active Church.",
        );
      }
      if (!updated.ok) {
        return templateErrorResponse(
          "setCycleAdjustments",
          "invalid_cycle_adjustment",
          "Cycle Adjustment overrides must be valid.",
        );
      }

      const model = yield* Effect.promise(() => readTemplateModel(ctx, args.churchId)).pipe(
        Effect.orDie,
      );

      return templateResponse("setCycleAdjustments", serializeTemplateModel(model));
    }),
);

const templatesPreviewCycleAdjustmentMerge = FunctionImpl.make(
  api,
  "templates",
  "previewCycleAdjustmentMerge",
  (args) =>
    Effect.gen(function* () {
      const ctx = yield* QueryCtx.QueryCtx<DataModel>();
      const auth = yield* getAuthenticatedChurchMember(args.churchId);

      if (auth.status === "notAuthenticated") {
        return templateErrorResponse(
          "previewCycleAdjustmentMerge",
          "not_authenticated",
          "Authentication is required.",
        );
      }
      if (auth.status === "notChurchMember") {
        return templateErrorResponse(
          "previewCycleAdjustmentMerge",
          "not_church_member",
          "Church membership is required.",
        );
      }

      const preview = yield* Effect.promise(() => previewCycleAdjustmentMerge(ctx, args)).pipe(
        Effect.orDie,
      );
      if (!preview.ok && preview.code === "cycleNotFound") {
        return templateErrorResponse(
          "previewCycleAdjustmentMerge",
          "cycle_not_found",
          "Cycle was not found in the active Church.",
        );
      }
      if (!preview.ok) {
        return templateErrorResponse(
          "previewCycleAdjustmentMerge",
          "template_task_not_found",
          "Template Task was not found in the active Church.",
        );
      }

      const model = yield* Effect.promise(() => readTemplateModel(ctx, args.churchId)).pipe(
        Effect.orDie,
      );

      return templateResponse(
        "previewCycleAdjustmentMerge",
        serializeTemplateModel(model, [], preview.mergedProjectedTasks),
      );
    }),
);

const templatesMaterializeProjectedTasks = FunctionImpl.make(
  api,
  "templates",
  "materializeProjectedTasks",
  (args) =>
    Effect.gen(function* () {
      const ctx = yield* MutationCtx.MutationCtx<DataModel>();
      const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
        Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
      );

      if (auth.status === "notAuthenticated") {
        return templateErrorResponse(
          "materializeProjectedTasks",
          "not_authenticated",
          "Authentication is required.",
        );
      }
      if (auth.status === "notChurchMember") {
        return templateErrorResponse(
          "materializeProjectedTasks",
          "not_church_member",
          "Church membership is required.",
        );
      }
      if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
        return templateErrorResponse(
          "materializeProjectedTasks",
          "not_authorized",
          "Only Church owners and admins can materialize Template work.",
        );
      }

      const church = yield* findBetterAuthDoc<BetterAuthOrganization>({
        model: "organization",
        where: [{ field: "_id", value: args.churchId }],
      }).pipe(Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx));

      if (!church?.churchTimeZone) {
        return templateErrorResponse(
          "materializeProjectedTasks",
          "church_time_zone_missing",
          "Church Time Zone is required before Template Tasks can materialize.",
        );
      }

      const materialized = yield* Effect.tryPromise(() =>
        materializeProjectedTasks(ctx, {
          ...args,
          churchTimeZone: church.churchTimeZone!,
        }),
      ).pipe(
        Effect.catchAll(() =>
          Effect.succeed({ ok: false as const, code: "invalidTemplate" as const }),
        ),
      );

      if (!materialized.ok && materialized.code === "workflowStatusNotFound") {
        return templateErrorResponse(
          "materializeProjectedTasks",
          "workflow_status_not_found",
          "A default To Do Workflow Status is required before Template Tasks can materialize.",
        );
      }
      if (!materialized.ok && materialized.code === "teamNotFound") {
        return templateErrorResponse(
          "materializeProjectedTasks",
          "team_not_found",
          "A Team is required before Template Tasks can materialize.",
        );
      }
      if (!materialized.ok && materialized.code === "templateTaskNotFound") {
        return templateErrorResponse(
          "materializeProjectedTasks",
          "template_task_not_found",
          "Template Task was not found in the active Church.",
        );
      }
      if (!materialized.ok) {
        return templateErrorResponse(
          "materializeProjectedTasks",
          "invalid_template",
          "A Template Scheduling Rule could not materialize.",
        );
      }

      const occurredAt = new Date().toISOString();
      for (const taskId of materialized.createdTaskIds) {
        const task = yield* Effect.promise(() => ctx.db.get(taskId)).pipe(Effect.orDie);
        if (!task) continue;
        yield* Effect.promise(() =>
          writeActivity(ctx, {
            churchId: args.churchId,
            entityType: "task",
            entityId: task._id,
            eventType: "task.created",
            actorType: "system",
            actorId: null,
            occurredAt,
            cycleId: task.cycleId,
            metadata: { parentTaskId: task.parentTaskId },
          }),
        ).pipe(Effect.orDie);
      }

      const model = yield* Effect.promise(() => readTemplateModel(ctx, args.churchId)).pipe(
        Effect.orDie,
      );

      return templateResponse("materializeProjectedTasks", serializeTemplateModel(model));
    }),
);

const templatesUpdateTemplateTasks = FunctionImpl.make(
  api,
  "templates",
  "updateTemplateTasks",
  (args) =>
    Effect.gen(function* () {
      const ctx = yield* MutationCtx.MutationCtx<DataModel>();
      const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
        Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
      );

      if (auth.status === "notAuthenticated") {
        return templateErrorResponse(
          "updateTemplateTasks",
          "not_authenticated",
          "Authentication is required.",
        );
      }
      if (auth.status === "notChurchMember") {
        return templateErrorResponse(
          "updateTemplateTasks",
          "not_church_member",
          "Church membership is required.",
        );
      }
      if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
        return templateErrorResponse(
          "updateTemplateTasks",
          "not_authorized",
          "Only Church owners and admins can update Templates.",
        );
      }

      const church = yield* findBetterAuthDoc<BetterAuthOrganization>({
        model: "organization",
        where: [{ field: "_id", value: args.churchId }],
      }).pipe(Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx));

      if (!church?.churchTimeZone) {
        return templateErrorResponse(
          "updateTemplateTasks",
          "church_time_zone_missing",
          "Church Time Zone is required before Template Tasks can sync.",
        );
      }

      const updated = yield* Effect.tryPromise(() =>
        updateTemplateTasksAndSyncFutureProjectedTasks(ctx, {
          ...args,
          churchTimeZone: church.churchTimeZone!,
          actorId: auth.authUser._id,
        }),
      ).pipe(
        Effect.catchAll(() =>
          Effect.succeed({ ok: false as const, code: "invalidTemplate" as const }),
        ),
      );

      if (!updated.ok && updated.code === "templateTaskNotFound") {
        return templateErrorResponse(
          "updateTemplateTasks",
          "template_task_not_found",
          "Template Task was not found in the active Church.",
        );
      }
      if (!updated.ok && updated.code === "templateNotFound") {
        return templateErrorResponse(
          "updateTemplateTasks",
          "template_not_found",
          "Template was not found in the active Church.",
        );
      }
      if (!updated.ok) {
        return templateErrorResponse(
          "updateTemplateTasks",
          "invalid_template",
          "Template Task updates and Scheduling Rules must be valid.",
        );
      }

      const model = yield* Effect.promise(() => readTemplateModel(ctx, args.churchId)).pipe(
        Effect.orDie,
      );

      return templateResponse("updateTemplateTasks", serializeTemplateModel(model));
    }),
);

const workflowsRenameForChurch = FunctionImpl.make(api, "workflows", "renameForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return workflowErrorResponse(
        "renameWorkflow",
        "not_authenticated",
        "Authentication is required.",
      );
    }
    if (auth.status === "notChurchMember") {
      return workflowErrorResponse(
        "renameWorkflow",
        "not_church_member",
        "Church membership is required.",
      );
    }
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      return workflowErrorResponse(
        "renameWorkflow",
        "not_authorized",
        "Only Church owners and admins can manage Workflows.",
      );
    }

    const renamed = yield* Effect.promise(() => renameWorkflow(ctx, args)).pipe(Effect.orDie);
    if (!renamed.ok) {
      return workflowErrorResponse(
        "renameWorkflow",
        "workflow_not_found",
        "Workflow was not found in the active Church.",
      );
    }

    yield* Effect.promise(() =>
      writeActivity(ctx, {
        churchId: args.churchId,
        entityType: "workflow",
        entityId: args.workflowId,
        eventType: "workflow.renamed",
        actorType: "user",
        actorId: auth.authUser._id,
        occurredAt: new Date().toISOString(),
        cycleId: null,
        metadata: { previousName: renamed.workflow.name, name: args.name },
      }),
    ).pipe(Effect.orDie);

    const model = yield* Effect.promise(() => readWorkflowModel(ctx, args.churchId)).pipe(
      Effect.orDie,
    );
    return workflowResponse("renameWorkflow", serializeWorkflowModel(model));
  }),
);

const workflowsReorderForChurch = FunctionImpl.make(api, "workflows", "reorderForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return workflowErrorResponse(
        "reorderWorkflows",
        "not_authenticated",
        "Authentication is required.",
      );
    }
    if (auth.status === "notChurchMember") {
      return workflowErrorResponse(
        "reorderWorkflows",
        "not_church_member",
        "Church membership is required.",
      );
    }
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      return workflowErrorResponse(
        "reorderWorkflows",
        "not_authorized",
        "Only Church owners and admins can manage Workflows.",
      );
    }

    const reordered = yield* Effect.promise(() => reorderWorkflows(ctx, args)).pipe(Effect.orDie);
    if (!reordered.ok) {
      return workflowErrorResponse(
        "reorderWorkflows",
        "invalid_workflow_reorder",
        "Workflow reorder must include active Workflows from the requested Church only.",
      );
    }

    const occurredAt = new Date().toISOString();
    for (const [sortOrder, workflowId] of args.workflowIds.entries()) {
      const workflow = reordered.workflowsById.get(workflowId);
      if (workflow && workflow.sortOrder !== sortOrder) {
        yield* Effect.promise(() =>
          writeActivity(ctx, {
            churchId: args.churchId,
            entityType: "workflow",
            entityId: workflowId,
            eventType: "workflow.reordered",
            actorType: "user",
            actorId: auth.authUser._id,
            occurredAt,
            cycleId: null,
            metadata: { previousSortOrder: workflow.sortOrder, sortOrder },
          }),
        ).pipe(Effect.orDie);
      }
    }

    const model = yield* Effect.promise(() => readWorkflowModel(ctx, args.churchId)).pipe(
      Effect.orDie,
    );
    return workflowResponse("reorderWorkflows", serializeWorkflowModel(model));
  }),
);

const workflowsArchiveForChurch = FunctionImpl.make(api, "workflows", "archiveForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return workflowErrorResponse(
        "archiveWorkflow",
        "not_authenticated",
        "Authentication is required.",
      );
    }
    if (auth.status === "notChurchMember") {
      return workflowErrorResponse(
        "archiveWorkflow",
        "not_church_member",
        "Church membership is required.",
      );
    }
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      return workflowErrorResponse(
        "archiveWorkflow",
        "not_authorized",
        "Only Church owners and admins can manage Workflows.",
      );
    }

    const archivedAt = new Date().toISOString();
    const archived = yield* Effect.promise(() =>
      archiveWorkflow(ctx, { churchId: args.churchId, workflowId: args.workflowId, archivedAt }),
    ).pipe(Effect.orDie);
    if (!archived.ok && archived.code === "notFound") {
      return workflowErrorResponse(
        "archiveWorkflow",
        "workflow_not_found",
        "Workflow was not found in the active Church.",
      );
    }
    if (!archived.ok && archived.code === "inUse") {
      return workflowErrorResponse(
        "archiveWorkflow",
        "workflow_in_use",
        "Workflows owned by an active Team or referenced by Tasks cannot be archived.",
      );
    }
    if (!archived.ok) return yield* Effect.dieMessage("Unexpected Workflow archive result.");

    yield* Effect.promise(() =>
      writeActivity(ctx, {
        churchId: args.churchId,
        entityType: "workflow",
        entityId: args.workflowId,
        eventType: "workflow.archived",
        actorType: "user",
        actorId: auth.authUser._id,
        occurredAt: archivedAt,
        cycleId: null,
        metadata: { name: archived.workflow.name },
      }),
    ).pipe(Effect.orDie);

    const model = yield* Effect.promise(() => readWorkflowModel(ctx, args.churchId)).pipe(
      Effect.orDie,
    );
    return workflowResponse("archiveWorkflow", serializeWorkflowModel(model));
  }),
);

const workflowsAddStatus = FunctionImpl.make(api, "workflows", "addStatus", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return workflowErrorResponse(
        "addWorkflowStatus",
        "not_authenticated",
        "Authentication is required.",
      );
    }
    if (auth.status === "notChurchMember") {
      return workflowErrorResponse(
        "addWorkflowStatus",
        "not_church_member",
        "Church membership is required.",
      );
    }
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      return workflowErrorResponse(
        "addWorkflowStatus",
        "not_authorized",
        "Only Church owners and admins can manage Workflows.",
      );
    }

    const added = yield* Effect.promise(() => addWorkflowStatus(ctx, args)).pipe(Effect.orDie);
    if (!added.ok && added.code === "workflowNotFound") {
      return workflowErrorResponse(
        "addWorkflowStatus",
        "workflow_not_found",
        "Workflow was not found in the active Church.",
      );
    }
    if (!added.ok && added.code === "invalidWorkflow") {
      return workflowErrorResponse(
        "addWorkflowStatus",
        "invalid_workflow",
        added.message ?? "Workflow Status changes must keep the Workflow valid.",
      );
    }
    if (!added.ok) return yield* Effect.dieMessage("Unexpected Workflow Status add result.");

    yield* Effect.promise(() =>
      writeActivity(ctx, {
        churchId: args.churchId,
        entityType: "workflow",
        entityId: added.statusId,
        eventType: "workflow.status.created",
        actorType: "user",
        actorId: auth.authUser._id,
        occurredAt: new Date().toISOString(),
        cycleId: null,
        metadata: {
          workflowId: args.workflowId,
          name: args.status.name,
          taskState: args.status.taskState,
        },
      }),
    ).pipe(Effect.orDie);

    const model = yield* Effect.promise(() => readWorkflowModel(ctx, args.churchId)).pipe(
      Effect.orDie,
    );
    return workflowResponse("addWorkflowStatus", serializeWorkflowModel(model));
  }),
);

const workflowsRenameStatus = FunctionImpl.make(api, "workflows", "renameStatus", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return workflowErrorResponse(
        "renameWorkflowStatus",
        "not_authenticated",
        "Authentication is required.",
      );
    }
    if (auth.status === "notChurchMember") {
      return workflowErrorResponse(
        "renameWorkflowStatus",
        "not_church_member",
        "Church membership is required.",
      );
    }
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      return workflowErrorResponse(
        "renameWorkflowStatus",
        "not_authorized",
        "Only Church owners and admins can manage Workflows.",
      );
    }

    const renamed = yield* Effect.promise(() => renameWorkflowStatus(ctx, args)).pipe(Effect.orDie);
    if (!renamed.ok && renamed.code === "notFound") {
      return workflowErrorResponse(
        "renameWorkflowStatus",
        "workflow_status_not_found",
        "Workflow Status was not found in the active Church.",
      );
    }
    if (!renamed.ok && renamed.code === "invalidWorkflow") {
      return workflowErrorResponse(
        "renameWorkflowStatus",
        "invalid_workflow",
        renamed.message ?? "Workflow Status changes must keep the Workflow valid.",
      );
    }
    if (!renamed.ok) return yield* Effect.dieMessage("Unexpected Workflow Status rename result.");

    yield* Effect.promise(() =>
      writeActivity(ctx, {
        churchId: args.churchId,
        entityType: "workflow",
        entityId: renamed.status._id,
        eventType: "workflow.status.renamed",
        actorType: "user",
        actorId: auth.authUser._id,
        occurredAt: new Date().toISOString(),
        cycleId: null,
        metadata: {
          workflowId: renamed.status.workflowId,
          previousName: renamed.status.name,
          name: args.name,
        },
      }),
    ).pipe(Effect.orDie);

    const model = yield* Effect.promise(() => readWorkflowModel(ctx, args.churchId)).pipe(
      Effect.orDie,
    );
    return workflowResponse("renameWorkflowStatus", serializeWorkflowModel(model));
  }),
);

const workflowsReorderStatuses = FunctionImpl.make(api, "workflows", "reorderStatuses", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return workflowErrorResponse(
        "reorderWorkflowStatuses",
        "not_authenticated",
        "Authentication is required.",
      );
    }
    if (auth.status === "notChurchMember") {
      return workflowErrorResponse(
        "reorderWorkflowStatuses",
        "not_church_member",
        "Church membership is required.",
      );
    }
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      return workflowErrorResponse(
        "reorderWorkflowStatuses",
        "not_authorized",
        "Only Church owners and admins can manage Workflows.",
      );
    }

    const reordered = yield* Effect.promise(() => reorderWorkflowStatuses(ctx, args)).pipe(
      Effect.orDie,
    );
    if (!reordered.ok && reordered.code === "workflowNotFound") {
      return workflowErrorResponse(
        "reorderWorkflowStatuses",
        "workflow_not_found",
        "Workflow was not found in the active Church.",
      );
    }
    if (!reordered.ok && reordered.code === "invalidReorder") {
      return workflowErrorResponse(
        "reorderWorkflowStatuses",
        "invalid_workflow_status_reorder",
        "Workflow Status reorder must include active statuses from the requested Workflow only.",
      );
    }
    if (!reordered.ok) {
      return yield* Effect.dieMessage("Unexpected Workflow Status reorder result.");
    }

    const occurredAt = new Date().toISOString();
    for (const [sortOrder, statusId] of args.statusIds.entries()) {
      const status = reordered.statusesById.get(statusId);
      if (status && status.sortOrder !== sortOrder) {
        yield* Effect.promise(() =>
          writeActivity(ctx, {
            churchId: args.churchId,
            entityType: "workflow",
            entityId: statusId,
            eventType: "workflow.status.reordered",
            actorType: "user",
            actorId: auth.authUser._id,
            occurredAt,
            cycleId: null,
            metadata: {
              workflowId: args.workflowId,
              previousSortOrder: status.sortOrder,
              sortOrder,
            },
          }),
        ).pipe(Effect.orDie);
      }
    }

    const model = yield* Effect.promise(() => readWorkflowModel(ctx, args.churchId)).pipe(
      Effect.orDie,
    );
    return workflowResponse("reorderWorkflowStatuses", serializeWorkflowModel(model));
  }),
);

const workflowsArchiveStatus = FunctionImpl.make(api, "workflows", "archiveStatus", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return workflowErrorResponse(
        "archiveWorkflowStatus",
        "not_authenticated",
        "Authentication is required.",
      );
    }
    if (auth.status === "notChurchMember") {
      return workflowErrorResponse(
        "archiveWorkflowStatus",
        "not_church_member",
        "Church membership is required.",
      );
    }
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      return workflowErrorResponse(
        "archiveWorkflowStatus",
        "not_authorized",
        "Only Church owners and admins can manage Workflows.",
      );
    }

    const archived = yield* Effect.promise(() => archiveWorkflowStatus(ctx, args)).pipe(
      Effect.orDie,
    );

    if (!archived.ok && archived.code === "notFound") {
      return workflowErrorResponse(
        "archiveWorkflowStatus",
        "workflow_status_not_found",
        "Workflow Status was not found in the active Church.",
      );
    }
    if (!archived.ok && archived.code === "inUse") {
      return workflowErrorResponse(
        "archiveWorkflowStatus",
        "workflow_status_in_use",
        "Workflow Statuses with active Tasks cannot be archived before Tasks are moved.",
      );
    }
    if (!archived.ok && archived.code === "invalidWorkflow") {
      return workflowErrorResponse(
        "archiveWorkflowStatus",
        "invalid_workflow",
        archived.message ?? "Archiving this Workflow Status would make the Workflow invalid.",
      );
    }
    if (!archived.ok) {
      return yield* Effect.dieMessage("Unexpected Workflow Status archive result.");
    }

    yield* Effect.promise(() =>
      writeActivity(ctx, {
        churchId: args.churchId,
        entityType: "workflow",
        entityId: archived.status._id,
        eventType: "workflow.status.archived",
        actorType: "user",
        actorId: auth.authUser._id,
        occurredAt: args.archivedAt,
        cycleId: null,
        metadata: {
          workflowId: archived.status.workflowId,
          name: archived.status.name,
          taskState: archived.status.taskState,
        },
      }),
    ).pipe(Effect.orDie);

    const model = yield* Effect.promise(() => readWorkflowModel(ctx, args.churchId)).pipe(
      Effect.orDie,
    );

    return workflowResponse("archiveWorkflowStatus", serializeWorkflowModel(model));
  }),
);

const workflowsRemapTaskTeam = FunctionImpl.make(api, "workflows", "remapTaskTeam", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return workflowErrorResponse(
        "remapTaskTeamWorkflow",
        "not_authenticated",
        "Authentication is required.",
      );
    }
    if (auth.status === "notChurchMember") {
      return workflowErrorResponse(
        "remapTaskTeamWorkflow",
        "not_church_member",
        "Church membership is required.",
      );
    }

    const destinationTeam = (yield* Effect.promise(() =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "team",
        where: [
          { field: "_id", value: args.destinationTeamId },
          { field: "organizationId", value: args.churchId },
        ],
      }),
    ).pipe(Effect.orDie)) as BetterAuthTeam | null;

    if (!destinationTeam) {
      return workflowErrorResponse(
        "remapTaskTeamWorkflow",
        "team_not_found",
        "Destination Team was not found in the active Church.",
      );
    }

    // Every Team owns its Workflow (ADR 0013); there is no Church default
    // Workflow to fall back to.
    const destinationWorkflow = yield* Effect.promise(() =>
      getTeamWorkflow(ctx, { churchId: args.churchId, teamId: args.destinationTeamId }),
    ).pipe(Effect.orDie);

    if (!destinationWorkflow) {
      return workflowErrorResponse(
        "remapTaskTeamWorkflow",
        "team_workflow_not_configured",
        "The destination Team's Workflow is missing.",
      );
    }
    const destinationWorkflowId = destinationWorkflow._id;

    const remapped = yield* Effect.promise(() =>
      remapWorkflowStatusForTaskTeam(ctx, {
        churchId: args.churchId,
        taskId: args.taskId,
        destinationTeamId: args.destinationTeamId,
        destinationWorkflowId,
      }),
    ).pipe(Effect.orDie);

    if (!remapped.ok && remapped.code === "taskNotFound") {
      return workflowErrorResponse(
        "remapTaskTeamWorkflow",
        "task_not_found",
        "Task was not found in the active Church.",
      );
    }
    if (!remapped.ok && remapped.code === "workflowNotFound") {
      return workflowErrorResponse(
        "remapTaskTeamWorkflow",
        "workflow_not_found",
        "Destination Workflow was not found in the active Church.",
      );
    }
    if (!remapped.ok && remapped.code === "remapFailed") {
      return workflowErrorResponse(
        "remapTaskTeamWorkflow",
        "workflow_status_remap_failed",
        "Destination Workflow cannot preserve the Task State.",
      );
    }
    if (!remapped.ok) {
      return yield* Effect.dieMessage("Unexpected Workflow Status remap result.");
    }

    yield* Effect.promise(() =>
      writeActivity(ctx, {
        churchId: args.churchId,
        entityType: "task",
        entityId: args.taskId,
        eventType: "task.team.changed",
        actorType: "user",
        actorId: auth.authUser._id,
        occurredAt: new Date().toISOString(),
        cycleId: null,
        metadata: {
          fromTeamId: remapped.task.teamId,
          toTeamId: args.destinationTeamId,
          fromWorkflowId: remapped.task.workflowId,
          toWorkflowId: destinationWorkflowId,
          previousWorkflowStatusId: remapped.currentStatus._id,
          restoredWorkflowStatusId: remapped.destinationStatus._id,
        },
      }),
    ).pipe(Effect.orDie);

    const model = yield* Effect.promise(() => readWorkflowModel(ctx, args.churchId)).pipe(
      Effect.orDie,
    );

    return workflowResponse("remapTaskTeamWorkflow", serializeWorkflowModel(model));
  }),
);

export const healthCheck = GroupImpl.make(api, "healthCheck").pipe(Layer.provide(healthCheckGet));

export const privateData = GroupImpl.make(api, "privateData").pipe(Layer.provide(privateDataGet));
export const auth = GroupImpl.make(api, "auth").pipe(Layer.provide(authGetCurrentUser));
export const cycleMaintenance = GroupImpl.make(api, "cycleMaintenance").pipe(
  Layer.provide(cycleMaintenanceRunForChurch),
);
export const agent = GroupImpl.make(api, "agent").pipe(
  Layer.provide(agentCurrentUser),
  Layer.provide(agentBatchRead),
  Layer.provide(agentActiveChurch),
);
export const churchSettings = GroupImpl.make(api, "churchSettings").pipe(
  Layer.provide(churchSettingsReadForChurch),
  Layer.provide(churchSettingsUpdateTimeZone),
);
export const coreWork = GroupImpl.make(api, "coreWork").pipe(
  Layer.provide(coreWorkBatchRead),
  Layer.provide(coreWorkBatchWrite),
);
export const workDefaults = GroupImpl.make(api, "workDefaults").pipe(
  Layer.provide(workDefaultsSeedForChurch),
  Layer.provide(workDefaultsReadForChurch),
);
export const keyDates = GroupImpl.make(api, "keyDates").pipe(
  Layer.provide(keyDatesCreateForChurch),
  Layer.provide(keyDatesCreateOccurrences),
  Layer.provide(keyDatesListForChurch),
  Layer.provide(keyDatesResolveOccurrences),
);
export const activities = GroupImpl.make(api, "activities").pipe(
  Layer.provide(activitiesRecordForChurch),
  Layer.provide(activitiesListForEntity),
);
export const labels = GroupImpl.make(api, "labels").pipe(
  Layer.provide(labelsListForChurch),
  Layer.provide(labelsCreateForChurch),
  Layer.provide(labelsUpdateForChurch),
  Layer.provide(labelsDeleteForChurch),
);
export const teams = GroupImpl.make(api, "teams").pipe(
  Layer.provide(teamListForChurch),
  Layer.provide(teamListMembershipsForChurch),
  Layer.provide(teamCreateForChurch),
  Layer.provide(teamRenameForChurch),
  Layer.provide(teamSetIdentifierForChurch),
  Layer.provide(teamArchiveForChurch),
  Layer.provide(teamDeleteForChurch),
  Layer.provide(teamReorderForChurch),
  Layer.provide(teamAddMemberForChurch),
  Layer.provide(teamRemoveMemberForChurch),
  Layer.provide(teamUpdateProductFields),
);
export const tasks = GroupImpl.make(api, "tasks").pipe(
  Layer.provide(tasksCreateBatch),
  Layer.provide(tasksUpdateBatch),
  Layer.provide(tasksCompleteBatch),
  Layer.provide(tasksCancelBatch),
  Layer.provide(tasksReopenBatch),
  Layer.provide(tasksListForChurch),
  Layer.provide(tasksResolveByIdentifier),
);
export const templates = GroupImpl.make(api, "templates").pipe(
  Layer.provide(templatesCreateForChurch),
  Layer.provide(templatesResolveSchedules),
  Layer.provide(templatesSetCycleAdjustments),
  Layer.provide(templatesPreviewCycleAdjustmentMerge),
  Layer.provide(templatesMaterializeProjectedTasks),
  Layer.provide(templatesUpdateTemplateTasks),
);
export const workflows = GroupImpl.make(api, "workflows").pipe(
  Layer.provide(workflowsRenameForChurch),
  Layer.provide(workflowsReorderForChurch),
  Layer.provide(workflowsArchiveForChurch),
  Layer.provide(workflowsAddStatus),
  Layer.provide(workflowsRenameStatus),
  Layer.provide(workflowsReorderStatuses),
  Layer.provide(workflowsArchiveStatus),
  Layer.provide(workflowsRemapTaskTeam),
);
