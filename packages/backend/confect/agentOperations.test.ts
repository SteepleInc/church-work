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
      name: "Agent Operation User",
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
  args: {
    readonly token: string;
    readonly name: string;
    readonly slug: string;
    readonly churchTimeZone?: string;
  },
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
      churchTimeZone: args.churchTimeZone ?? "America/New_York",
    }),
  });

const createTeam = (
  c: typeof TestConfect.TestConfect.Service,
  args: {
    readonly token: string;
    readonly name: string;
    readonly organizationId: string;
  },
) =>
  c.fetch("/api/auth/organization/create-team", {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: args.name,
      organizationId: args.organizationId,
    }),
  });

describe("agent operation boundary", () => {
  it.effect("currentUser returns the stable typed response shape", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;

      const result = yield* c.query(refs.public.agent.currentUser);

      expect(result).toEqual({
        ok: true,
        operation: "currentUser",
        data: { user: null },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("currentUser returns authenticated User identity through the typed boundary", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-operation-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const tokenResponse = yield* c.fetch("/api/auth/convex/token", {
        method: "GET",
        headers: { authorization: `Bearer ${signUpBody.token}` },
      });
      const tokenBody = (yield* Effect.promise(() => tokenResponse.json())) as { token?: string };
      const tokenPayload = decodeJwtPayload(tokenBody.token!);

      const authenticated = c.withIdentity({
        subject: signUpBody.user!.id!,
        sessionId: tokenPayload.sessionId!,
      });
      const result = yield* authenticated.query(refs.public.agent.currentUser);

      expect(result).toEqual({
        ok: true,
        operation: "currentUser",
        data: {
          user: {
            id: signUpBody.user!.id,
            email,
            name: "Agent Operation User",
          },
        },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("batchRead returns stable per-operation currentUser results", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;

      const result = yield* c.query(refs.public.agent.batchRead, {
        operations: [
          {
            id: "read-current-user",
            operation: "currentUser",
            input: {},
          },
        ],
      });

      expect(result).toEqual({
        ok: true,
        operation: "batchRead",
        results: [
          {
            id: "read-current-user",
            ok: true,
            operation: "currentUser",
            data: { user: null },
          },
        ],
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect(
    "activeChurch returns a clear no Active Church result for an authenticated User with no Church Membership",
    () =>
      Effect.gen(function* () {
        const c = yield* TestConfect.TestConfect;
        const email = `agent-no-active-church-${crypto.randomUUID()}@example.com`;
        const signUpResponse = yield* signUpWithEmail(c, email);
        const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
          user?: { id?: string };
          token?: string;
        };
        const authenticated = yield* authenticatedConfect(c, {
          userId: signUpBody.user!.id!,
          sessionToken: signUpBody.token!,
        });

        const result = yield* authenticated.query(refs.public.agent.activeChurch, {
          churchId: null,
        });

        expect(result).toEqual({
          ok: true,
          operation: "activeChurch",
          data: {
            status: "noActiveChurch",
            activeChurch: null,
            membership: null,
          },
        });
      }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect(
    "activeChurch resolves the persisted Active Church for a User with multiple Churches",
    () =>
      Effect.gen(function* () {
        const c = yield* TestConfect.TestConfect;
        const email = `agent-active-church-${crypto.randomUUID()}@example.com`;
        const signUpResponse = yield* signUpWithEmail(c, email);
        const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
          user?: { id?: string };
          token?: string;
        };

        const firstChurchResponse = yield* createChurch(c, {
          token: signUpBody.token!,
          name: "First Church",
          slug: `first-${crypto.randomUUID()}`,
        });
        const secondChurchResponse = yield* createChurch(c, {
          token: signUpBody.token!,
          name: "Second Church",
          slug: `second-${crypto.randomUUID()}`,
        });
        const secondChurch = (yield* Effect.promise(() => secondChurchResponse.json())) as {
          id?: string;
          slug?: string;
        };
        const authenticated = yield* authenticatedConfect(c, {
          userId: signUpBody.user!.id!,
          sessionToken: signUpBody.token!,
        });

        expect(firstChurchResponse.status).toBe(200);
        expect(secondChurchResponse.status).toBe(200);

        const result = yield* authenticated.query(refs.public.agent.activeChurch, {
          churchId: null,
        });

        expect(result).toEqual({
          ok: true,
          operation: "activeChurch",
          data: {
            status: "activeChurchReady",
            activeChurch: {
              id: secondChurch.id,
              name: "Second Church",
              slug: secondChurch.slug,
              churchTimeZone: "America/New_York",
            },
            membership: { role: "owner" },
          },
        });
      }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Church creation persists a validated Church Time Zone", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-church-time-zone-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Time Zone Church",
        slug: `time-zone-${crypto.randomUUID()}`,
        churchTimeZone: "America/Los_Angeles",
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as {
        id?: string;
        slug?: string;
        churchTimeZone?: string;
      };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      expect(churchResponse.status).toBe(200);
      expect(church.churchTimeZone).toBe("America/Los_Angeles");

      const result = yield* authenticated.query(refs.public.agent.activeChurch, {
        churchId: church.id!,
      });

      expect(result).toEqual({
        ok: true,
        operation: "activeChurch",
        data: {
          status: "activeChurchReady",
          activeChurch: {
            id: church.id,
            name: "Time Zone Church",
            slug: church.slug,
            churchTimeZone: "America/Los_Angeles",
          },
          membership: { role: "owner" },
        },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Church creation seeds the default work model", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-work-defaults-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Seeded Church",
        slug: `seeded-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      const result = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });

      expect(result.ok).toBe(true);
      expect(result.data.workflows).toMatchObject([
        {
          key: "church-default",
          name: "Default Workflow",
          isDefault: true,
          sortOrder: 0,
          archivedAt: null,
        },
      ]);
      expect(result.data.workflowStatuses.map((status) => [status.key, status.taskState])).toEqual([
        ["to-do", "todo"],
        ["in-progress", "in_progress"],
        ["done", "done"],
      ]);
      expect(result.data.keyDates.map((keyDate) => keyDate.key)).toEqual([
        "christmas",
        "easter",
        "palm-sunday",
        "pentecost",
        "mothers-day",
        "fathers-day",
      ]);
      expect(result.data.keyDates.every((keyDate) => keyDate.archivedAt === null)).toBe(true);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("default work model seeding is idempotent", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-work-defaults-idempotent-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Idempotent Seed Church",
        slug: `idempotent-seed-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      yield* authenticated.mutation(refs.public.workDefaults.seedForChurch, {
        churchId: church.id!,
      });
      const result = yield* authenticated.mutation(refs.public.workDefaults.seedForChurch, {
        churchId: church.id!,
      });

      expect(result.data.workflows).toHaveLength(1);
      expect(result.data.workflowStatuses).toHaveLength(3);
      expect(result.data.keyDates).toHaveLength(6);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Better Auth Teams can be created and updated through Team product fields", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-team-product-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Team Product Church",
        slug: `team-product-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const teamResponse = yield* createTeam(c, {
        token: signUpBody.token!,
        name: "Worship Team",
        organizationId: church.id!,
      });
      const team = (yield* Effect.promise(() => teamResponse.json())) as {
        id?: string;
        name?: string;
        organizationId?: string;
      };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      expect(teamResponse.status).toBe(200);
      expect(team).toMatchObject({
        name: "Worship Team",
        organizationId: church.id,
      });

      const initialRead = yield* authenticated.query(refs.public.teams.listForChurch, {
        churchId: church.id!,
      });

      expect(initialRead).toEqual({
        ok: true,
        operation: "listTeams",
        data: {
          teams: [
            {
              id: team.id,
              name: "Worship Team",
              churchId: church.id,
              archivedAt: null,
              sortOrder: 0,
              defaultWorkflowId: null,
            },
          ],
        },
      });

      const updated = yield* authenticated.mutation(refs.public.teams.updateProductFields, {
        churchId: church.id!,
        updates: [
          {
            teamId: team.id!,
            fields: {
              archivedAt: "2026-06-01T00:00:00.000Z",
              sortOrder: 7,
              defaultWorkflowId: "workflow-default",
            },
          },
        ],
      });

      expect(updated).toEqual({
        ok: true,
        operation: "updateTeamProductFields",
        data: {
          teams: [
            {
              id: team.id,
              name: "Worship Team",
              churchId: church.id,
              archivedAt: "2026-06-01T00:00:00.000Z",
              sortOrder: 7,
              defaultWorkflowId: "workflow-default",
            },
          ],
        },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Activity registry records typed Activity metadata", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-activity-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Activity Church",
        slug: `activity-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const taskId = `task-${crypto.randomUUID()}`;

      const result = yield* authenticated.mutation(refs.public.activities.recordForChurch, {
        churchId: church.id!,
        entityType: "task",
        entityId: taskId,
        eventType: "task.canceled",
        actorType: "user",
        actorId: signUpBody.user!.id!,
        occurredAt: "2026-05-31T12:00:00.000Z",
        cycleId: null,
        metadata: {
          previousTaskState: "in_progress",
          previousWorkflowStatusId: "workflow-status-1",
          previousWorkflowStatusName: "In Progress",
        },
      });

      expect(result).toMatchObject({
        ok: true,
        operation: "recordActivity",
        data: {
          activity: {
            churchId: church.id,
            entityType: "task",
            entityId: taskId,
            eventType: "task.canceled",
            actorType: "user",
            actorId: signUpBody.user!.id,
            occurredAt: "2026-05-31T12:00:00.000Z",
            cycleId: null,
            metadata: {
              previousTaskState: "in_progress",
              previousWorkflowStatusId: "workflow-status-1",
              previousWorkflowStatusName: "In Progress",
            },
          },
        },
      });
      expect(result.data.activity.id).toEqual(expect.any(String));
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Activity registry rejects invalid metadata before insert", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-invalid-activity-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Invalid Activity Church",
        slug: `invalid-activity-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const taskId = `task-${crypto.randomUUID()}`;

      const invalidResult = yield* authenticated.mutation(refs.public.activities.recordForChurch, {
        churchId: church.id!,
        entityType: "task",
        entityId: taskId,
        eventType: "task.canceled",
        actorType: "user",
        actorId: signUpBody.user!.id!,
        occurredAt: "2026-05-31T12:00:00.000Z",
        cycleId: null,
        metadata: {
          previousTaskState: "canceled",
          previousWorkflowStatusId: "workflow-status-1",
          previousWorkflowStatusName: "In Progress",
        },
      });
      const result = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "task",
        entityId: taskId,
      });

      expect(invalidResult).toEqual({
        ok: false,
        operation: "recordActivity",
        error: {
          code: "invalid_activity_metadata",
          message: "Activity metadata does not match the registered event schema.",
        },
      });
      expect(result.data.activities).toEqual([]);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Activity reads are scoped to the requested entity", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-activity-scope-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Activity Scope Church",
        slug: `activity-scope-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const matchingTaskId = `task-${crypto.randomUUID()}`;
      const otherTaskId = `task-${crypto.randomUUID()}`;

      yield* authenticated.mutation(refs.public.activities.recordForChurch, {
        churchId: church.id!,
        entityType: "task",
        entityId: matchingTaskId,
        eventType: "task.created",
        actorType: "user",
        actorId: signUpBody.user!.id!,
        occurredAt: "2026-05-31T12:00:00.000Z",
        cycleId: null,
        metadata: {},
      });
      yield* authenticated.mutation(refs.public.activities.recordForChurch, {
        churchId: church.id!,
        entityType: "task",
        entityId: otherTaskId,
        eventType: "task.created",
        actorType: "user",
        actorId: signUpBody.user!.id!,
        occurredAt: "2026-05-31T12:01:00.000Z",
        cycleId: null,
        metadata: {},
      });

      const result = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "task",
        entityId: matchingTaskId,
      });

      expect(result.data.activities).toHaveLength(1);
      expect(result.data.activities[0]!.entityId).toBe(matchingTaskId);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Activity metadata supports targeted restore for canceled Tasks", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-activity-restore-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Activity Restore Church",
        slug: `activity-restore-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const taskId = `task-${crypto.randomUUID()}`;
      const cancel = yield* authenticated.mutation(refs.public.activities.recordForChurch, {
        churchId: church.id!,
        entityType: "task",
        entityId: taskId,
        eventType: "task.canceled",
        actorType: "user",
        actorId: signUpBody.user!.id!,
        occurredAt: "2026-05-31T12:00:00.000Z",
        cycleId: "cycle-1",
        metadata: {
          previousTaskState: "todo",
          previousWorkflowStatusId: "workflow-status-to-do",
          previousWorkflowStatusName: "To Do",
        },
      });

      const reopen = yield* authenticated.mutation(refs.public.activities.recordForChurch, {
        churchId: church.id!,
        entityType: "task",
        entityId: taskId,
        eventType: "task.reopened",
        actorType: "user",
        actorId: signUpBody.user!.id!,
        occurredAt: "2026-05-31T12:05:00.000Z",
        cycleId: "cycle-1",
        metadata: {
          restoredTaskState: "todo",
          restoredWorkflowStatusId: "workflow-status-to-do",
          cancelActivityId: cancel.data.activity.id,
        },
      });

      expect(reopen.data.activity.metadata).toEqual({
        restoredTaskState: "todo",
        restoredWorkflowStatusId: "workflow-status-to-do",
        cancelActivityId: cancel.data.activity.id,
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Church creation rejects an invalid Church Time Zone", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-invalid-church-time-zone-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Invalid Time Zone Church",
        slug: `invalid-time-zone-${crypto.randomUUID()}`,
        churchTimeZone: "Not/A_Zone",
      });
      const body = (yield* Effect.promise(() => churchResponse.json())) as { message?: string };

      expect(churchResponse.status).toBe(400);
      expect(body.message).toBe("Church Time Zone must be a valid IANA time zone.");
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("activeChurch blocks a requested Church where the User lacks Church Membership", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const firstUserEmail = `agent-church-member-${crypto.randomUUID()}@example.com`;
      const secondUserEmail = `agent-other-church-${crypto.randomUUID()}@example.com`;
      const firstUserResponse = yield* signUpWithEmail(c, firstUserEmail);
      const secondUserResponse = yield* signUpWithEmail(c, secondUserEmail);
      const firstUser = (yield* Effect.promise(() => firstUserResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const secondUser = (yield* Effect.promise(() => secondUserResponse.json())) as {
        token?: string;
      };
      const otherChurchResponse = yield* createChurch(c, {
        token: secondUser.token!,
        name: "Other Church",
        slug: `other-${crypto.randomUUID()}`,
      });
      const otherChurch = (yield* Effect.promise(() => otherChurchResponse.json())) as {
        id?: string;
      };
      const authenticated = yield* authenticatedConfect(c, {
        userId: firstUser.user!.id!,
        sessionToken: firstUser.token!,
      });

      const result = yield* authenticated.query(refs.public.agent.activeChurch, {
        churchId: otherChurch.id!,
      });

      expect(result).toEqual({
        ok: false,
        operation: "activeChurch",
        error: {
          code: "not_church_member",
          message: "User does not have Church Membership for requested Church.",
        },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("rejects invalid batch operation input at the typed boundary", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;

      const error = yield* c
        .query(refs.public.agent.batchRead, {
          operations: [
            {
              id: "invalid-operation",
              operation: "notARealOperation",
              input: {},
            },
          ],
        } as never)
        .pipe(Effect.flip);

      expect(error).toBeDefined();
    }).pipe(Effect.provide(TestConfect.layer())),
  );
});
