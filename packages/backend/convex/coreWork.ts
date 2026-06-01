import registeredFunctions from "../confect/_generated/registeredFunctions";
import { maintainCyclesForChurch } from "../cycleMaintenance";
import { writeActivity } from "../activityRegistry";
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const batchRead = registeredFunctions.coreWork.batchRead;
export const batchWrite = registeredFunctions.coreWork.batchWrite;

export const systemBatchWrite = internalMutation({
  args: {
    operations: v.array(
      v.union(
        v.object({
          id: v.string(),
          operation: v.literal("maintainCyclesForChurch"),
          input: v.object({ churchId: v.string(), churchTimeZone: v.string(), now: v.string() }),
        }),
        v.object({
          id: v.string(),
          operation: v.literal("recordActivity"),
          input: v.any(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const results: Array<{
      readonly id: string;
      readonly operation: string;
      readonly result: unknown;
    }> = [];

    for (const operation of args.operations) {
      if (operation.operation === "maintainCyclesForChurch") {
        results.push({
          id: operation.id,
          operation: operation.operation,
          result: await maintainCyclesForChurch(ctx, operation.input),
        });
      } else {
        results.push({
          id: operation.id,
          operation: operation.operation,
          result: { activityId: await writeActivity(ctx, operation.input) },
        });
      }
    }

    return { ok: true, operation: "coreWorkSystemBatchWrite", results };
  },
});
