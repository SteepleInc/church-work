/// <reference types="vite/client" />

import { describe, it } from "@effect/vitest";
import { MutationCtx } from "@confect/server";
import { Effect, Schema } from "effect";
import { expect } from "vitest";

import type { DataModel } from "../convex/_generated/dataModel";
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

  it.effect("Workflow creation enforces required visible Task States", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-invalid-workflow-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Invalid Workflow Church",
        slug: `invalid-workflow-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      const missingDone = yield* authenticated.mutation(refs.public.workflows.createForChurch, {
        churchId: church.id!,
        key: "missing-done",
        name: "Missing Done",
        isDefault: false,
        sortOrder: 1,
        statuses: [
          { key: "todo", name: "To Do", taskState: "todo", sortOrder: 0 },
          { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 1 },
        ],
      });
      const canceledColumn = yield* authenticated.mutation(refs.public.workflows.createForChurch, {
        churchId: church.id!,
        key: "canceled-column",
        name: "Canceled Column",
        isDefault: false,
        sortOrder: 2,
        statuses: [
          { key: "todo", name: "To Do", taskState: "todo", sortOrder: 0 },
          { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 1 },
          { key: "review", name: "Review", taskState: "in_progress", sortOrder: 2 },
          { key: "done", name: "Done", taskState: "done", sortOrder: 3 },
          { key: "canceled", name: "Canceled", taskState: "canceled", sortOrder: 3 },
        ],
      });

      expect(missingDone).toMatchObject({
        ok: false,
        operation: "createWorkflow",
        error: { code: "invalid_workflow" },
      });
      expect(canceledColumn).toMatchObject({
        ok: false,
        operation: "createWorkflow",
        error: {
          code: "invalid_workflow",
          message: "Canceled is a Task State, not a visible Workflow Status.",
        },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Workflow creation enforces active status names and ordering", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-status-uniqueness-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Status Uniqueness Church",
        slug: `status-unique-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      const duplicateName = yield* authenticated.mutation(refs.public.workflows.createForChurch, {
        churchId: church.id!,
        key: "duplicate-name",
        name: "Duplicate Name",
        isDefault: false,
        sortOrder: 1,
        statuses: [
          { key: "todo", name: "Same", taskState: "todo", sortOrder: 0 },
          { key: "doing", name: "same", taskState: "in_progress", sortOrder: 1 },
          { key: "done", name: "Done", taskState: "done", sortOrder: 2 },
        ],
      });
      const duplicateSort = yield* authenticated.mutation(refs.public.workflows.createForChurch, {
        churchId: church.id!,
        key: "duplicate-sort",
        name: "Duplicate Sort",
        isDefault: false,
        sortOrder: 2,
        statuses: [
          { key: "todo", name: "To Do", taskState: "todo", sortOrder: 0 },
          { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 0 },
          { key: "done", name: "Done", taskState: "done", sortOrder: 2 },
        ],
      });

      expect(duplicateName).toMatchObject({
        ok: false,
        error: { message: "Active Workflow Status names must be unique within a Workflow." },
      });
      expect(duplicateSort).toMatchObject({
        ok: false,
        error: {
          message: "Workflow Status sort orders must be explicit and unique within a Workflow.",
        },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Workflow mutations write Activities", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-workflow-activity-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Workflow Activity Church",
        slug: `workflow-activity-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      const created = yield* authenticated.mutation(refs.public.workflows.createForChurch, {
        churchId: church.id!,
        key: "activity-workflow",
        name: "Activity Workflow",
        isDefault: false,
        sortOrder: 1,
        statuses: [
          { key: "todo", name: "To Do", taskState: "todo", sortOrder: 0 },
          { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 1 },
          { key: "done", name: "Done", taskState: "done", sortOrder: 2 },
          { key: "ready", name: "Ready", taskState: "in_progress", sortOrder: 3 },
        ],
      });
      const workflow = created.data.workflows.find(
        (candidate) => candidate.key === "activity-workflow",
      )!;
      const readyStatus = created.data.workflowStatuses.find((status) => status.key === "ready")!;
      const todoStatus = created.data.workflowStatuses.find((status) => status.key === "todo")!;

      yield* authenticated.mutation(refs.public.workflows.archiveStatus, {
        churchId: church.id!,
        statusId: readyStatus.id,
        archivedAt: "2026-06-01T10:00:00.000Z",
      });
      const requiredStatusArchive = yield* authenticated.mutation(
        refs.public.workflows.archiveStatus,
        {
          churchId: church.id!,
          statusId: todoStatus.id,
          archivedAt: "2026-06-01T10:01:00.000Z",
        },
      );
      const workflowActivities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "workflow",
        entityId: workflow.id,
      });
      const statusActivities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "workflow",
        entityId: readyStatus.id,
      });

      expect(workflowActivities.data.activities.map((activity) => activity.eventType)).toContain(
        "workflow.created",
      );
      expect(requiredStatusArchive).toMatchObject({
        ok: false,
        operation: "archiveWorkflowStatus",
        error: { code: "invalid_workflow" },
      });
      expect(statusActivities.data.activities.map((activity) => activity.eventType)).toEqual([
        "workflow.status.created",
        "workflow.status.archived",
      ]);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Workflow Status archive is blocked while Tasks use the status", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-status-in-use-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Status In Use Church",
        slug: `status-in-use-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const workflow = defaults.data.workflows[0]!;
      const todoStatus = defaults.data.workflowStatuses.find(
        (status) => status.taskState === "todo",
      )!;

      yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();
          yield* Effect.promise(() =>
            ctx.db.insert("tasks", {
              churchId: church.id!,
              title: "Task using To Do",
              teamId: null,
              workflowId: workflow.id,
              workflowStatusId: todoStatus.id,
              taskState: "todo",
            }),
          );
        }),
      );

      const archived = yield* authenticated.mutation(refs.public.workflows.archiveStatus, {
        churchId: church.id!,
        statusId: todoStatus.id,
        archivedAt: "2026-06-01T10:00:00.000Z",
      });

      expect(archived).toEqual({
        ok: false,
        operation: "archiveWorkflowStatus",
        error: {
          code: "workflow_status_in_use",
          message: "Workflow Statuses with active Tasks cannot be archived before Tasks are moved.",
        },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Task Team changes remap Workflow Status by state and name before state fallback", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-task-team-remap-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Task Remap Church",
        slug: `task-remap-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const teamResponse = yield* createTeam(c, {
        token: signUpBody.token!,
        name: "Destination Team",
        organizationId: church.id!,
      });
      const team = (yield* Effect.promise(() => teamResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const source = yield* authenticated.mutation(refs.public.workflows.createForChurch, {
        churchId: church.id!,
        key: "source-workflow",
        name: "Source Workflow",
        isDefault: false,
        sortOrder: 1,
        statuses: [
          { key: "todo", name: "To Do", taskState: "todo", sortOrder: 0 },
          { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 1 },
          { key: "review", name: "Review", taskState: "in_progress", sortOrder: 2 },
          { key: "done", name: "Done", taskState: "done", sortOrder: 3 },
        ],
      });
      const destination = yield* authenticated.mutation(refs.public.workflows.createForChurch, {
        churchId: church.id!,
        key: "destination-workflow",
        name: "Destination Workflow",
        isDefault: false,
        sortOrder: 2,
        statuses: [
          { key: "todo", name: "To Do", taskState: "todo", sortOrder: 0 },
          { key: "ready", name: "Ready", taskState: "in_progress", sortOrder: 1 },
          { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 2 },
          { key: "done", name: "Done", taskState: "done", sortOrder: 3 },
        ],
      });
      const sourceWorkflow = source.data.workflows.find(
        (workflow) => workflow.key === "source-workflow",
      )!;
      const sourceDoing = source.data.workflowStatuses.find(
        (status) => status.workflowId === sourceWorkflow.id && status.key === "doing",
      )!;
      const sourceReview = source.data.workflowStatuses.find(
        (status) => status.workflowId === sourceWorkflow.id && status.key === "review",
      )!;
      const destinationWorkflow = destination.data.workflows.find(
        (workflow) => workflow.key === "destination-workflow",
      )!;
      const destinationDoing = destination.data.workflowStatuses.find(
        (status) => status.workflowId === destinationWorkflow.id && status.key === "doing",
      )!;
      const destinationReady = destination.data.workflowStatuses.find(
        (status) => status.workflowId === destinationWorkflow.id && status.key === "ready",
      )!;

      yield* authenticated.mutation(refs.public.teams.updateProductFields, {
        churchId: church.id!,
        updates: [{ teamId: team.id!, fields: { defaultWorkflowId: destinationWorkflow.id } }],
      });
      const taskId = yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();

          return yield* Effect.promise(() =>
            ctx.db.insert("tasks", {
              churchId: church.id!,
              title: "Remapped Task",
              teamId: null,
              workflowId: sourceWorkflow.id,
              workflowStatusId: sourceDoing.id,
              taskState: "in_progress",
            }),
          );
        }),
        Schema.String,
      );

      const remapped = yield* authenticated.mutation(refs.public.workflows.remapTaskTeam, {
        churchId: church.id!,
        taskId,
        destinationTeamId: team.id!,
      });
      const task = remapped.data.tasks.find((candidate) => candidate.id === taskId)!;

      expect(task).toMatchObject({
        teamId: team.id,
        workflowId: destinationWorkflow.id,
        workflowStatusId: destinationDoing.id,
        taskState: "in_progress",
      });

      const fallbackTaskId = yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();

          return yield* Effect.promise(() =>
            ctx.db.insert("tasks", {
              churchId: church.id!,
              title: "Fallback Remapped Task",
              teamId: null,
              workflowId: sourceWorkflow.id,
              workflowStatusId: sourceReview.id,
              taskState: "in_progress",
            }),
          );
        }),
        Schema.String,
      );

      const fallbackRemapped = yield* authenticated.mutation(refs.public.workflows.remapTaskTeam, {
        churchId: church.id!,
        taskId: fallbackTaskId,
        destinationTeamId: team.id!,
      });
      const fallbackTask = fallbackRemapped.data.tasks.find(
        (candidate) => candidate.id === fallbackTaskId,
      )!;

      expect(fallbackTask).toMatchObject({
        workflowId: destinationWorkflow.id,
        workflowStatusId: destinationReady.id,
        taskState: "in_progress",
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
