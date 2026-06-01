import { v } from "convex/values";

import { taskErrorResponse, taskResponse } from "../agent/taskOperations";
import registeredFunctions from "../confect/_generated/registeredFunctions";
import { readTaskModel, serializeTaskModel, updateTasks } from "../tasks";
import { components } from "./_generated/api";
import { mutation } from "./_generated/server";

export const createBatch = registeredFunctions.tasks.createBatch;
export const updateBatch = registeredFunctions.tasks.updateBatch;
export const completeBatch = registeredFunctions.tasks.completeBatch;
export const cancelBatch = registeredFunctions.tasks.cancelBatch;
export const reopenBatch = registeredFunctions.tasks.reopenBatch;
export const listForChurch = registeredFunctions.tasks.listForChurch;

export const mcpUpdateTask = mutation({
  args: {
    churchId: v.string(),
    actorUserId: v.string(),
    taskId: v.string(),
    fields: v.object({
      title: v.optional(v.string()),
      assignedUserId: v.optional(v.union(v.string(), v.null())),
    }),
  },
  handler: async (ctx, args) => {
    const actorMembership = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "member",
      where: [
        { field: "organizationId", value: args.churchId },
        { field: "userId", value: args.actorUserId },
      ],
    });

    if (!actorMembership) {
      return taskErrorResponse(
        "updateTasks",
        "not_church_member",
        "Church membership is required.",
      );
    }

    if (args.fields.assignedUserId != null) {
      const assignedMembership = await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "member",
        where: [
          { field: "organizationId", value: args.churchId },
          { field: "userId", value: args.fields.assignedUserId },
        ],
      });

      if (!assignedMembership) {
        return taskErrorResponse(
          "updateTasks",
          "assigned_user_not_church_member",
          "Assigned User must be a Church Member of the Task's Church.",
        );
      }
    }

    const church = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "organization",
      where: [{ field: "_id", value: args.churchId }],
    })) as { readonly churchTimeZone?: string | null } | null;

    if (!church?.churchTimeZone) {
      return taskErrorResponse(
        "updateTasks",
        "church_time_zone_missing",
        "Church Time Zone is required before Tasks can be scheduled.",
      );
    }

    const updated = await updateTasks(ctx, {
      churchId: args.churchId,
      updates: [{ taskId: args.taskId, fields: args.fields }],
      actorId: args.actorUserId,
      occurredAt: new Date().toISOString(),
      churchTimeZone: church.churchTimeZone,
    });

    if (!updated.ok && updated.code === "taskNotFound") {
      return taskErrorResponse(
        "updateTasks",
        "task_not_found",
        "Task was not found in the active Church.",
      );
    }
    if (!updated.ok) {
      return taskErrorResponse(
        "updateTasks",
        "invalid_task_transition",
        "Task cannot perform that transition from its current state.",
      );
    }

    const model = await readTaskModel(ctx, args.churchId);

    return taskResponse("updateTasks", serializeTaskModel(model));
  },
});
