import { createAuth } from "@church-work/auth";
import {
  activities,
  cycles,
  invitation,
  tasks,
  template_schedules,
  template_tasks,
  templates,
  teams,
  workflow_statuses,
} from "@church-work/db/schema";
import { startPostgresHarness } from "@church-work/test-harness";
import { and, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { createTracerApi } from "./tracer-api";

const getCookieHeader = (response: Response) => {
  const setCookie = response.headers.get("set-cookie");

  if (!setCookie) {
    throw new Error("Expected Better Auth to set a session cookie");
  }

  return setCookie;
};

describe("tracer API", () => {
  test("captures email OTPs through the local Better Auth route", async () => {
    const harness = await startPostgresHarness();
    const api = createTracerApi(harness.connectionString);

    try {
      const email = "new-stack-otp@church-work.test";
      const sendResponse = await api.fetch(
        new Request("http://127.0.0.1/api/auth/email-otp/send-verification-otp", {
          body: JSON.stringify({ email, type: "sign-in" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );

      expect(sendResponse.ok).toBe(true);

      const otpResponse = await api.fetch(
        new Request(`http://127.0.0.1/api/test/otp?email=${encodeURIComponent(email)}`),
      );
      const body = (await otpResponse.json()) as { otp?: string | null };

      expect(otpResponse.ok).toBe(true);
      expect(body.otp).toMatch(/^\d{6}$/);
    } finally {
      await api.close();
      await harness.stop();
    }
  }, 60_000);

  test("creates a demo item through the signed-in Zero mutator path", async () => {
    const harness = await startPostgresHarness();
    const api = createTracerApi(harness.connectionString);
    const authRuntime = createAuth(harness.connectionString);

    try {
      const signUp = await authRuntime.auth.api.signUpEmail({
        asResponse: true,
        body: {
          email: "zero-foundation@church-work.test",
          name: "Zero Foundation User",
          password: "correct horse battery staple",
        },
      });
      const cookie = getCookieHeader(signUp);

      const response = await api.fetch(
        new Request("http://127.0.0.1/api/tracer/demo-items", {
          body: JSON.stringify({ name: "Zero mutator tracer" }),
          headers: {
            "content-type": "application/json",
            cookie,
          },
          method: "POST",
        }),
      );

      expect(response.ok).toBe(true);
      const body = (await response.json()) as {
        item?: {
          created_by?: string | null;
          id?: string;
          name?: string;
          owner_user_id?: string | null;
        };
      };

      expect(body.item?.id).toMatch(/^demoitem_/);
      expect(body.item?.name).toBe("Zero mutator tracer");
      expect(body.item?.created_by).toMatch(/^user_/);
      expect(body.item?.owner_user_id).toBe(body.item?.created_by);

      const queryResponse = await api.fetch(
        new Request("http://127.0.0.1/api/zero/query", {
          body: JSON.stringify([
            "transform",
            [{ args: [], id: "demo-items-all", name: "demo_items.all" }],
          ]),
          headers: {
            "content-type": "application/json",
            cookie,
          },
          method: "POST",
        }),
      );
      const queryBody = (await queryResponse.json()) as {
        kind?: string;
        queries?: Array<{ error?: string; id?: string; name?: string }>;
      };

      expect(queryResponse.ok).toBe(true);
      expect(queryBody.kind).toBe("QueryResponse");
      expect(queryBody.queries).toEqual([
        expect.objectContaining({ id: "demo-items-all", name: "demo_items.all" }),
      ]);
      expect(queryBody.queries?.[0]?.error).toBeUndefined();
    } finally {
      await authRuntime.pool.end();
      await api.close();
      await harness.stop();
    }
  }, 60_000);

  test("rejects unauthenticated Zero mutator writes", async () => {
    const harness = await startPostgresHarness();
    const api = createTracerApi(harness.connectionString);

    try {
      const response = await api.fetch(
        new Request("http://127.0.0.1/api/tracer/demo-items", {
          body: JSON.stringify({ name: "Anonymous write" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({ error: "Authentication required." });
    } finally {
      await api.close();
      await harness.stop();
    }
  }, 60_000);

  test("creates a test invitation for the active Church", async () => {
    const harness = await startPostgresHarness();
    const api = createTracerApi(harness.connectionString);
    const authRuntime = createAuth(harness.connectionString);

    try {
      const signUp = await authRuntime.auth.api.signUpEmail({
        asResponse: true,
        body: {
          email: "inviter@church-work.test",
          name: "Invitation Test User",
          password: "correct horse battery staple",
        },
      });
      const cookie = getCookieHeader(signUp);

      const org = await authRuntime.auth.api.createOrganization({
        body: {
          churchTimeZone: "America/Chicago",
          name: "Invitation Test Church",
          slug: "invitation-test-church",
        },
        headers: new Headers({ cookie }),
      });

      expect(org?.id).toMatch(/^org_/);

      const response = await api.fetch(
        new Request("http://127.0.0.1/api/test/invitations", {
          body: JSON.stringify({ email: "Invitee@Church-Work.test", role: "admin" }),
          headers: {
            "content-type": "application/json",
            cookie,
          },
          method: "POST",
        }),
      );

      expect(response.ok).toBe(true);
      const body = (await response.json()) as { invitation?: { id?: string } };

      expect(body.invitation?.id).toMatch(/^churchinvitation_/);
      await expect(authRuntime.db.select().from(invitation)).resolves.toMatchObject([
        {
          email: "invitee@church-work.test",
          id: body.invitation?.id,
          organizationId: org?.id,
          role: "admin",
          status: "pending",
        },
      ]);
    } finally {
      await authRuntime.pool.end();
      await api.close();
      await harness.stop();
    }
  }, 60_000);

  test("creates a completed-onboarding test session", async () => {
    const harness = await startPostgresHarness();
    const api = createTracerApi(harness.connectionString);

    try {
      const response = await api.fetch(
        new Request("http://127.0.0.1/api/test/session", {
          body: JSON.stringify({
            churchName: "Fast Session Church",
            email: "fast-session@church-work.test",
            userName: "Fast Session User",
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );

      expect(response.ok).toBe(true);
      expect(response.headers.get("set-cookie")).toContain("better-auth.session_token");

      const cookie = getCookieHeader(response);
      const sessionResponse = await api.fetch(
        new Request("http://127.0.0.1/api/auth/get-session", { headers: { cookie } }),
      );
      const sessionBody = (await sessionResponse.json()) as {
        session?: { activeOrganizationId?: string; orgCompletedOnboarding?: boolean };
        user?: { email?: string; name?: string };
      };

      expect(sessionBody.user).toMatchObject({
        email: "fast-session@church-work.test",
        name: "Fast Session User",
      });
      expect(sessionBody.session?.activeOrganizationId).toMatch(/^org_/);
      expect(sessionBody.session?.orgCompletedOnboarding).toBe(true);
    } finally {
      await api.close();
      await harness.stop();
    }
  }, 60_000);

  test("returns structured Active Church auth errors for unauthenticated agent callers", async () => {
    const harness = await startPostgresHarness();
    const api = createTracerApi(harness.connectionString);

    try {
      const response = await api.fetch(
        new Request("http://127.0.0.1/api/agent/active-church", {
          body: JSON.stringify({}),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "authentication_required",
          message: "Authentication required to resolve Active Church.",
        },
        ok: false,
        operation: "activeChurch",
      });
    } finally {
      await api.close();
      await harness.stop();
    }
  }, 60_000);

  test("serves agent and MCP operations through the new Drizzle-backed HTTP API", async () => {
    const harness = await startPostgresHarness();
    const api = createTracerApi(harness.connectionString);
    const authRuntime = createAuth(harness.connectionString);

    try {
      const signUp = await authRuntime.auth.api.signUpEmail({
        asResponse: true,
        body: {
          email: "agent-api@church-work.test",
          name: "Agent API User",
          password: "correct horse battery staple",
        },
      });
      const cookie = getCookieHeader(signUp);

      const org = await authRuntime.auth.api.createOrganization({
        body: {
          churchTimeZone: "America/New_York",
          name: "Agent API Church",
          slug: `agent-api-${crypto.randomUUID()}`,
        },
        headers: new Headers({ cookie }),
      });
      expect(org?.id).toMatch(/^org_/);

      const currentUserResponse = await api.fetch(
        new Request("http://127.0.0.1/api/agent/current-user", { headers: { cookie } }),
      );
      await expect(currentUserResponse.json()).resolves.toMatchObject({
        data: { user: { email: "agent-api@church-work.test", name: "Agent API User" } },
        ok: true,
        operation: "currentUser",
      });

      const createApiKeyResponse = await api.fetch(
        new Request("http://127.0.0.1/api/auth/api-key/create", {
          body: JSON.stringify({ name: "Agent CLI Test Credential" }),
          headers: { "content-type": "application/json", cookie },
          method: "POST",
        }),
      );
      expect(createApiKeyResponse.ok).toBe(true);
      const createdApiKey = (await createApiKeyResponse.json()) as { id?: string; key?: string };
      expect(createdApiKey.id).toMatch(/^apikey_/);
      expect(createdApiKey.key).toMatch(/^ctcli_/);

      const apiKeyCurrentUserResponse = await api.fetch(
        new Request("http://127.0.0.1/api/agent/current-user", {
          headers: { authorization: `Bearer ${createdApiKey.key}` },
        }),
      );
      await expect(apiKeyCurrentUserResponse.json()).resolves.toMatchObject({
        data: { user: { email: "agent-api@church-work.test", name: "Agent API User" } },
        ok: true,
        operation: "currentUser",
      });

      const activeChurchResponse = await api.fetch(
        new Request("http://127.0.0.1/api/agent/active-church", {
          body: JSON.stringify({ churchId: org?.id }),
          headers: { "content-type": "application/json", cookie },
          method: "POST",
        }),
      );
      await expect(activeChurchResponse.json()).resolves.toMatchObject({
        data: {
          activeChurch: { id: org?.id, name: "Agent API Church" },
          membership: { role: "owner" },
          status: "activeChurchReady",
        },
        ok: true,
        operation: "activeChurch",
      });

      const missingChurchResponse = await api.fetch(
        new Request("http://127.0.0.1/api/agent/active-church", {
          body: JSON.stringify({ churchId: "org_missing" }),
          headers: { "content-type": "application/json", cookie },
          method: "POST",
        }),
      );
      expect(missingChurchResponse.status).toBe(404);
      await expect(missingChurchResponse.json()).resolves.toMatchObject({
        error: { code: "church_not_found", message: "Requested Church was not found." },
        ok: false,
        operation: "activeChurch",
      });

      const batchReadResponse = await api.fetch(
        new Request("http://127.0.0.1/api/agent/core-work/batch-read", {
          body: JSON.stringify({
            operations: [
              { id: "teams", input: { churchId: org?.id }, operation: "listTeams" },
              {
                id: "work-defaults",
                input: { churchId: org?.id },
                operation: "readWorkDefaults",
              },
            ],
          }),
          headers: { "content-type": "application/json", cookie },
          method: "POST",
        }),
      );
      const batchRead = (await batchReadResponse.json()) as {
        results?: Array<{ id?: string; result?: { data?: { teams?: unknown[] } } }>;
      };
      expect(batchRead.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "teams" }),
          expect.objectContaining({ id: "work-defaults" }),
        ]),
      );

      const [team] = await authRuntime.db
        .select()
        .from(teams)
        .where(eq(teams.church_id, org!.id))
        .limit(1);
      const [todoStatus] = await authRuntime.db
        .select()
        .from(workflow_statuses)
        .where(
          and(eq(workflow_statuses.church_id, org!.id), eq(workflow_statuses.task_state, "todo")),
        )
        .limit(1);
      const [doingStatus] = await authRuntime.db
        .select()
        .from(workflow_statuses)
        .where(
          and(
            eq(workflow_statuses.church_id, org!.id),
            eq(workflow_statuses.task_state, "in_progress"),
          ),
        )
        .limit(1);
      const [doneStatus] = await authRuntime.db
        .select()
        .from(workflow_statuses)
        .where(
          and(eq(workflow_statuses.church_id, org!.id), eq(workflow_statuses.task_state, "done")),
        )
        .limit(1);
      const [canceledStatus] = await authRuntime.db
        .select()
        .from(workflow_statuses)
        .where(
          and(
            eq(workflow_statuses.church_id, org!.id),
            eq(workflow_statuses.task_state, "canceled"),
          ),
        )
        .limit(1);
      expect(team?.id).toMatch(/^team_/);
      expect(todoStatus?.id).toMatch(/^workflowstatus_/);
      expect(doingStatus?.id).toMatch(/^workflowstatus_/);
      expect(doneStatus?.id).toMatch(/^workflowstatus_/);
      expect(canceledStatus?.id).toMatch(/^workflowstatus_/);

      const createTaskResponse = await api.fetch(
        new Request("http://127.0.0.1/api/mcp/tools/create-task", {
          body: JSON.stringify({
            churchId: org?.id,
            dueDate: "2026-06-03",
            teamId: team!.id,
            title: "Create from new MCP",
            workflowStatusId: todoStatus!.id,
          }),
          headers: { "content-type": "application/json", cookie },
          method: "POST",
        }),
      );
      expect(createTaskResponse.ok).toBe(true);
      const created = (await createTaskResponse.json()) as { task?: { id?: string } };
      expect(created.task?.id).toMatch(/^task_/);

      const updateTaskResponse = await api.fetch(
        new Request("http://127.0.0.1/api/mcp/tools/update-task", {
          body: JSON.stringify({
            churchId: org?.id,
            taskId: created.task?.id,
            workflowStatusId: doingStatus!.id,
          }),
          headers: { "content-type": "application/json", cookie },
          method: "POST",
        }),
      );
      await expect(updateTaskResponse.json()).resolves.toMatchObject({
        ok: true,
        task: { id: created.task?.id, taskState: "in_progress", workflowStatusId: doingStatus!.id },
      });

      const completeTaskResponse = await api.fetch(
        new Request("http://127.0.0.1/api/mcp/tools/complete-task", {
          body: JSON.stringify({ churchId: org?.id, taskIdentifier: `${team!.identifier}-1` }),
          headers: { "content-type": "application/json", cookie },
          method: "POST",
        }),
      );
      await expect(completeTaskResponse.json()).resolves.toMatchObject({
        ok: true,
        task: { id: created.task?.id, taskState: "done", workflowStatusId: doneStatus!.id },
      });

      const reopenTaskResponse = await api.fetch(
        new Request("http://127.0.0.1/api/mcp/tools/reopen-task", {
          body: JSON.stringify({ churchId: org?.id, taskId: created.task?.id }),
          headers: { "content-type": "application/json", cookie },
          method: "POST",
        }),
      );
      await expect(reopenTaskResponse.json()).resolves.toMatchObject({
        ok: true,
        task: { id: created.task?.id, taskState: "todo", workflowStatusId: todoStatus!.id },
      });

      const cancelTaskResponse = await api.fetch(
        new Request("http://127.0.0.1/api/mcp/tools/cancel-task", {
          body: JSON.stringify({ churchId: org?.id, taskIdentifier: `${team!.identifier}-1` }),
          headers: { "content-type": "application/json", cookie },
          method: "POST",
        }),
      );
      await expect(cancelTaskResponse.json()).resolves.toMatchObject({
        ok: true,
        task: { id: created.task?.id, taskState: "canceled", workflowStatusId: canceledStatus!.id },
      });

      const reopenCanceledTaskResponse = await api.fetch(
        new Request("http://127.0.0.1/api/mcp/tools/reopen-task", {
          body: JSON.stringify({ churchId: org?.id, taskId: created.task?.id }),
          headers: { "content-type": "application/json", cookie },
          method: "POST",
        }),
      );
      await expect(reopenCanceledTaskResponse.json()).resolves.toMatchObject({
        ok: true,
        task: { id: created.task?.id, taskState: "todo", workflowStatusId: todoStatus!.id },
      });

      const listTasksResponse = await api.fetch(
        new Request("http://127.0.0.1/api/mcp/tools/list-tasks", {
          body: JSON.stringify({ churchId: org?.id }),
          headers: { "content-type": "application/json", cookie },
          method: "POST",
        }),
      );
      await expect(listTasksResponse.json()).resolves.toMatchObject({
        ok: true,
        tasks: [expect.objectContaining({ id: created.task?.id, title: "Create from new MCP" })],
      });

      const filteredTasksResponse = await api.fetch(
        new Request("http://127.0.0.1/api/mcp/tools/list-tasks", {
          body: JSON.stringify({
            churchId: org?.id,
            taskState: "todo",
            teamId: team!.id,
            workflowStatusId: todoStatus!.id,
          }),
          headers: { "content-type": "application/json", cookie },
          method: "POST",
        }),
      );
      await expect(filteredTasksResponse.json()).resolves.toMatchObject({
        ok: true,
        tasks: [expect.objectContaining({ id: created.task?.id })],
      });

      const templateCreateResponse = await api.fetch(
        new Request("http://127.0.0.1/api/mcp/tools/template-create-weekly-service", {
          body: JSON.stringify({
            churchId: org?.id,
            name: "Sunday Service",
            startDate: "2026-06-01",
            teamId: team!.id,
            weekday: 6,
          }),
          headers: { "content-type": "application/json", cookie },
          method: "POST",
        }),
      );
      expect(templateCreateResponse.ok).toBe(true);
      const templateCreated = (await templateCreateResponse.json()) as {
        template?: { id?: string };
        templateSchedule?: { id?: string };
      };
      expect(templateCreated.template?.id).toMatch(/^template_/);
      expect(templateCreated.templateSchedule?.id).toMatch(/^templateschedule_/);

      const templateTaskResponse = await api.fetch(
        new Request("http://127.0.0.1/api/mcp/tools/template-task-add-at-placement", {
          body: JSON.stringify({
            churchId: org?.id,
            cycleOffset: -1,
            teamId: team!.id,
            templateId: templateCreated.template?.id,
            title: "Prepare slides",
            weekday: 4,
          }),
          headers: { "content-type": "application/json", cookie },
          method: "POST",
        }),
      );
      const templateTaskCreated = (await templateTaskResponse.json()) as {
        templateTask?: { id?: string };
      };
      expect(templateTaskCreated.templateTask?.id).toMatch(/^templatetask_/);

      const [cycle] = await authRuntime.db
        .select()
        .from(cycles)
        .where(eq(cycles.church_id, org!.id))
        .limit(1);
      expect(cycle?.id).toMatch(/^cycle_/);

      const materializeResponse = await api.fetch(
        new Request("http://127.0.0.1/api/mcp/tools/projected-template-task-materialize", {
          body: JSON.stringify({
            churchId: org?.id,
            cycleId: cycle!.id,
            occurrenceKey: "2026-06-07",
            teamId: team!.id,
            templateId: templateCreated.template?.id,
            templateScheduleId: templateCreated.templateSchedule?.id,
            templateTaskId: templateTaskCreated.templateTask?.id,
            title: "Prepare slides",
            workflowStatusId: todoStatus!.id,
          }),
          headers: { "content-type": "application/json", cookie },
          method: "POST",
        }),
      );
      await expect(materializeResponse.json()).resolves.toMatchObject({
        deduped: false,
        ok: true,
        task: { title: "Prepare slides" },
      });

      await expect(authRuntime.db.select().from(tasks)).resolves.toHaveLength(2);
      await expect(authRuntime.db.select().from(templates)).resolves.toHaveLength(1);
      await expect(authRuntime.db.select().from(template_schedules)).resolves.toHaveLength(1);
      await expect(authRuntime.db.select().from(template_tasks)).resolves.toHaveLength(1);
      await expect(authRuntime.db.select().from(activities)).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ entity_id: created.task?.id, event_type: "task.created" }),
          expect.objectContaining({ entity_id: created.task?.id, event_type: "task.status_moved" }),
          expect.objectContaining({
            entity_id: templateCreated.template?.id,
            event_type: "template.created",
          }),
          expect.objectContaining({
            entity_id: templateTaskCreated.templateTask?.id,
            event_type: "template_task.created",
          }),
        ]),
      );

      const revokeApiKeyResponse = await api.fetch(
        new Request("http://127.0.0.1/api/auth/api-key/delete", {
          body: JSON.stringify({ keyId: createdApiKey.id }),
          headers: {
            authorization: `Bearer ${createdApiKey.key}`,
            "content-type": "application/json",
          },
          method: "POST",
        }),
      );
      await expect(revokeApiKeyResponse.json()).resolves.toMatchObject({ success: true });

      const revokedApiKeyResponse = await api.fetch(
        new Request("http://127.0.0.1/api/agent/current-user", {
          headers: { authorization: `Bearer ${createdApiKey.key}` },
        }),
      );
      expect(revokedApiKeyResponse.ok).toBe(false);
    } finally {
      await authRuntime.pool.end();
      await api.close();
      await harness.stop();
    }
  }, 60_000);
});
