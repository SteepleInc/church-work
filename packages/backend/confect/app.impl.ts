import { FunctionImpl, GroupImpl, QueryCtx } from "@confect/server";
import { Effect, Layer } from "effect";

import { authComponent } from "../authCore";
import type { DataModel } from "../convex/_generated/dataModel";
import api from "./_generated/api";

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

export const healthCheck = GroupImpl.make(api, "healthCheck").pipe(Layer.provide(healthCheckGet));

export const privateData = GroupImpl.make(api, "privateData").pipe(Layer.provide(privateDataGet));
export const auth = GroupImpl.make(api, "auth").pipe(Layer.provide(authGetCurrentUser));
