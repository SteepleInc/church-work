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
        result: {
          ok: true,
          operation: "updateTasks",
          data: {
            tasks: expect.arrayContaining([
              expect.objectContaining({ id: task.id, assignedUserId: owner.user!.id! }),
            ]),
          },
        },
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
          result?: {
            data?: { tasks?: Array<{ id: string; taskState: string; finishedAt: string | null }> };
          };
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
          result: { ok: true, operation: "completeTasks" },
        });
        expect(cancelResponse.status).toBe(200);
        expect(cancelBody).toMatchObject({
          ok: true,
          tool: "cancel_task",
          result: { ok: true, operation: "cancelTasks" },
        });
        expect(reopenResponse.status).toBe(200);
        expect(reopenBody).toMatchObject({
          ok: true,
          tool: "reopen_task",
          result: { ok: true, operation: "reopenTasks" },
        });
        expect(
          reopenBody.result!.data!.tasks!.find((task) => task.id === completeTask.id),
        ).toMatchObject({ taskState: "done", finishedAt: expect.any(String) });
        expect(
          reopenBody.result!.data!.tasks!.find((task) => task.id === cancelTask.id),
        ).toMatchObject({
          taskState: "todo",
          finishedAt: null,
        });
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
});
