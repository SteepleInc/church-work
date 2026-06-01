import { FunctionImpl, GroupImpl, QueryCtx } from "@confect/server";
import { Effect, Layer } from "effect";

import {
  activeChurchResponse,
  batchReadResponse,
  currentUserResponse,
  noActiveChurchResponse,
  notChurchMemberResponse,
} from "../agent/operations";
import { authComponent } from "../authCore";
import { components } from "../convex/_generated/api";
import type { DataModel } from "../convex/_generated/dataModel";
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

type BetterAuthModel = "member" | "organization" | "session";
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

export const healthCheck = GroupImpl.make(api, "healthCheck").pipe(Layer.provide(healthCheckGet));

export const privateData = GroupImpl.make(api, "privateData").pipe(Layer.provide(privateDataGet));
export const auth = GroupImpl.make(api, "auth").pipe(Layer.provide(authGetCurrentUser));
export const agent = GroupImpl.make(api, "agent").pipe(
  Layer.provide(agentCurrentUser),
  Layer.provide(agentBatchRead),
  Layer.provide(agentActiveChurch),
);
