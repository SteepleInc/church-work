import { FunctionImpl, GroupImpl, MutationCtx, QueryCtx } from "@confect/server";
import { Effect, Layer } from "effect";

import {
  invalidActivityMetadataResponse,
  listActivitiesForEntityResponse,
  recordActivityResponse,
} from "../agent/activityOperations";
import {
  activeChurchResponse,
  batchReadResponse,
  currentUserResponse,
  noActiveChurchResponse,
  notChurchMemberResponse,
} from "../agent/operations";
import { teamErrorResponse, teamsResponse } from "../agent/teamOperations";
import { workDefaultsResponse } from "../agent/workDefaultsOperations";
import { workflowErrorResponse, workflowResponse } from "../agent/workflowOperations";
import { listActivitiesForEntity, serializeActivity, writeActivity } from "../activityRegistry";
import { authComponent } from "../authCore";
import { components } from "../convex/_generated/api";
import type { DataModel } from "../convex/_generated/dataModel";
import { readDefaultWorkModel, seedDefaultWorkModel } from "../workDefaults";
import {
  archiveWorkflowStatus,
  createWorkflow,
  readWorkflowModel,
  remapWorkflowStatusForTaskTeam,
} from "../workflows";
import api from "./_generated/api";

type BetterAuthSession = {
  readonly activeOrganizationId?: string | null;
};

type BetterAuthMember = {
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
  readonly defaultWorkflowId?: string | null;
};

type BetterAuthModel = "member" | "organization" | "session" | "team";
type BetterAuthWhere = {
  field: string;
  operator?: "eq" | "gt";
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

const serializeTeam = (team: BetterAuthTeam) => ({
  id: team._id,
  name: team.name,
  churchId: team.organizationId,
  archivedAt: team.archivedAt ?? null,
  sortOrder: team.sortOrder ?? 0,
  defaultWorkflowId: team.defaultWorkflowId ?? null,
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

    return { status: "ready" as const, membership };
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
    key: workflow.key,
    name: workflow.name,
    isDefault: workflow.isDefault,
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
});

const serializeWorkflowModel = (data: Awaited<ReturnType<typeof readWorkflowModel>>) => ({
  workflows: data.workflows.map((workflow) => ({
    id: workflow._id,
    key: workflow.key,
    name: workflow.name,
    isDefault: workflow.isDefault,
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
  tasks: data.tasks.map((task) => ({
    id: task._id,
    churchId: task.churchId,
    title: task.title,
    teamId: task.teamId,
    workflowId: task.workflowId,
    workflowStatusId: task.workflowStatusId,
    taskState: task.taskState,
  })),
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

    const teams = yield* listTeamsForChurch(args.churchId);

    return teamsResponse("listTeams", teams.map(serializeTeam));
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
      const team = yield* Effect.promise(() =>
        ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: "team",
          where: [
            { field: "_id", value: update.teamId },
            { field: "organizationId", value: args.churchId },
          ],
        }),
      ).pipe(Effect.orDie);

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

const workflowsCreateForChurch = FunctionImpl.make(api, "workflows", "createForChurch", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx.MutationCtx<DataModel>();
    const auth = yield* getAuthenticatedChurchMember(args.churchId).pipe(
      Effect.provideService(QueryCtx.QueryCtx<DataModel>(), ctx),
    );

    if (auth.status === "notAuthenticated") {
      return workflowErrorResponse(
        "createWorkflow",
        "not_authenticated",
        "Authentication is required.",
      );
    }
    if (auth.status === "notChurchMember") {
      return workflowErrorResponse(
        "createWorkflow",
        "not_church_member",
        "Church membership is required.",
      );
    }
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      return workflowErrorResponse(
        "createWorkflow",
        "not_authorized",
        "Only Church owners and admins can manage Workflows.",
      );
    }

    const created = yield* Effect.promise(() => createWorkflow(ctx, args)).pipe(Effect.orDie);

    if (!created.ok) {
      return workflowErrorResponse("createWorkflow", "invalid_workflow", created.error);
    }

    const occurredAt = new Date().toISOString();
    yield* Effect.promise(() =>
      writeActivity(ctx, {
        churchId: args.churchId,
        entityType: "workflow",
        entityId: created.workflowId,
        eventType: "workflow.created",
        actorType: "user",
        actorId: null,
        occurredAt,
        cycleId: null,
        metadata: { name: args.name, isDefault: args.isDefault },
      }),
    ).pipe(Effect.orDie);

    const model = yield* Effect.promise(() => readWorkflowModel(ctx, args.churchId)).pipe(
      Effect.orDie,
    );
    for (const status of model.workflowStatuses.filter(
      (candidate) => candidate.workflowId === created.workflowId,
    )) {
      yield* Effect.promise(() =>
        writeActivity(ctx, {
          churchId: args.churchId,
          entityType: "workflow",
          entityId: status._id,
          eventType: "workflow.status.created",
          actorType: "user",
          actorId: null,
          occurredAt,
          cycleId: null,
          metadata: {
            workflowId: created.workflowId,
            name: status.name,
            taskState: status.taskState,
          },
        }),
      ).pipe(Effect.orDie);
    }

    return workflowResponse("createWorkflow", serializeWorkflowModel(model));
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
        actorId: null,
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
    if (!destinationTeam.defaultWorkflowId) {
      return workflowErrorResponse(
        "remapTaskTeamWorkflow",
        "team_workflow_not_configured",
        "Destination Team does not have a default Workflow.",
      );
    }

    const remapped = yield* Effect.promise(() =>
      remapWorkflowStatusForTaskTeam(ctx, {
        churchId: args.churchId,
        taskId: args.taskId,
        destinationTeamId: args.destinationTeamId,
        destinationWorkflowId: destinationTeam.defaultWorkflowId!,
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
        actorId: null,
        occurredAt: new Date().toISOString(),
        cycleId: null,
        metadata: {
          fromTeamId: remapped.task.teamId,
          toTeamId: args.destinationTeamId,
          fromWorkflowId: remapped.task.workflowId,
          toWorkflowId: destinationTeam.defaultWorkflowId,
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
export const agent = GroupImpl.make(api, "agent").pipe(
  Layer.provide(agentCurrentUser),
  Layer.provide(agentBatchRead),
  Layer.provide(agentActiveChurch),
);
export const workDefaults = GroupImpl.make(api, "workDefaults").pipe(
  Layer.provide(workDefaultsSeedForChurch),
  Layer.provide(workDefaultsReadForChurch),
);
export const activities = GroupImpl.make(api, "activities").pipe(
  Layer.provide(activitiesRecordForChurch),
  Layer.provide(activitiesListForEntity),
);
export const teams = GroupImpl.make(api, "teams").pipe(
  Layer.provide(teamListForChurch),
  Layer.provide(teamUpdateProductFields),
);
export const workflows = GroupImpl.make(api, "workflows").pipe(
  Layer.provide(workflowsCreateForChurch),
  Layer.provide(workflowsArchiveStatus),
  Layer.provide(workflowsRemapTaskTeam),
);
