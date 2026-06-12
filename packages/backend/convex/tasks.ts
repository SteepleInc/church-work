import { v } from "convex/values";

import { taskErrorResponse, taskResponse } from "../agent/taskOperations";
import { writeActivity } from "../activityRegistry";
import registeredFunctions from "../confect/_generated/registeredFunctions";
import {
  cancelTasks,
  completeTasks,
  createTasks,
  readTaskModel,
  reopenTasks,
  serializeTaskModel,
  updateTasks,
} from "../tasks";
import { components } from "./_generated/api";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { withConvexTelemetry } from "./telemetry";

export const createBatch = registeredFunctions.tasks.createBatch;
export const updateBatch = registeredFunctions.tasks.updateBatch;
export const completeBatch = registeredFunctions.tasks.completeBatch;
export const cancelBatch = registeredFunctions.tasks.cancelBatch;
export const reopenBatch = registeredFunctions.tasks.reopenBatch;
export const listForChurch = registeredFunctions.tasks.listForChurch;

const requireMcpChurchMember = async (
  ctx: MutationCtx | QueryCtx,
  args: { readonly churchId: string; readonly actorUserId: string },
) => {
  const actorMembership = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "member",
    where: [
      { field: "organizationId", value: args.churchId },
      { field: "userId", value: args.actorUserId },
    ],
  });

  return actorMembership !== null;
};

const getMcpChurch = async (ctx: MutationCtx | QueryCtx, churchId: string) =>
  (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "organization",
    where: [{ field: "_id", value: churchId }],
  })) as { readonly churchTimeZone?: string | null } | null;

const validateAssignedUser = async (
  ctx: MutationCtx,
  args: { readonly churchId: string; readonly assignedUserId?: string | null },
) => {
  if (args.assignedUserId == null) return true;

  const assignedMembership = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "member",
    where: [
      { field: "organizationId", value: args.churchId },
      { field: "userId", value: args.assignedUserId },
    ],
  });

  return assignedMembership !== null;
};

const taskTransitionErrorResponse = (
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

const taskUpdateFieldsValidator = v.object({
  title: v.optional(v.string()),
  assignedUserId: v.optional(v.union(v.string(), v.null())),
  teamId: v.optional(v.union(v.string(), v.null())),
  workflowStatusId: v.optional(v.string()),
  dueDate: v.optional(v.string()),
  cycleId: v.optional(v.string()),
  parentTaskId: v.optional(v.union(v.string(), v.null())),
  boardOrder: v.optional(v.string()),
});

type McpTaskUpdateFields = {
  readonly title?: string;
  readonly assignedUserId?: string | null;
  readonly teamId?: string | null;
  readonly workflowStatusId?: string;
  readonly dueDate?: string;
  readonly cycleId?: string;
  readonly parentTaskId?: string | null;
  readonly boardOrder?: string;
};

/**
 * Shared handler body for `mcpUpdateTask` / `mcpUpdateTasksBatch`: validates
 * membership, assignees and teams, then applies all updates in one
 * `updateTasks` transaction.
 */
const runMcpUpdateTasks = async (
  ctx: MutationCtx,
  args: {
    readonly churchId: string;
    readonly actorUserId: string;
    readonly updates: ReadonlyArray<{
      readonly taskId: string;
      readonly fields: McpTaskUpdateFields;
    }>;
  },
) => {
  const actorMembership = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "member",
    where: [
      { field: "organizationId", value: args.churchId },
      { field: "userId", value: args.actorUserId },
    ],
  });

  if (!actorMembership) {
    return taskErrorResponse("updateTasks", "not_church_member", "Church membership is required.");
  }

  for (const update of args.updates) {
    if (update.fields.assignedUserId != null) {
      const validAssignee = await validateAssignedUser(ctx, {
        churchId: args.churchId,
        assignedUserId: update.fields.assignedUserId,
      });
      if (!validAssignee) {
        return taskErrorResponse(
          "updateTasks",
          "assigned_user_not_church_member",
          "Assigned User must be a Church Member of the Task's Church.",
        );
      }
    }
  }

  const church = await getMcpChurch(ctx, args.churchId);

  if (!church?.churchTimeZone) {
    return taskErrorResponse(
      "updateTasks",
      "church_time_zone_missing",
      "Church Time Zone is required before Tasks can be scheduled.",
    );
  }

  const churchDefaultWorkflow = await ctx.db
    .query("workflows")
    .withIndex("by_churchId", (q) => q.eq("churchId", args.churchId))
    .filter((q) => q.eq(q.field("isDefault"), true))
    .first();
  const teamWorkflowResolution = churchDefaultWorkflow
    ? {
        defaultWorkflowId: churchDefaultWorkflow._id,
        teamWorkflowIds: {} as Record<string, string>,
      }
    : undefined;

  for (const update of args.updates) {
    if (update.fields.teamId === undefined || update.fields.teamId === null) continue;

    const team = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "team",
      where: [
        { field: "_id", value: update.fields.teamId },
        { field: "organizationId", value: args.churchId },
      ],
    })) as {
      readonly defaultWorkflowId?: string | null;
      readonly archivedAt?: string | null;
    } | null;

    if (!team || team.archivedAt != null) {
      return taskErrorResponse(
        "updateTasks",
        "team_not_found",
        "Team was not found in the active Church.",
      );
    }

    if (teamWorkflowResolution) {
      teamWorkflowResolution.teamWorkflowIds[update.fields.teamId] =
        team.defaultWorkflowId ?? teamWorkflowResolution.defaultWorkflowId;
    }
  }

  return await updateTasks(ctx, {
    churchId: args.churchId,
    updates: args.updates,
    actorId: args.actorUserId,
    occurredAt: new Date().toISOString(),
    churchTimeZone: church.churchTimeZone,
    teamWorkflowResolution,
  });
};

const UPDATE_FAILURE_MESSAGES = {
  taskNotFound: ["task_not_found", "Task was not found in the active Church."],
  cycleNotFound: ["cycle_not_found", "Cycle was not found in the active Church."],
  workflowStatusNotFound: [
    "workflow_status_not_found",
    "Workflow Status was not found in the active Church.",
  ],
  workflowStatusNotInEffectiveWorkflow: [
    "workflow_status_not_in_effective_workflow",
    "Workflow Status must belong to the Task's effective Workflow.",
  ],
  parentTaskNotFound: ["parent_task_not_found", "Parent Task was not found in the active Church."],
  invalidDueDate: [
    "invalid_due_date",
    "Task Due Date must be a real Church-local date in YYYY-MM-DD format.",
  ],
  teamWorkflowNotConfigured: [
    "team_workflow_not_configured",
    "The Church default Workflow is missing.",
  ],
  workflowStatusRemapFailed: [
    "workflow_status_remap_failed",
    "Task Workflow Status could not be remapped for the destination Team.",
  ],
  invalidTaskTransition: [
    "invalid_task_transition",
    "Task cannot perform that transition from its current state.",
  ],
} as const satisfies Record<string, readonly [Parameters<typeof taskErrorResponse>[1], string]>;

const mcpUpdateFailureResponse = (code: string) => {
  const [errorCode, message] =
    UPDATE_FAILURE_MESSAGES[code as keyof typeof UPDATE_FAILURE_MESSAGES] ??
    UPDATE_FAILURE_MESSAGES.invalidTaskTransition;
  return taskErrorResponse("updateTasks", errorCode, message);
};

export const mcpUpdateTask = mutation({
  args: {
    churchId: v.string(),
    actorUserId: v.string(),
    taskId: v.string(),
    fields: taskUpdateFieldsValidator,
  },
  handler: async (ctx, args) =>
    withConvexTelemetry(
      "task.update",
      {
        "church.id": args.churchId,
        "task.id": args.taskId,
      },
      async () => {
        const updated = await runMcpUpdateTasks(ctx, {
          churchId: args.churchId,
          actorUserId: args.actorUserId,
          updates: [{ taskId: args.taskId, fields: args.fields }],
        });

        if (!updated.ok) {
          return "error" in updated ? updated : mcpUpdateFailureResponse(updated.code);
        }

        const model = await readTaskModel(ctx, args.churchId, { taskId: args.taskId });

        return taskResponse("updateTasks", serializeTaskModel(model));
      },
    ),
});

export const mcpUpdateTasksBatch = mutation({
  args: {
    churchId: v.string(),
    actorUserId: v.string(),
    updates: v.array(
      v.object({
        taskId: v.string(),
        fields: taskUpdateFieldsValidator,
      }),
    ),
  },
  handler: async (ctx, args) =>
    withConvexTelemetry(
      "task.update_batch",
      {
        "church.id": args.churchId,
        "task.count": args.updates.length,
      },
      async () => {
        const updated = await runMcpUpdateTasks(ctx, args);

        if (!updated.ok) {
          return "error" in updated ? updated : mcpUpdateFailureResponse(updated.code);
        }

        const updatedTaskIds = new Set(args.updates.map((update) => update.taskId));
        const model = await readTaskModel(ctx, args.churchId);
        const data = serializeTaskModel(model);

        return taskResponse("updateTasks", {
          cycles: data.cycles,
          tasks: data.tasks.filter((task) => updatedTaskIds.has(task.id)),
        });
      },
    ),
});

export const mcpCreateTask = mutation({
  args: {
    churchId: v.string(),
    actorUserId: v.string(),
    title: v.string(),
    teamId: v.optional(v.union(v.string(), v.null())),
    assignedUserId: v.optional(v.union(v.string(), v.null())),
    workflowStatusId: v.string(),
    dueDate: v.string(),
    parentTaskId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) =>
    withConvexTelemetry(
      "task.create",
      {
        "church.id": args.churchId,
        "task.assigned": args.assignedUserId != null,
        "task.team_assigned": args.teamId != null,
      },
      async () => {
        const isChurchMember = await requireMcpChurchMember(ctx, args);

        if (!isChurchMember) {
          return taskErrorResponse(
            "createTasks",
            "not_church_member",
            "Church membership is required.",
          );
        }

        if (!(await validateAssignedUser(ctx, args))) {
          return taskErrorResponse(
            "createTasks",
            "assigned_user_not_church_member",
            "Assigned User must be a Church Member of the Task's Church.",
          );
        }

        const church = await getMcpChurch(ctx, args.churchId);

        if (!church?.churchTimeZone) {
          return taskErrorResponse(
            "createTasks",
            "church_time_zone_missing",
            "Church Time Zone is required before Tasks can be scheduled.",
          );
        }

        const created = await createTasks(ctx, {
          churchId: args.churchId,
          churchTimeZone: church.churchTimeZone,
          tasks: [
            {
              title: args.title,
              teamId: args.teamId ?? null,
              assignedUserId: args.assignedUserId ?? null,
              workflowStatusId: args.workflowStatusId,
              dueDate: args.dueDate,
              parentTaskId: args.parentTaskId ?? null,
            },
          ],
        });

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
        if (!created.ok) {
          return taskErrorResponse(
            "createTasks",
            "invalid_task_transition",
            "Task cannot perform that transition from its current state.",
          );
        }

        const occurredAt = new Date().toISOString();
        for (const taskId of created.createdTaskIds) {
          const task = await ctx.db.get(taskId);
          if (!task) continue;
          await writeActivity(ctx, {
            churchId: args.churchId,
            entityType: "task",
            entityId: task._id,
            eventType: "task.created",
            actorType: "user",
            actorId: args.actorUserId,
            occurredAt,
            cycleId: task.cycleId,
            metadata: { parentTaskId: task.parentTaskId },
          });
        }

        const createdTaskIds = new Set(created.createdTaskIds.map(String));
        const model = await readTaskModel(ctx, args.churchId);
        const data = serializeTaskModel(model);

        return taskResponse("createTasks", {
          cycles: data.cycles,
          tasks: data.tasks.filter((task) => createdTaskIds.has(task.id)),
        });
      },
    ),
});

export const mcpListTasks = query({
  args: {
    churchId: v.string(),
    actorUserId: v.string(),
    surface: v.optional(v.union(v.literal("my_work"), v.literal("our_work"))),
    cycleId: v.optional(v.string()),
    teamId: v.optional(v.union(v.string(), v.null())),
    assignedUserId: v.optional(v.union(v.string(), v.null())),
    workflowStatusId: v.optional(v.string()),
    taskState: v.optional(
      v.union(
        v.literal("todo"),
        v.literal("in_progress"),
        v.literal("done"),
        v.literal("canceled"),
      ),
    ),
    taskId: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    withConvexTelemetry(
      "task.list",
      {
        "church.id": args.churchId,
        "task.surface": args.surface,
        "task.has_filters": Boolean(
          args.cycleId ??
          args.teamId ??
          args.assignedUserId ??
          args.workflowStatusId ??
          args.taskState ??
          args.taskId,
        ),
      },
      async () => {
        const isChurchMember = await requireMcpChurchMember(ctx, args);

        if (!isChurchMember) {
          return taskErrorResponse(
            "listTasks",
            "not_church_member",
            "Church membership is required.",
          );
        }

        const filters: {
          surface?: "my_work" | "our_work";
          cycleId?: string;
          currentUserId?: string;
          taskId?: string;
          teamId?: string | null;
          assignedUserId?: string | null;
          workflowStatusId?: string;
          taskState?: "todo" | "in_progress" | "done" | "canceled";
        } = { currentUserId: args.actorUserId };
        if (args.surface !== undefined) filters.surface = args.surface;
        if (args.cycleId !== undefined) filters.cycleId = args.cycleId;
        if (args.taskId !== undefined) filters.taskId = args.taskId;
        if (args.teamId !== undefined) filters.teamId = args.teamId;
        if (args.assignedUserId !== undefined) filters.assignedUserId = args.assignedUserId;
        if (args.workflowStatusId !== undefined) filters.workflowStatusId = args.workflowStatusId;
        if (args.taskState !== undefined) filters.taskState = args.taskState;

        const model = await readTaskModel(ctx, args.churchId, filters);

        return taskResponse("listTasks", serializeTaskModel(model));
      },
    ),
});

export const mcpListUsers = query({
  args: { churchId: v.string(), actorUserId: v.string() },
  handler: async (ctx, args) => {
    const isChurchMember = await requireMcpChurchMember(ctx, args);

    if (!isChurchMember) {
      return {
        ok: false as const,
        error: { code: "not_church_member", message: "Church membership is required." },
      };
    }

    const members = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "member",
      where: [{ field: "organizationId", value: args.churchId }],
      paginationOpts: { cursor: null, numItems: 100 },
    })) as { readonly page: ReadonlyArray<{ readonly userId: string; readonly role: string }> };
    const userIds = [...new Set(members.page.map((member) => member.userId))];
    const users = userIds.length
      ? (
          (await ctx.runQuery(components.betterAuth.adapter.findMany, {
            model: "user",
            where: [{ field: "_id", operator: "in", value: userIds }],
            paginationOpts: { cursor: null, numItems: 100 },
          })) as {
            readonly page: ReadonlyArray<{
              readonly _id: string;
              readonly email?: string | null;
              readonly name?: string | null;
            }>;
          }
        ).page
      : [];

    return {
      ok: true as const,
      users: users.map((user) => ({
        id: user._id,
        email: user.email ?? null,
        name: user.name ?? null,
      })),
    };
  },
});

export const mcpListTeams = query({
  args: { churchId: v.string(), actorUserId: v.string() },
  handler: async (ctx, args) => {
    const isChurchMember = await requireMcpChurchMember(ctx, args);

    if (!isChurchMember) {
      return {
        ok: false as const,
        error: { code: "not_church_member", message: "Church membership is required." },
      };
    }

    const teams = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "team",
      where: [{ field: "organizationId", value: args.churchId }],
      paginationOpts: { cursor: null, numItems: 100 },
    })) as {
      readonly page: ReadonlyArray<{
        readonly _id: string;
        readonly name: string;
        readonly archivedAt?: string | null;
        readonly sortOrder?: number | null;
        readonly defaultWorkflowId?: string | null;
      }>;
    };

    return {
      ok: true as const,
      teams: teams.page
        .filter((team) => (team.archivedAt ?? null) === null)
        .map((team) => ({
          id: team._id,
          name: team.name,
          defaultWorkflowId: team.defaultWorkflowId ?? null,
          sortOrder: team.sortOrder ?? 0,
        })),
    };
  },
});

export const mcpListCycles = query({
  args: { churchId: v.string(), actorUserId: v.string() },
  handler: async (ctx, args) => {
    const isChurchMember = await requireMcpChurchMember(ctx, args);

    if (!isChurchMember) {
      return {
        ok: false as const,
        error: { code: "not_church_member", message: "Church membership is required." },
      };
    }

    const cycles = await ctx.db
      .query("cycles")
      .withIndex("by_churchId", (q) => q.eq("churchId", args.churchId))
      .collect();

    return {
      ok: true as const,
      cycles: cycles.map((cycle) => ({
        id: cycle._id,
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        startsAt: cycle.startsAt,
        endsAt: cycle.endsAt,
      })),
    };
  },
});

export const mcpListWorkflowStatuses = query({
  args: { churchId: v.string(), actorUserId: v.string(), workflowId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const isChurchMember = await requireMcpChurchMember(ctx, args);

    if (!isChurchMember) {
      return {
        ok: false as const,
        error: { code: "not_church_member", message: "Church membership is required." },
      };
    }

    const statuses = await ctx.db
      .query("workflowStatuses")
      .withIndex("by_churchId", (q) => q.eq("churchId", args.churchId))
      .collect();

    return {
      ok: true as const,
      workflowStatuses: statuses
        .filter((status) => status.archivedAt === null)
        .filter((status) => !args.workflowId || status.workflowId === args.workflowId)
        .map((status) => ({
          id: status._id,
          workflowId: status.workflowId,
          name: status.name,
          key: status.key,
          taskState: status.taskState,
          sortOrder: status.sortOrder,
        })),
    };
  },
});

const makeMcpTaskTransition = (
  operation: "completeTasks" | "cancelTasks" | "reopenTasks",
  transition: typeof completeTasks | typeof cancelTasks | typeof reopenTasks,
) =>
  mutation({
    args: {
      churchId: v.string(),
      actorUserId: v.string(),
      taskId: v.string(),
    },
    handler: async (ctx, args) =>
      withConvexTelemetry(
        `task.${operation.replace("Tasks", "")}`,
        {
          "church.id": args.churchId,
          "task.id": args.taskId,
        },
        async () => {
          const isChurchMember = await requireMcpChurchMember(ctx, args);

          if (!isChurchMember) {
            return taskErrorResponse(
              operation,
              "not_church_member",
              "Church membership is required.",
            );
          }

          const result = await transition(ctx, {
            churchId: args.churchId,
            taskIds: [args.taskId],
            actorId: args.actorUserId,
          });

          if (!result.ok) return taskTransitionErrorResponse(operation, result.code);

          const model = await readTaskModel(ctx, args.churchId, { taskId: args.taskId });

          return taskResponse(operation, serializeTaskModel(model));
        },
      ),
  });

export const mcpCompleteTask = makeMcpTaskTransition("completeTasks", completeTasks);
export const mcpCancelTask = makeMcpTaskTransition("cancelTasks", cancelTasks);
export const mcpReopenTask = makeMcpTaskTransition("reopenTasks", reopenTasks);
