import { v } from "convex/values";

import registeredFunctions from "../confect/_generated/registeredFunctions";
import { currentMaintenanceInstant, maintainCyclesForChurch } from "../cycleMaintenance";
import { components } from "./_generated/api";
import { internalMutation } from "./_generated/server";

type BetterAuthOrganization = {
  readonly _id: string;
  readonly churchTimeZone?: string | null;
};

export const runForChurch = registeredFunctions.cycleMaintenance.runForChurch;

export const internalRunForChurch = internalMutation({
  args: { churchId: v.string(), churchTimeZone: v.string(), now: v.string() },
  handler: async (ctx, args) => {
    return await maintainCyclesForChurch(ctx, args);
  },
});

export const internalRunForAllChurches = internalMutation({
  args: { now: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "organization",
      where: [],
      paginationOpts: { cursor: null, numItems: 100 },
    })) as { readonly page: ReadonlyArray<BetterAuthOrganization> };
    const now = args.now ?? currentMaintenanceInstant();
    const maintainedChurchIds: Array<string> = [];

    for (const church of result.page) {
      if (!church.churchTimeZone) continue;
      await maintainCyclesForChurch(ctx, {
        churchId: church._id,
        churchTimeZone: church.churchTimeZone,
        now,
      });
      maintainedChurchIds.push(church._id);
    }

    return { maintainedChurchIds };
  },
});
