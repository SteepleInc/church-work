import { httpRouter } from "convex/server";

import { mcpCurrentUserToolResponse } from "../agent/operations";
import { authComponent, createAuth } from "../authCore";
import { api, components } from "./_generated/api";
import { httpAction, type ActionCtx } from "./_generated/server";
import { polar } from "./polar";

const http = httpRouter();
const convexFunctionRefs = api as any;

const unauthenticatedResponse = () =>
  Response.json(
    {
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required",
      },
    },
    { status: 401 },
  );

const metadataHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

type BetterAuthVerification = {
  readonly identifier: string;
  readonly value: string;
  readonly expiresAt: number;
};

type BetterAuthSession = {
  readonly user?: { readonly id: string } | null;
  readonly session?: { readonly activeOrganizationId?: string | null } | null;
};

type BetterAuthMember = {
  readonly role?: string | null;
};

const jsonHeaders = {
  "Content-Type": "application/json",
};

const isLocalSiteUrl = (siteUrl: string | undefined) => {
  if (!siteUrl) {
    return false;
  }

  try {
    const { hostname } = new URL(siteUrl);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

export const isOtpCaptureEnabled = () =>
  process.env.NODE_ENV !== "production" ||
  (process.env.OTP_CAPTURE_ENABLED === "1" && isLocalSiteUrl(process.env.SITE_URL));

const extractOtp = (value: string) => {
  const separatorIndex = value.lastIndexOf(":");
  return separatorIndex === -1 ? value : value.slice(0, separatorIndex);
};

const memberCanCreateTestInvitation = (role: string | null | undefined) =>
  role === "owner" || role === "admin";

type McpTaskOperationResult = {
  readonly ok: boolean;
  readonly error?: { readonly code: string; readonly message: string };
  readonly data?: {
    readonly cycles: ReadonlyArray<{
      readonly id: string;
      readonly startDate: string;
      readonly endDate: string;
      readonly startsAt: string;
      readonly endsAt: string;
    }>;
    readonly tasks: ReadonlyArray<{
      readonly id: string;
      readonly identifier: string;
      readonly title: string;
      readonly teamId: string;
      readonly assignedUserId: string | null;
      readonly cycleId: string;
      readonly dueDate: string;
      readonly parentTaskId: string | null;
      readonly workflowId: string;
      readonly workflowStatusId: string;
      readonly taskState: "todo" | "in_progress" | "done" | "canceled";
      readonly finishedAt: string | null;
    }>;
  };
};

const compactTask = (task: NonNullable<McpTaskOperationResult["data"]>["tasks"][number]) => ({
  id: task.id,
  // The Task Identifier (e.g. "PRD-48") — the user-facing reference (ADR 0013).
  identifier: task.identifier,
  title: task.title,
  taskState: task.taskState,
  workflowStatusId: task.workflowStatusId,
  workflowId: task.workflowId,
  assignedUserId: task.assignedUserId,
  teamId: task.teamId,
  cycleId: task.cycleId,
  dueDate: task.dueDate,
  parentTaskId: task.parentTaskId,
  finishedAt: task.finishedAt,
});

const compactCycles = (cycles: NonNullable<McpTaskOperationResult["data"]>["cycles"]) =>
  cycles.map((cycle) => ({
    id: cycle.id,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    startsAt: cycle.startsAt,
    endsAt: cycle.endsAt,
  }));

const mcpTaskResponse = (
  tool: string,
  result: McpTaskOperationResult,
  options: { readonly single?: boolean } = {},
) => {
  if (!result.ok) {
    return {
      ok: false,
      tool,
      error: result.error,
    };
  }

  const tasks = (result.data?.tasks ?? []).map(compactTask);

  if (options.single) {
    return {
      ok: true,
      tool,
      task: tasks[0] ?? null,
    };
  }

  return {
    ok: true,
    tool,
    tasks,
    cycles: compactCycles(result.data?.cycles ?? []),
  };
};

authComponent.registerRoutes(http, createAuth, { cors: true });

http.route({
  path: "/api/test/otp",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!isOtpCaptureEnabled()) {
      return Response.json(
        { ok: false, error: "Not found" },
        { headers: jsonHeaders, status: 404 },
      );
    }

    const url = new URL(request.url);
    const email = url.searchParams.get("email")?.trim().toLowerCase();
    if (!email) {
      return Response.json(
        { ok: false, error: "Missing email search parameter." },
        { headers: jsonHeaders, status: 400 },
      );
    }

    const verification = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "verification",
      where: [
        {
          field: "identifier",
          value: `sign-in-otp-${email}`,
        },
      ],
    })) as BetterAuthVerification | null;

    if (!verification || verification.expiresAt < Date.now()) {
      return Response.json({ ok: false, otp: null }, { headers: jsonHeaders, status: 404 });
    }

    return Response.json(
      { ok: true, email, otp: extractOtp(verification.value), expiresAt: verification.expiresAt },
      { headers: jsonHeaders },
    );
  }),
});

http.route({
  path: "/api/test/invitations",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!isOtpCaptureEnabled()) {
      return Response.json(
        { ok: false, error: "Not found" },
        { headers: jsonHeaders, status: 404 },
      );
    }

    const session = (await createAuth(ctx).api.getSession({
      headers: request.headers,
    })) as BetterAuthSession | null;

    if (!session?.user?.id) {
      return unauthenticatedResponse();
    }

    const organizationId = session.session?.activeOrganizationId;
    if (!organizationId) {
      return Response.json(
        { ok: false, error: "No active Church found for test invitation." },
        { headers: jsonHeaders, status: 400 },
      );
    }

    const body = (await request.json()) as {
      readonly email?: string;
      readonly role?: string;
    };
    const email = body.email?.trim().toLowerCase();
    const role = body.role ?? "member";

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return Response.json(
        { ok: false, error: "A valid email is required." },
        { headers: jsonHeaders, status: 400 },
      );
    }

    if (role !== "member" && role !== "admin") {
      return Response.json(
        { ok: false, error: "Role must be member or admin." },
        { headers: jsonHeaders, status: 400 },
      );
    }

    const member = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "member",
      where: [
        { field: "organizationId", value: organizationId },
        { field: "userId", value: session.user.id },
      ],
    })) as BetterAuthMember | null;

    if (!memberCanCreateTestInvitation(member?.role)) {
      return Response.json(
        { ok: false, error: "Only Church owners and admins can create test invitations." },
        { headers: jsonHeaders, status: 403 },
      );
    }

    const invitation = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "invitation",
        data: {
          email,
          expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
          inviterId: session.user.id,
          organizationId,
          role,
          status: "pending",
        },
      },
    });

    return Response.json({ ok: true, invitation }, { headers: jsonHeaders });
  }),
});

http.route({
  path: "/.well-known/oauth-authorization-server",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const metadata = await createAuth(ctx).api.getMcpOAuthConfig({
      request,
      asResponse: false,
    });

    return Response.json(metadata, { headers: metadataHeaders });
  }),
});

http.route({
  path: "/.well-known/oauth-protected-resource",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const metadata = await createAuth(ctx).api.getMCPProtectedResource({
      request,
      asResponse: false,
    });

    return Response.json(metadata, { headers: metadataHeaders });
  }),
});

http.route({
  path: "/api/agent/current-user",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const session = await createAuth(ctx).api.getSession({ headers: request.headers });

    if (!session?.user) {
      return unauthenticatedResponse();
    }

    return Response.json({
      ok: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
    });
  }),
});

http.route({
  path: "/api/mcp/current-session",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const session = await createAuth(ctx).api.getSession({ headers: request.headers });

    if (!session?.user) {
      return unauthenticatedResponse();
    }

    return Response.json({
      ok: true,
      session: {
        userId: session.user.id,
        userEmail: session.user.email,
      },
    });
  }),
});

http.route({
  path: "/api/mcp/tools/current-user",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const session = await createAuth(ctx).api.getSession({ headers: request.headers });

    if (!session?.user) {
      return unauthenticatedResponse();
    }

    return Response.json(
      mcpCurrentUserToolResponse({
        id: session.user.id,
        email: session.user.email ?? null,
        name: session.user.name ?? null,
      }),
    );
  }),
});

http.route({
  path: "/api/mcp/tools/update-task",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const session = await createAuth(ctx).api.getSession({ headers: request.headers });

    if (!session?.user) {
      return unauthenticatedResponse();
    }

    const body = (await request.json()) as {
      readonly churchId: string;
      readonly taskId?: string;
      readonly taskIdentifier?: string;
      readonly title?: string;
      readonly assignedUserId?: string | null;
      readonly teamId?: string;
      readonly workflowStatusId?: string;
      readonly dueDate?: string;
      readonly cycleId?: string;
      readonly parentTaskId?: string | null;
    };

    const { churchId, taskId, taskIdentifier, ...fields } = body;
    const result = await ctx.runMutation(convexFunctionRefs.tasks.mcpUpdateTask, {
      churchId,
      actorUserId: session.user.id,
      taskId,
      taskIdentifier,
      fields,
    });

    return Response.json(mcpTaskResponse("update_task", result, { single: true }));
  }),
});

http.route({
  path: "/api/mcp/tools/create-task",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const session = await createAuth(ctx).api.getSession({ headers: request.headers });

    if (!session?.user) {
      return unauthenticatedResponse();
    }

    const body = (await request.json()) as {
      readonly churchId: string;
      readonly title: string;
      readonly teamId?: string;
      readonly assignedUserId?: string | null;
      readonly workflowStatusId: string;
      readonly dueDate: string;
      readonly parentTaskId?: string | null;
    };

    // Every Task belongs to exactly one Team (ADR 0013); reject team-less
    // creation here so agent callers get a clear error instead of an
    // argument-validation failure.
    if (typeof body.teamId !== "string" || body.teamId.length === 0) {
      return Response.json({
        ok: false,
        tool: "create_task",
        error: {
          code: "team_required",
          message: "Task creation requires a teamId.",
        },
      });
    }

    const result = await ctx.runMutation(convexFunctionRefs.tasks.mcpCreateTask, {
      ...body,
      teamId: body.teamId,
      actorUserId: session.user.id,
    });

    return Response.json(mcpTaskResponse("create_task", result, { single: true }));
  }),
});

http.route({
  path: "/api/mcp/tools/list-tasks",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const session = await createAuth(ctx).api.getSession({ headers: request.headers });

    if (!session?.user) {
      return unauthenticatedResponse();
    }

    type TaskState = "todo" | "in_progress" | "done" | "canceled";
    const body = (await request.json()) as {
      readonly churchId: string;
      readonly surface?: "my_work" | "our_work";
      readonly cycleId?: string;
      readonly teamId?: string;
      readonly assignedUserId?: string | null;
      readonly workflowStatusId?: string;
      readonly taskState?: TaskState;
      // Multi-value include/exclude filters (Board ad-hoc filters).
      readonly teamIdIn?: ReadonlyArray<string>;
      readonly teamIdNotIn?: ReadonlyArray<string>;
      readonly assignedUserIdIn?: ReadonlyArray<string | null>;
      readonly assignedUserIdNotIn?: ReadonlyArray<string | null>;
      readonly createdByUserIdIn?: ReadonlyArray<string | null>;
      readonly createdByUserIdNotIn?: ReadonlyArray<string | null>;
      readonly workflowStatusIdIn?: ReadonlyArray<string>;
      readonly workflowStatusIdNotIn?: ReadonlyArray<string>;
      readonly taskStateIn?: ReadonlyArray<TaskState>;
      readonly taskStateNotIn?: ReadonlyArray<TaskState>;
    };
    const result = await ctx.runQuery(convexFunctionRefs.tasks.mcpListTasks, {
      ...body,
      actorUserId: session.user.id,
    });

    return Response.json(mcpTaskResponse("list_tasks", result));
  }),
});

http.route({
  path: "/api/mcp/tools/get-task",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const session = await createAuth(ctx).api.getSession({ headers: request.headers });

    if (!session?.user) {
      return unauthenticatedResponse();
    }

    const body = (await request.json()) as {
      readonly churchId: string;
      readonly taskId?: string;
      readonly taskIdentifier?: string;
    };
    const result = await ctx.runQuery(convexFunctionRefs.tasks.mcpListTasks, {
      churchId: body.churchId,
      actorUserId: session.user.id,
      taskId: body.taskId,
      taskIdentifier: body.taskIdentifier,
    });

    return Response.json(mcpTaskResponse("get_task", result, { single: true }));
  }),
});

const handleMcpLookup = async (
  ctx: ActionCtx,
  request: Request,
  args: { readonly tool: string; readonly query: any; readonly resultKey: string },
) => {
  const session = await createAuth(ctx).api.getSession({ headers: request.headers });

  if (!session?.user) {
    return unauthenticatedResponse();
  }

  const body = (await request.json()) as {
    readonly churchId: string;
    readonly workflowId?: string;
  };
  const result = await ctx.runQuery(args.query, {
    ...body,
    actorUserId: session.user.id,
  });

  return Response.json({
    ok: result.ok,
    tool: args.tool,
    ...(result.error ? { error: result.error } : {}),
    [args.resultKey]: result[args.resultKey] ?? [],
  });
};

http.route({
  path: "/api/mcp/tools/list-users",
  method: "POST",
  handler: httpAction((ctx, request) =>
    handleMcpLookup(ctx, request, {
      tool: "list_users",
      query: convexFunctionRefs.tasks.mcpListUsers,
      resultKey: "users",
    }),
  ),
});

http.route({
  path: "/api/mcp/tools/list-teams",
  method: "POST",
  handler: httpAction((ctx, request) =>
    handleMcpLookup(ctx, request, {
      tool: "list_teams",
      query: convexFunctionRefs.tasks.mcpListTeams,
      resultKey: "teams",
    }),
  ),
});

http.route({
  path: "/api/mcp/tools/list-cycles",
  method: "POST",
  handler: httpAction((ctx, request) =>
    handleMcpLookup(ctx, request, {
      tool: "list_cycles",
      query: convexFunctionRefs.tasks.mcpListCycles,
      resultKey: "cycles",
    }),
  ),
});

http.route({
  path: "/api/mcp/tools/list-workflow-statuses",
  method: "POST",
  handler: httpAction((ctx, request) =>
    handleMcpLookup(ctx, request, {
      tool: "list_workflow_statuses",
      query: convexFunctionRefs.tasks.mcpListWorkflowStatuses,
      resultKey: "workflowStatuses",
    }),
  ),
});

const handleMcpTaskTransition = async (
  ctx: ActionCtx,
  request: Request,
  args: {
    readonly tool: "complete_task" | "cancel_task" | "reopen_task";
    readonly mutation: any;
  },
) => {
  const session = await createAuth(ctx).api.getSession({ headers: request.headers });

  if (!session?.user) {
    return unauthenticatedResponse();
  }

  const body = (await request.json()) as {
    readonly churchId: string;
    readonly taskId?: string;
    readonly taskIdentifier?: string;
  };

  const result = await ctx.runMutation(args.mutation, {
    churchId: body.churchId,
    actorUserId: session.user.id,
    taskId: body.taskId,
    taskIdentifier: body.taskIdentifier,
  });

  return Response.json(mcpTaskResponse(args.tool, result, { single: true }));
};

http.route({
  path: "/api/mcp/tools/complete-task",
  method: "POST",
  handler: httpAction((ctx, request) =>
    handleMcpTaskTransition(ctx, request, {
      tool: "complete_task",
      mutation: convexFunctionRefs.tasks.mcpCompleteTask,
    }),
  ),
});

http.route({
  path: "/api/mcp/tools/cancel-task",
  method: "POST",
  handler: httpAction((ctx, request) =>
    handleMcpTaskTransition(ctx, request, {
      tool: "cancel_task",
      mutation: convexFunctionRefs.tasks.mcpCancelTask,
    }),
  ),
});

http.route({
  path: "/api/mcp/tools/reopen-task",
  method: "POST",
  handler: httpAction((ctx, request) =>
    handleMcpTaskTransition(ctx, request, {
      tool: "reopen_task",
      mutation: convexFunctionRefs.tasks.mcpReopenTask,
    }),
  ),
});

polar.registerRoutes(http);

export default http;
