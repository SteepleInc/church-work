import { httpRouter } from "convex/server";

import { mcpCurrentUserToolResponse } from "../agent/operations";
import { authComponent, createAuth } from "../authCore";
import { api } from "./_generated/api";
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

authComponent.registerRoutes(http, createAuth, { cors: true });

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
      readonly taskId: string;
      readonly title?: string;
      readonly assignedUserId?: string | null;
      readonly teamId?: string | null;
      readonly workflowStatusId?: string;
      readonly dueDate?: string;
      readonly cycleId?: string;
    };

    const { churchId, taskId, ...fields } = body;
    const result = await ctx.runMutation(convexFunctionRefs.tasks.mcpUpdateTask, {
      churchId,
      actorUserId: session.user.id,
      taskId,
      fields,
    });

    return Response.json({
      ok: result.ok,
      tool: "update_task",
      result,
    });
  }),
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
    readonly taskId: string;
  };

  const result = await ctx.runMutation(args.mutation, {
    churchId: body.churchId,
    actorUserId: session.user.id,
    taskId: body.taskId,
  });

  return Response.json({
    ok: result.ok,
    tool: args.tool,
    result,
  });
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
