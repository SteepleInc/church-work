/// <reference types="vite/client" />

import { Ref } from "@confect/core";
import { RegisteredConvexFunction } from "@confect/server";
import { TestConfect as TestConfect_ } from "@confect/test";
import { convexTest } from "convex-test";
import { Effect, Layer, Schema } from "effect";

import confectSchema from "../confect/schema";
import betterAuthSchema from "../convex/betterAuth/schema";

process.env.SITE_URL ??= "http://localhost:2101";
process.env.CONVEX_SITE_URL ??= "http://127.0.0.1:3210";

export const TestConfect = TestConfect_.TestConfect<typeof confectSchema>();

const modules = import.meta.glob("../convex/**/!(*.*.*)*.*s");
const betterAuthModules = import.meta.glob("../convex/betterAuth/**/*.ts");

const makeTestConfectWithoutIdentity = (testConvex: ReturnType<typeof convexTest>) => ({
  query: (queryRef: Ref.AnyQuery, ...args: Array<unknown>) =>
    Ref.runWithCodec(queryRef, args[0] ?? {}, (functionReference, encodedArgs) =>
      testConvex.query(functionReference, encodedArgs),
    ),
  mutation: (mutationRef: Ref.AnyMutation, ...args: Array<unknown>) =>
    Ref.runWithCodec(mutationRef, args[0] ?? {}, (functionReference, encodedArgs) =>
      testConvex.mutation(functionReference, encodedArgs),
    ),
  action: (actionRef: Ref.AnyAction, ...args: Array<unknown>) =>
    Ref.runWithCodec(actionRef, args[0] ?? {}, (functionReference, encodedArgs) =>
      testConvex.action(functionReference, encodedArgs),
    ),
  run: (handler: Effect.Effect<unknown, unknown, never>, returns?: Schema.Schema<unknown>) => {
    const makeMutationLayer = (mutationCtx: unknown) =>
      RegisteredConvexFunction.mutationLayer(confectSchema, mutationCtx);

    if (returns === undefined) {
      return Effect.promise(() =>
        testConvex.run((mutationCtx) =>
          Effect.runPromise(
            handler.pipe(Effect.asVoid, Effect.provide(makeMutationLayer(mutationCtx))),
          ),
        ),
      );
    }

    return Effect.promise(() =>
      testConvex.run((mutationCtx) =>
        Effect.runPromise(
          handler.pipe(
            Effect.andThen(Schema.encode(returns)),
            Effect.provide(makeMutationLayer(mutationCtx)),
          ),
        ),
      ),
    ).pipe(Effect.andThen(Schema.decode(returns)));
  },
  fetch: (pathQueryFragment: string, init?: RequestInit) =>
    Effect.promise(() => testConvex.fetch(pathQueryFragment, init)),
  finishInProgressScheduledFunctions: () =>
    Effect.promise(() => testConvex.finishInProgressScheduledFunctions()),
  finishAllScheduledFunctions: (advanceTimers: () => void) =>
    Effect.promise(() => testConvex.finishAllScheduledFunctions(advanceTimers)),
});

export const layer = () =>
  Layer.sync(TestConfect, () => {
    const testConvex = convexTest(confectSchema.convexSchemaDefinition, modules);
    testConvex.registerComponent("betterAuth", betterAuthSchema, betterAuthModules);

    const withoutIdentity = makeTestConfectWithoutIdentity(testConvex);

    return {
      ...withoutIdentity,
      withIdentity: (userIdentity) =>
        makeTestConfectWithoutIdentity(testConvex.withIdentity(userIdentity)),
    } satisfies typeof TestConfect.Service;
  });
