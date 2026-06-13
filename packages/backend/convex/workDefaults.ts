import { v } from "convex/values";

import registeredFunctions from "../confect/_generated/registeredFunctions";
import { seedDefaultWorkModel, seedTeamWorkflow } from "../workDefaults";
import { internalMutation } from "./_generated/server";

export const seedForChurch = registeredFunctions.workDefaults.seedForChurch;
export const readForChurch = registeredFunctions.workDefaults.readForChurch;

export const internalSeedForChurch = internalMutation({
  args: { churchId: v.string() },
  handler: async (ctx, args) => {
    await seedDefaultWorkModel(ctx, args.churchId);
    return null;
  },
});

// Seeds a newly created Team its own Workflow (ADR 0013). Invoked from the
// Better Auth afterCreateTeam hook so raw create-team API calls seed too.
export const internalSeedTeamWorkflow = internalMutation({
  args: { churchId: v.string(), teamId: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    await seedTeamWorkflow(ctx, args);
    return null;
  },
});
