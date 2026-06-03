/// <reference types="vite/client" />

import { describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";

import * as TestConfect from "../test/TestConfect";
import refs from "./_generated/refs";

const decodeJwtPayload = (token: string) =>
  JSON.parse(atob(token.split(".")[1]!.replaceAll("-", "+").replaceAll("_", "/"))) as {
    sessionId?: string;
  };

const signUpWithEmail = (c: typeof TestConfect.TestConfect.Service, email: string) =>
  c.fetch("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:2101",
    },
    body: JSON.stringify({
      name: "Convex Test User",
      email,
      password: "correct horse battery staple",
    }),
  });

const authenticatedConfect = function* (
  c: typeof TestConfect.TestConfect.Service,
  args: { readonly userId: string; readonly sessionToken: string },
) {
  const tokenResponse = yield* c.fetch("/api/auth/convex/token", {
    method: "GET",
    headers: { authorization: `Bearer ${args.sessionToken}` },
  });
  const tokenBody = (yield* Effect.promise(() => tokenResponse.json())) as { token?: string };
  const tokenPayload = decodeJwtPayload(tokenBody.token!);

  return c.withIdentity({
    subject: args.userId,
    sessionId: tokenPayload.sessionId!,
  });
};

const createChurch = (
  c: typeof TestConfect.TestConfect.Service,
  args: { readonly token: string; readonly name: string; readonly slug: string },
) =>
  c.fetch("/api/auth/organization/create", {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: args.name,
      slug: args.slug,
      churchTimeZone: "America/New_York",
    }),
  });

describe("Better Auth authenticated state spike", () => {
  it.effect("convex-test identity alone does not authenticate Better Auth-backed queries", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const authenticated = c.withIdentity({
        subject: "identity-only-user",
        sessionId: "identity-only-session",
      });

      const result = yield* authenticated.query(refs.public.privateData.get);

      expect(result).toEqual({ message: "Not authenticated" });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect(
    "Better Auth HTTP signup route creates backend auth state usable by Confect queries",
    () =>
      Effect.gen(function* () {
        const c = yield* TestConfect.TestConfect;
        const email = `convex-test-${crypto.randomUUID()}@example.com`;

        const response = yield* signUpWithEmail(c, email);

        expect(response.status).toBe(200);

        const body = (yield* Effect.promise(() => response.json())) as {
          user?: { id?: string; email?: string };
          token?: string;
        };

        expect(body.user?.email).toBe(email);
        expect(body.user?.id).toEqual(expect.any(String));
        expect(body.token).toEqual(expect.any(String));

        const tokenResponse = yield* c.fetch("/api/auth/convex/token", {
          method: "GET",
          headers: { authorization: `Bearer ${body.token}` },
        });
        const tokenBody = (yield* Effect.promise(() => tokenResponse.json())) as {
          token?: string;
        };
        const tokenPayload = decodeJwtPayload(tokenBody.token!);

        expect(tokenResponse.status).toBe(200);
        expect(tokenBody.token).toEqual(expect.any(String));
        expect(tokenPayload.sessionId).toEqual(expect.any(String));

        const authenticated = c.withIdentity({
          subject: body.user!.id!,
          sessionId: tokenPayload.sessionId!,
        });

        const privateData = yield* authenticated.query(refs.public.privateData.get);
        const currentUser = yield* authenticated.query(refs.public.auth.getCurrentUser);

        expect(privateData).toEqual({ message: "This is private" });
        expect(currentUser).toMatchObject({
          _id: body.user!.id!,
          email,
          name: "Convex Test User",
        });
      }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("complete-onboarding marks a member Church complete", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `complete-onboarding-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        token?: string;
      };

      expect(signUpResponse.status).toBe(200);
      expect(signUpBody.token).toEqual(expect.any(String));

      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Complete Onboarding Church",
        slug: `complete-onboarding-${crypto.randomUUID()}`,
      });
      const churchBody = (yield* Effect.promise(() => churchResponse.json())) as {
        id?: string;
      };

      expect(churchResponse.status).toBe(200);
      expect(churchBody.id).toEqual(expect.any(String));

      const completeResponse = yield* c.fetch("/api/auth/complete-onboarding", {
        method: "POST",
        headers: {
          authorization: `Bearer ${signUpBody.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ orgId: churchBody.id }),
      });
      const completeBody = (yield* Effect.promise(() => completeResponse.json())) as unknown;

      expect(completeResponse.status).toBe(200);
      expect(completeBody).toEqual({ status: true });

      const organizationResponse = yield* c.fetch(
        `/api/auth/organization/get-full-organization?organizationId=${churchBody.id}`,
        {
          method: "GET",
          headers: { authorization: `Bearer ${signUpBody.token}` },
        },
      );
      const organizationBody = (yield* Effect.promise(() => organizationResponse.json())) as {
        completedOnboarding?: boolean;
      };

      expect(organizationResponse.status).toBe(200);
      expect(organizationBody.completedOnboarding).toBe(true);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect(
    "agent current-user request rejects invalid bearer tokens with a sanitized structured error",
    () =>
      Effect.gen(function* () {
        const c = yield* TestConfect.TestConfect;
        const rawToken = "invalid-agent-token-for-issue-12";

        const response = yield* c.fetch("/api/agent/current-user", {
          method: "GET",
          headers: { authorization: `Bearer ${rawToken}` },
        });
        const bodyText = yield* Effect.promise(() => response.text());

        expect(response.status).toBe(401);
        expect(bodyText).not.toContain(rawToken);
        expect(JSON.parse(bodyText)).toEqual({
          ok: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required",
          },
        });
      }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("agent current-user request resolves a valid bearer token to the current User", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-bearer-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string; email?: string };
        token?: string;
      };

      expect(signUpResponse.status).toBe(200);
      expect(signUpBody.token).toEqual(expect.any(String));

      const response = yield* c.fetch("/api/agent/current-user", {
        method: "GET",
        headers: { authorization: `Bearer ${signUpBody.token}` },
      });
      const body = (yield* Effect.promise(() => response.json())) as unknown;

      expect(response.status).toBe(200);
      expect(body).toEqual({
        ok: true,
        user: {
          id: signUpBody.user!.id,
          email,
          name: "Convex Test User",
        },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("CLI API key credential resolves to the current User through bearer auth", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-cli-key-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string; email?: string };
        token?: string;
      };

      expect(signUpResponse.status).toBe(200);
      expect(signUpBody.token).toEqual(expect.any(String));

      const createKeyResponse = yield* c.fetch("/api/auth/api-key/create", {
        method: "POST",
        headers: {
          authorization: `Bearer ${signUpBody.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Agent CLI Test" }),
      });
      const createKeyBody = (yield* Effect.promise(() => createKeyResponse.json())) as {
        id?: string;
        name?: string;
        key?: string;
        start?: string | null;
      };

      expect(createKeyResponse.status).toBe(200);
      expect(createKeyBody).toMatchObject({
        id: expect.any(String),
        name: "Agent CLI Test",
        key: expect.stringMatching(/^ctcli_/),
        start: "ctcli_",
      });

      const response = yield* c.fetch("/api/agent/current-user", {
        method: "GET",
        headers: { authorization: `Bearer ${createKeyBody.key}` },
      });
      const body = (yield* Effect.promise(() => response.json())) as unknown;

      expect(response.status).toBe(200);
      expect(body).toEqual({
        ok: true,
        user: {
          id: signUpBody.user!.id,
          email,
          name: "Convex Test User",
        },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("MCP OAuth authorization-server metadata advertises discoverable endpoints", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;

      const response = yield* c.fetch("/.well-known/oauth-authorization-server", {
        method: "GET",
      });
      const body = (yield* Effect.promise(() => response.json())) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        issuer: "http://127.0.0.1:3210",
        authorization_endpoint: "http://127.0.0.1:3210/api/auth/mcp/authorize",
        token_endpoint: "http://127.0.0.1:3210/api/auth/mcp/token",
        userinfo_endpoint: "http://127.0.0.1:3210/api/auth/mcp/userinfo",
        jwks_uri: "http://127.0.0.1:3210/api/auth/mcp/jwks",
        registration_endpoint: "http://127.0.0.1:3210/api/auth/mcp/register",
        scopes_supported: ["openid", "profile", "email", "offline_access"],
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("MCP protected-resource metadata advertises bearer header support", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;

      const response = yield* c.fetch("/.well-known/oauth-protected-resource", {
        method: "GET",
      });
      const body = (yield* Effect.promise(() => response.json())) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        resource: "http://127.0.0.1:3210",
        authorization_servers: ["http://127.0.0.1:3210"],
        jwks_uri: "http://127.0.0.1:3210/api/auth/mcp/jwks",
        scopes_supported: ["openid", "profile", "email", "offline_access"],
        bearer_methods_supported: ["header"],
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("MCP current-session request rejects invalid bearer tokens without leaking them", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const rawToken = "invalid-mcp-token-for-issue-14";

      const response = yield* c.fetch("/api/mcp/current-session", {
        method: "GET",
        headers: { authorization: `Bearer ${rawToken}` },
      });
      const bodyText = yield* Effect.promise(() => response.text());

      expect(response.status).toBe(401);
      expect(bodyText).not.toContain(rawToken);
      expect(JSON.parse(bodyText)).toEqual({
        ok: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required",
        },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("MCP current-user tool requires authentication with a structured response", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;

      const response = yield* c.fetch("/api/mcp/tools/current-user", {
        method: "POST",
      });
      const body = (yield* Effect.promise(() => response.json())) as unknown;

      expect(response.status).toBe(401);
      expect(body).toEqual({
        ok: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required",
        },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("MCP current-user tool returns the shared typed operation response", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `mcp-current-user-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };

      expect(signUpResponse.status).toBe(200);
      expect(signUpBody.token).toEqual(expect.any(String));

      const response = yield* c.fetch("/api/mcp/tools/current-user", {
        method: "POST",
        headers: { authorization: `Bearer ${signUpBody.token}` },
      });
      const body = (yield* Effect.promise(() => response.json())) as unknown;

      expect(response.status).toBe(200);
      expect(body).toEqual({
        ok: true,
        tool: "currentUser",
        result: {
          ok: true,
          operation: "currentUser",
          data: {
            user: {
              id: signUpBody.user!.id,
              email,
              name: "Convex Test User",
            },
          },
        },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("MCP update-task tool assigns a User through the shared Task update contract", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `mcp-update-task-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const owner = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: owner.token!,
        name: "MCP Task Update Church",
        slug: `mcp-task-update-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: owner.user!.id!,
        sessionToken: owner.token!,
      });
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const todoStatus = defaults.data.workflowStatuses.find(
        (status) => status.taskState === "todo",
      )!;
      const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Assign from MCP",
            teamId: null,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
        ],
      });
      const task = created.data.tasks.find((candidate) => candidate.title === "Assign from MCP")!;

      const response = yield* c.fetch("/api/mcp/tools/update-task", {
        method: "POST",
        headers: {
          authorization: `Bearer ${owner.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          churchId: church.id!,
          taskId: task.id,
          assignedUserId: owner.user!.id!,
        }),
      });
      const body = (yield* Effect.promise(() => response.json())) as unknown;
      const activities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "task",
        entityId: task.id,
      });

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        ok: true,
        tool: "update_task",
        task: expect.objectContaining({ id: task.id, assignedUserId: owner.user!.id! }),
      });
      expect(activities.data.activities.map((activity) => activity.eventType)).toEqual([
        "task.created",
        "task.user_assigned",
      ]);
      expect(activities.data.activities[1]).toMatchObject({
        actorId: owner.user!.id!,
        metadata: {
          previousAssignedUserId: null,
          assignedUserId: owner.user!.id!,
        },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect(
    "MCP update-task tool updates parent Task through the shared Task update contract",
    () =>
      Effect.gen(function* () {
        const c = yield* TestConfect.TestConfect;
        const email = `mcp-update-task-parent-${crypto.randomUUID()}@example.com`;
        const signUpResponse = yield* signUpWithEmail(c, email);
        const owner = (yield* Effect.promise(() => signUpResponse.json())) as {
          user?: { id?: string };
          token?: string;
        };
        const churchResponse = yield* createChurch(c, {
          token: owner.token!,
          name: "MCP Task Parent Update Church",
          slug: `mcp-task-parent-update-${crypto.randomUUID()}`,
        });
        const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
        const authenticated = yield* authenticatedConfect(c, {
          userId: owner.user!.id!,
          sessionToken: owner.token!,
        });
        const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
          churchId: church.id!,
        });
        const todoStatus = defaults.data.workflowStatuses.find(
          (status) => status.taskState === "todo",
        )!;
        const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
          churchId: church.id!,
          tasks: [
            {
              title: "Parent from MCP",
              teamId: null,
              workflowStatusId: todoStatus.id,
              dueDate: "2026-06-03",
              parentTaskId: null,
            },
            {
              title: "Child from MCP",
              teamId: null,
              workflowStatusId: todoStatus.id,
              dueDate: "2026-06-03",
              parentTaskId: null,
            },
          ],
        });
        const parentTask = created.data.tasks.find(
          (candidate) => candidate.title === "Parent from MCP",
        )!;
        const childTask = created.data.tasks.find(
          (candidate) => candidate.title === "Child from MCP",
        )!;

        const response = yield* c.fetch("/api/mcp/tools/update-task", {
          method: "POST",
          headers: {
            authorization: `Bearer ${owner.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            churchId: church.id!,
            taskId: childTask.id,
            parentTaskId: parentTask.id,
          }),
        });
        const body = (yield* Effect.promise(() => response.json())) as unknown;
        const activities = yield* authenticated.query(refs.public.activities.listForEntity, {
          churchId: church.id!,
          entityType: "task",
          entityId: childTask.id,
        });

        expect(response.status).toBe(200);
        expect(body).toMatchObject({
          ok: true,
          tool: "update_task",
          task: expect.objectContaining({ id: childTask.id, parentTaskId: parentTask.id }),
        });
        expect(activities.data.activities.map((activity) => activity.eventType)).toEqual([
          "task.created",
          "task.updated",
        ]);
        expect(activities.data.activities[1]).toMatchObject({
          actorId: owner.user!.id!,
          metadata: {
            updatedFields: ["parentTaskId"],
            previousParentTaskId: null,
            parentTaskId: parentTask.id,
          },
        });
      }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect(
    "MCP lifecycle tools complete, cancel, and reopen Tasks through shared transitions",
    () =>
      Effect.gen(function* () {
        const c = yield* TestConfect.TestConfect;
        const email = `mcp-lifecycle-task-${crypto.randomUUID()}@example.com`;
        const signUpResponse = yield* signUpWithEmail(c, email);
        const owner = (yield* Effect.promise(() => signUpResponse.json())) as {
          user?: { id?: string };
          token?: string;
        };
        const churchResponse = yield* createChurch(c, {
          token: owner.token!,
          name: "MCP Task Lifecycle Church",
          slug: `mcp-task-lifecycle-${crypto.randomUUID()}`,
        });
        const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
        const authenticated = yield* authenticatedConfect(c, {
          userId: owner.user!.id!,
          sessionToken: owner.token!,
        });
        const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
          churchId: church.id!,
        });
        const todoStatus = defaults.data.workflowStatuses.find(
          (status) => status.taskState === "todo",
        )!;
        const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
          churchId: church.id!,
          tasks: [
            {
              title: "Complete from MCP",
              teamId: null,
              workflowStatusId: todoStatus.id,
              dueDate: "2026-06-03",
              parentTaskId: null,
            },
            {
              title: "Cancel from MCP",
              teamId: null,
              workflowStatusId: todoStatus.id,
              dueDate: "2026-06-04",
              parentTaskId: null,
            },
          ],
        });
        const completeTask = created.data.tasks.find(
          (candidate) => candidate.title === "Complete from MCP",
        )!;
        const cancelTask = created.data.tasks.find(
          (candidate) => candidate.title === "Cancel from MCP",
        )!;
        const postTool = (toolPath: string, taskId: string) =>
          c.fetch(`/api/mcp/tools/${toolPath}`, {
            method: "POST",
            headers: {
              authorization: `Bearer ${owner.token}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ churchId: church.id!, taskId }),
          });

        const completeResponse = yield* postTool("complete-task", completeTask.id);
        const completeBody = (yield* Effect.promise(() => completeResponse.json())) as unknown;
        const cancelResponse = yield* postTool("cancel-task", cancelTask.id);
        const cancelBody = (yield* Effect.promise(() => cancelResponse.json())) as unknown;
        const reopenResponse = yield* postTool("reopen-task", cancelTask.id);
        const reopenBody = (yield* Effect.promise(() => reopenResponse.json())) as {
          task?: { id: string; taskState: string; finishedAt: string | null };
        };
        const completeActivities = yield* authenticated.query(
          refs.public.activities.listForEntity,
          {
            churchId: church.id!,
            entityType: "task",
            entityId: completeTask.id,
          },
        );
        const cancelActivities = yield* authenticated.query(refs.public.activities.listForEntity, {
          churchId: church.id!,
          entityType: "task",
          entityId: cancelTask.id,
        });

        expect(completeResponse.status).toBe(200);
        expect(completeBody).toMatchObject({
          ok: true,
          tool: "complete_task",
          task: expect.objectContaining({ id: completeTask.id, taskState: "done" }),
        });
        expect(cancelResponse.status).toBe(200);
        expect(cancelBody).toMatchObject({
          ok: true,
          tool: "cancel_task",
          task: expect.objectContaining({ id: cancelTask.id, taskState: "canceled" }),
        });
        expect(reopenResponse.status).toBe(200);
        expect(reopenBody).toMatchObject({
          ok: true,
          tool: "reopen_task",
          task: expect.objectContaining({ id: cancelTask.id, taskState: "todo", finishedAt: null }),
        });
        expect(reopenBody.task).toMatchObject({ taskState: "todo", finishedAt: null });
        expect(completeActivities.data.activities.map((activity) => activity.eventType)).toEqual([
          "task.created",
          "task.completed",
        ]);
        expect(cancelActivities.data.activities.map((activity) => activity.eventType)).toEqual([
          "task.created",
          "task.canceled",
          "task.reopened",
        ]);
        expect(completeActivities.data.activities[1]).toMatchObject({ actorId: owner.user!.id! });
        expect(cancelActivities.data.activities[1]).toMatchObject({ actorId: owner.user!.id! });
        expect(cancelActivities.data.activities[2]).toMatchObject({ actorId: owner.user!.id! });
      }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Task execution smoke path shares MCP and public Confect semantics", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `task-execution-smoke-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const owner = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: owner.token!,
        name: "Task Execution Smoke Church",
        slug: `task-execution-smoke-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: owner.user!.id!,
        sessionToken: owner.token!,
      });
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const defaultWorkflow = defaults.data.workflows.find((candidate) => candidate.isDefault)!;
      const todoStatus = defaults.data.workflowStatuses.find(
        (status) => status.workflowId === defaultWorkflow.id && status.taskState === "todo",
      )!;
      const doingStatus = defaults.data.workflowStatuses.find(
        (status) => status.workflowId === defaultWorkflow.id && status.taskState === "in_progress",
      )!;
      const postTool = (toolPath: string, body: Record<string, unknown>) =>
        c.fetch(`/api/mcp/tools/${toolPath}`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${owner.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });

      const createAssignedResponse = yield* postTool("create-task", {
        churchId: church.id!,
        title: "Cross-surface assigned Task",
        assignedUserId: owner.user!.id!,
        workflowStatusId: todoStatus.id,
        dueDate: "2026-06-03",
      });
      const createAssignedBody = (yield* Effect.promise(() => createAssignedResponse.json())) as {
        task?: { id: string; assignedUserId: string | null; taskState: string };
      };
      const assignedTask = createAssignedBody.task!;
      const createCancelableResponse = yield* postTool("create-task", {
        churchId: church.id!,
        title: "Cross-surface cancelable Task",
        workflowStatusId: todoStatus.id,
        dueDate: "2026-06-04",
      });
      const createCancelableBody = (yield* Effect.promise(() =>
        createCancelableResponse.json(),
      )) as { task?: { id: string } };
      const cancelableTask = createCancelableBody.task!;

      const publicMyWork = yield* authenticated.query(refs.public.tasks.listForChurch, {
        churchId: church.id!,
        surface: "my_work",
      });
      const assignCancelableResponse = yield* postTool("update-task", {
        churchId: church.id!,
        taskId: cancelableTask.id,
        assignedUserId: owner.user!.id!,
      });
      const assignCancelableBody = (yield* Effect.promise(() =>
        assignCancelableResponse.json(),
      )) as { task?: { id: string; assignedUserId: string | null } };
      const publicMyWorkAfterAssignment = yield* authenticated.query(
        refs.public.tasks.listForChurch,
        {
          churchId: church.id!,
          surface: "my_work",
        },
      );
      const moved = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: assignedTask.id, fields: { workflowStatusId: doingStatus.id } }],
      });
      const mcpListAfterMoveResponse = yield* postTool("list-tasks", {
        churchId: church.id!,
        surface: "my_work",
        workflowStatusId: doingStatus.id,
      });
      const mcpListAfterMoveBody = (yield* Effect.promise(() =>
        mcpListAfterMoveResponse.json(),
      )) as { tasks?: Array<{ id: string; taskState: string; workflowStatusId: string }> };
      const completed = yield* authenticated.mutation(refs.public.tasks.completeBatch, {
        churchId: church.id!,
        taskIds: [assignedTask.id],
      });
      const cancelResponse = yield* postTool("cancel-task", {
        churchId: church.id!,
        taskId: cancelableTask.id,
      });
      const cancelBody = (yield* Effect.promise(() => cancelResponse.json())) as {
        task?: { id: string; taskState: string; finishedAt: string | null };
      };
      const reopenResponse = yield* postTool("reopen-task", {
        churchId: church.id!,
        taskId: cancelableTask.id,
      });
      const reopenBody = (yield* Effect.promise(() => reopenResponse.json())) as {
        task?: { id: string; taskState: string; finishedAt: string | null };
      };
      const completedTask = completed.data.tasks.find((task) => task.id === assignedTask.id)!;
      const movedTask = moved.data.tasks.find((task) => task.id === assignedTask.id)!;
      const assignedActivities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "task",
        entityId: assignedTask.id,
      });
      const cancelActivities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "task",
        entityId: cancelableTask.id,
      });

      expect(createAssignedResponse.status).toBe(200);
      expect(createAssignedBody).toMatchObject({
        ok: true,
        tool: "create_task",
        task: expect.objectContaining({
          id: assignedTask.id,
          assignedUserId: owner.user!.id!,
          taskState: "todo",
        }),
      });
      expect(publicMyWork.data.tasks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: assignedTask.id, assignedUserId: owner.user!.id! }),
        ]),
      );
      expect(assignCancelableResponse.status).toBe(200);
      expect(assignCancelableBody).toMatchObject({
        ok: true,
        tool: "update_task",
        task: expect.objectContaining({
          id: cancelableTask.id,
          assignedUserId: owner.user!.id!,
        }),
      });
      expect(publicMyWorkAfterAssignment.data.tasks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: cancelableTask.id, assignedUserId: owner.user!.id! }),
        ]),
      );
      expect(movedTask).toMatchObject({
        id: assignedTask.id,
        workflowStatusId: doingStatus.id,
        taskState: "in_progress",
      });
      expect(mcpListAfterMoveResponse.status).toBe(200);
      expect(mcpListAfterMoveBody.tasks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: assignedTask.id,
            workflowStatusId: doingStatus.id,
            taskState: "in_progress",
          }),
        ]),
      );
      expect(completedTask).toMatchObject({ id: assignedTask.id, taskState: "done" });
      expect(completedTask.finishedAt).toEqual(expect.any(String));
      expect(cancelResponse.status).toBe(200);
      expect(cancelBody.task).toMatchObject({ id: cancelableTask.id, taskState: "canceled" });
      expect(cancelBody.task!.finishedAt).toEqual(expect.any(String));
      expect(reopenResponse.status).toBe(200);
      expect(reopenBody.task).toMatchObject({
        id: cancelableTask.id,
        taskState: "todo",
        finishedAt: null,
      });
      expect(assignedActivities.data.activities.map((activity) => activity.eventType)).toEqual([
        "task.created",
        "task.status_moved",
        "task.completed",
      ]);
      expect(assignedActivities.data.activities.map((activity) => activity.actorId)).toEqual([
        owner.user!.id!,
        owner.user!.id!,
        owner.user!.id!,
      ]);
      expect(cancelActivities.data.activities.map((activity) => activity.eventType)).toEqual([
        "task.created",
        "task.user_assigned",
        "task.canceled",
        "task.reopened",
      ]);
      expect(cancelActivities.data.activities.map((activity) => activity.actorId)).toEqual([
        owner.user!.id!,
        owner.user!.id!,
        owner.user!.id!,
        owner.user!.id!,
      ]);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("MCP task tools create, read, list, and expose execution lookups", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `mcp-task-surface-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const owner = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: owner.token!,
        name: "MCP Task Surface Church",
        slug: `mcp-task-surface-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: owner.user!.id!,
        sessionToken: owner.token!,
      });
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const todoStatus = defaults.data.workflowStatuses.find(
        (status) => status.taskState === "todo",
      )!;
      const postTool = (toolPath: string, body: Record<string, unknown>) =>
        c.fetch(`/api/mcp/tools/${toolPath}`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${owner.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });

      const createResponse = yield* postTool("create-task", {
        churchId: church.id!,
        title: "Create from MCP",
        assignedUserId: owner.user!.id!,
        workflowStatusId: todoStatus.id,
        dueDate: "2026-06-03",
      });
      const createBody = (yield* Effect.promise(() => createResponse.json())) as {
        task?: { id: string; title: string; assignedUserId: string };
      };
      const createdTask = createBody.task!;
      const listResponse = yield* postTool("list-tasks", {
        churchId: church.id!,
        surface: "my_work",
        assignedUserId: owner.user!.id!,
        workflowStatusId: todoStatus.id,
        taskState: "todo",
      });
      const listBody = (yield* Effect.promise(() => listResponse.json())) as unknown;
      const getResponse = yield* postTool("get-task", {
        churchId: church.id!,
        taskId: createdTask.id,
      });
      const getBody = (yield* Effect.promise(() => getResponse.json())) as unknown;
      const usersResponse = yield* postTool("list-users", { churchId: church.id! });
      const usersBody = (yield* Effect.promise(() => usersResponse.json())) as unknown;
      const teamsResponse = yield* postTool("list-teams", { churchId: church.id! });
      const teamsBody = (yield* Effect.promise(() => teamsResponse.json())) as {
        teams?: Array<{ name: string }>;
      };
      const cyclesResponse = yield* postTool("list-cycles", { churchId: church.id! });
      const cyclesBody = (yield* Effect.promise(() => cyclesResponse.json())) as unknown;
      const statusesResponse = yield* postTool("list-workflow-statuses", { churchId: church.id! });
      const statusesBody = (yield* Effect.promise(() => statusesResponse.json())) as {
        workflowStatuses?: Array<{ id: string; taskState: string }>;
      };

      expect(createResponse.status).toBe(200);
      expect(createBody).toMatchObject({
        ok: true,
        tool: "create_task",
        task: expect.objectContaining({
          id: createdTask.id,
          title: "Create from MCP",
          assignedUserId: owner.user!.id!,
        }),
      });
      expect(createBody).not.toHaveProperty("result");
      expect(createBody.task).not.toHaveProperty("sourceTemplateId");
      expect(listResponse.status).toBe(200);
      expect(listBody).toMatchObject({
        ok: true,
        tool: "list_tasks",
        tasks: [expect.objectContaining({ id: createdTask.id, title: "Create from MCP" })],
      });
      expect(getResponse.status).toBe(200);
      expect(getBody).toMatchObject({
        ok: true,
        tool: "get_task",
        task: expect.objectContaining({ id: createdTask.id }),
      });
      expect(usersResponse.status).toBe(200);
      expect(usersBody).toMatchObject({
        ok: true,
        tool: "list_users",
        users: [expect.objectContaining({ id: owner.user!.id!, email })],
      });
      expect(teamsResponse.status).toBe(200);
      expect(teamsBody).toMatchObject({
        ok: true,
        tool: "list_teams",
      });
      expect(teamsBody.teams).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "Worship" })]),
      );
      expect(cyclesResponse.status).toBe(200);
      expect(cyclesBody).toMatchObject({
        ok: true,
        tool: "list_cycles",
        cycles: [expect.objectContaining({ id: expect.any(String), startDate: "2026-06-01" })],
      });
      expect(statusesResponse.status).toBe(200);
      expect(statusesBody).toMatchObject({
        ok: true,
        tool: "list_workflow_statuses",
      });
      expect(statusesBody.workflowStatuses).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: todoStatus.id, taskState: "todo" })]),
      );
    }).pipe(Effect.provide(TestConfect.layer())),
  );
});
