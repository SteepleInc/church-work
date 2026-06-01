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
import { listActivitiesForEntity, serializeActivity, writeActivity } from "../activityRegistry";
import { authComponent } from "../authCore";
import { components } from "../convex/_generated/api";
import type { DataModel } from "../convex/_generated/dataModel";
import { readDefaultWorkModel, seedDefaultWorkModel } from "../workDefaults";
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
