/// <reference types="vite/client" />

import { describe, it } from "@effect/vitest";
import { MutationCtx } from "@confect/server";
import { Effect, Schema } from "effect";
import { expect } from "vitest";

import { components } from "../convex/_generated/api";
import type { DataModel, Id } from "../convex/_generated/dataModel";
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

type AuthenticatedTestConfect = ReturnType<
  (typeof TestConfect.TestConfect.Service)["withIdentity"]
>;

// Every Task belongs to exactly one Team (ADR 0013): creation tests draw the
// Worship Starter Team (falling back to the first listed Team) unless they
// need a specific Team.
const firstTeamId = (authenticated: AuthenticatedTestConfect, churchId: string) =>
  Effect.gen(function* () {
    const teams = yield* authenticated.query(refs.public.teams.listForChurch, { churchId });
    return (teams.data.teams.find((team) => team.name === "Worship") ?? teams.data.teams[0]!).id;
  });

// Every Team owns exactly one Workflow (ADR 0013): tests resolve Workflows
// and Workflow Statuses through the owning Team rather than a Church default.
const workflowForTeam = <Workflow extends { readonly teamId: string }>(
  defaults: { readonly data: { readonly workflows: ReadonlyArray<Workflow> } },
  teamId: string,
) => defaults.data.workflows.find((workflow) => workflow.teamId === teamId)!;

const statusForTeam = <
  Workflow extends { readonly id: string; readonly teamId: string },
  Status extends { readonly workflowId: string; readonly taskState: string },
>(
  defaults: {
    readonly data: {
      readonly workflows: ReadonlyArray<Workflow>;
      readonly workflowStatuses: ReadonlyArray<Status>;
    };
  },
  teamId: string,
  taskState: string,
) => {
  const workflow = workflowForTeam(defaults, teamId);
  return defaults.data.workflowStatuses.find(
    (status) => status.workflowId === workflow.id && status.taskState === taskState,
  )!;
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

const addTeamMember = (
  c: typeof TestConfect.TestConfect.Service,
  args: {
    readonly token: string;
    readonly userId: string;
    readonly organizationId: string;
    readonly teamId: string;
  },
) =>
  c.fetch("/api/auth/organization/add-team-member", {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      userId: args.userId,
      organizationId: args.organizationId,
      teamId: args.teamId,
    }),
  });

const removeTeamMember = (
  c: typeof TestConfect.TestConfect.Service,
  args: {
    readonly token: string;
    readonly userId: string;
    readonly organizationId: string;
    readonly teamId: string;
  },
) =>
  c.fetch("/api/auth/organization/remove-team-member", {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      userId: args.userId,
      organizationId: args.organizationId,
      teamId: args.teamId,
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

  it.effect("owners can update Church Time Zone without rewriting existing Cycle boundaries", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-update-church-time-zone-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Update Time Zone Church",
        slug: `update-time-zone-${crypto.randomUUID()}`,
        churchTimeZone: "America/New_York",
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const todoStatus = defaults.data.workflowStatuses.find(
        (status) => status.taskState === "todo",
      )!;

      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Preserve existing cycle boundary",
            teamId: taskTeamId,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
        ],
      });
      const beforeUpdate = yield* authenticated.query(refs.public.tasks.listForChurch, {
        churchId: church.id!,
      });
      const existingCycle = beforeUpdate.data.cycles.find(
        (cycle) => cycle.startDate === "2026-06-01",
      )!;

      const update = yield* authenticated.mutation(refs.public.churchSettings.updateTimeZone, {
        churchId: church.id!,
        churchTimeZone: "America/Los_Angeles",
      });
      const read = yield* authenticated.query(refs.public.churchSettings.readForChurch, {
        churchId: church.id!,
      });
      yield* authenticated.mutation(refs.public.cycleMaintenance.runForChurch, {
        churchId: church.id!,
        now: "2026-06-08T04:30:00.000Z",
      });
      const afterMaintenance = yield* authenticated.query(refs.public.tasks.listForChurch, {
        churchId: church.id!,
      });
      const preservedCycle = afterMaintenance.data.cycles.find(
        (cycle) => cycle.id === existingCycle.id,
      )!;
      const futureCycle = afterMaintenance.data.cycles.find(
        (cycle) => cycle.startDate === "2026-06-08",
      )!;

      expect(update).toEqual({
        ok: true,
        operation: "updateChurchTimeZone",
        data: { church: { id: church.id, churchTimeZone: "America/Los_Angeles" } },
      });
      expect(read).toEqual({
        ok: true,
        operation: "readChurchSettings",
        data: { church: { id: church.id, churchTimeZone: "America/Los_Angeles" } },
      });
      expect(preservedCycle).toMatchObject({
        churchTimeZone: existingCycle.churchTimeZone,
        startDate: existingCycle.startDate,
        endDate: existingCycle.endDate,
        startsAt: existingCycle.startsAt,
        endsAt: existingCycle.endsAt,
      });
      expect(futureCycle).toMatchObject({
        churchTimeZone: "America/Los_Angeles",
        startsAt: "2026-06-08T07:00:00.000Z",
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Church Time Zone setup rejects invalid IANA time zones", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-setup-invalid-time-zone-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Setup Invalid Time Zone Church",
        slug: `setup-invalid-time-zone-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      const update = yield* authenticated.mutation(refs.public.churchSettings.updateTimeZone, {
        churchId: church.id!,
        churchTimeZone: "Not/A_Zone",
      });

      expect(update).toEqual({
        ok: false,
        operation: "updateChurchTimeZone",
        error: {
          code: "invalid_church_time_zone",
          message: "Church Time Zone must be a valid IANA time zone.",
        },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Church members can read but cannot update Church Time Zone setup", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const ownerEmail = `agent-member-time-zone-owner-${crypto.randomUUID()}@example.com`;
      const memberEmail = `agent-member-time-zone-member-${crypto.randomUUID()}@example.com`;
      const ownerResponse = yield* signUpWithEmail(c, ownerEmail);
      const memberResponse = yield* signUpWithEmail(c, memberEmail);
      const owner = (yield* Effect.promise(() => ownerResponse.json())) as {
        token?: string;
      };
      const member = (yield* Effect.promise(() => memberResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: owner.token!,
        name: "Member Time Zone Church",
        slug: `member-time-zone-${crypto.randomUUID()}`,
        churchTimeZone: "America/Chicago",
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();
          yield* Effect.promise(() =>
            ctx.runMutation(components.betterAuth.adapter.create, {
              input: {
                model: "member",
                data: {
                  userId: member.user!.id!,
                  organizationId: church.id!,
                  role: "member",
                  createdAt: Date.now(),
                },
              },
            }),
          );
        }),
        Schema.Void,
      );
      const memberAuthenticated = yield* authenticatedConfect(c, {
        userId: member.user!.id!,
        sessionToken: member.token!,
      });

      const read = yield* memberAuthenticated.query(refs.public.churchSettings.readForChurch, {
        churchId: church.id!,
      });
      const update = yield* memberAuthenticated.mutation(
        refs.public.churchSettings.updateTimeZone,
        {
          churchId: church.id!,
          churchTimeZone: "America/Denver",
        },
      );

      expect(read).toEqual({
        ok: true,
        operation: "readChurchSettings",
        data: { church: { id: church.id, churchTimeZone: "America/Chicago" } },
      });
      expect(update).toEqual({
        ok: false,
        operation: "updateChurchTimeZone",
        error: {
          code: "not_authorized",
          message: "Only Church owners and admins can update Church Time Zone.",
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
      const teams = yield* authenticated.query(refs.public.teams.listForChurch, {
        churchId: church.id!,
      });

      expect(result.ok).toBe(true);
      // Every Team owns its Workflow (ADR 0013): church creation seeds each
      // Starter Team its own To Do / In Progress / Done Workflow. There is no
      // Church default Workflow.
      expect(teams.data.teams).toHaveLength(6);
      expect(result.data.workflows).toHaveLength(6);
      for (const team of teams.data.teams) {
        const workflow = result.data.workflows.find((candidate) => candidate.teamId === team.id)!;
        expect(workflow).toMatchObject({
          key: `team-${team.id}`,
          name: team.name,
          sortOrder: 0,
          archivedAt: null,
        });
        expect(
          result.data.workflowStatuses
            .filter((status) => status.workflowId === workflow.id)
            .map((status) => [status.key, status.taskState]),
        ).toEqual([
          ["to-do", "todo"],
          ["in-progress", "in_progress"],
          ["done", "done"],
        ]);
      }
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

  it.effect("Church creation seeds editable starter Teams that each own a Workflow", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-starter-teams-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Starter Teams Church",
        slug: `starter-teams-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      const teams = yield* authenticated.query(refs.public.teams.listForChurch, {
        churchId: church.id!,
      });
      const memberships = yield* authenticated.query(refs.public.teams.listMembershipsForChurch, {
        churchId: church.id!,
      });

      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });

      expect(teams.ok).toBe(true);
      expect(teams.data.teams.map((team) => team.name)).toEqual([
        "Worship",
        "Production",
        "Kids",
        "Experience",
        "Facilities",
        "Social Media",
      ]);
      expect(teams.data.teams.map((team) => team.sortOrder)).toEqual([0, 1, 2, 3, 4, 5]);
      expect(teams.data.teams.every((team) => team.archivedAt === null)).toBe(true);
      expect(
        teams.data.teams.every((team) =>
          memberships.data.teamMemberships.some(
            (membership) =>
              membership.teamId === team.id && membership.userId === signUpBody.user!.id!,
          ),
        ),
      ).toBe(true);
      // Every starter Team owns its own seeded Workflow named after the
      // Team (ADR 0013).
      for (const team of teams.data.teams) {
        expect(
          defaults.data.workflows.find((workflow) => workflow.teamId === team.id),
        ).toMatchObject({ name: team.name });
      }

      yield* authenticated.mutation(refs.public.workDefaults.seedForChurch, {
        churchId: church.id!,
      });
      const teamsAfterReseed = yield* authenticated.query(refs.public.teams.listForChurch, {
        churchId: church.id!,
      });

      expect(teamsAfterReseed.data.teams.map((team) => team.name)).toEqual([
        "Worship",
        "Production",
        "Kids",
        "Experience",
        "Facilities",
        "Social Media",
      ]);
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
      const teams = yield* authenticated.query(refs.public.teams.listForChurch, {
        churchId: church.id!,
      });

      // Re-seeding never duplicates the 6 starter Teams, their per-Team
      // Workflows, the 3 statuses each, or the starter Key Dates (ADR 0013).
      expect(teams.data.teams).toHaveLength(6);
      expect(result.data.workflows).toHaveLength(6);
      expect(result.data.workflowStatuses).toHaveLength(18);
      expect(result.data.keyDates).toHaveLength(6);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Key Date scheduling resolves fixed, computed, manual, and one-time occurrences", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-key-date-scheduling-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Key Date Church",
        slug: `key-date-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      const createdKeyDates = yield* authenticated.mutation(refs.public.keyDates.createForChurch, {
        churchId: church.id!,
        keyDates: [
          {
            key: "summer-fest",
            name: "Summer Fest",
            schedule: { kind: "manualOccurrences" },
          },
          {
            key: "building-dedication",
            name: "Building Dedication",
            schedule: { kind: "oneTime" },
          },
        ],
      });
      const summerFest = createdKeyDates.data.keyDates.find(
        (keyDate) => keyDate.key === "summer-fest",
      )!;
      const buildingDedication = createdKeyDates.data.keyDates.find(
        (keyDate) => keyDate.key === "building-dedication",
      )!;

      yield* authenticated.mutation(refs.public.keyDates.createOccurrences, {
        churchId: church.id!,
        occurrences: [
          {
            keyDateId: summerFest.id,
            localDate: "2026-08-15",
            label: "Saturday festival",
          },
          {
            keyDateId: buildingDedication.id,
            localDate: "2026-09-20",
            label: null,
          },
        ],
      });

      const result = yield* authenticated.query(refs.public.keyDates.resolveOccurrences, {
        churchId: church.id!,
        fromYear: 2026,
        toYear: 2026,
      });

      expect(result.ok).toBe(true);
      expect(
        result.data.resolvedOccurrences.map((occurrence) => [
          occurrence.key,
          occurrence.localDate,
          occurrence.source,
        ]),
      ).toEqual([
        ["palm-sunday", "2026-03-29", "computedYearly"],
        ["easter", "2026-04-05", "computedYearly"],
        ["mothers-day", "2026-05-10", "computedYearly"],
        ["pentecost", "2026-05-24", "computedYearly"],
        ["fathers-day", "2026-06-21", "computedYearly"],
        ["summer-fest", "2026-08-15", "manualOccurrences"],
        ["building-dedication", "2026-09-20", "oneTime"],
        ["christmas", "2026-12-25", "fixedYearly"],
      ]);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Template Scheduling Rules resolve one Due Date and containing Cycle", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-template-scheduling-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Template Scheduling Church",
        slug: `template-scheduling-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const keyDates = yield* authenticated.query(refs.public.keyDates.listForChurch, {
        churchId: church.id!,
      });
      const easter = keyDates.data.keyDates.find((keyDate) => keyDate.key === "easter")!;
      const templateTeamId = yield* firstTeamId(authenticated, church.id!);

      const created = yield* authenticated.mutation(refs.public.templates.createForChurch, {
        churchId: church.id!,
        templates: [
          {
            key: "easter-prep",
            name: "Easter Prep",
            recurrence: "yearly",
            templateTeams: [{ key: "owner", name: "Owner", mappedTeamId: templateTeamId }],
            focusWindows: [
              {
                key: "holy-week",
                name: "Holy Week",
                type: "seasonal",
                startDate: "2026-03-30",
                endDate: "2026-04-05",
                anchorDate: "2026-04-05",
                keyDateId: easter.id,
              },
            ],
            templateTasks: [
              {
                key: "fixed",
                title: "Fixed date work",
                templateTeamKey: null,
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-03-28" },
              },
              {
                key: "window-start",
                title: "Focus window work",
                templateTeamKey: null,
                parentTemplateTaskKey: "fixed",
                schedulingRule: {
                  kind: "relativeToFocusWindow",
                  focusWindowId: "holy-week",
                  edge: "start",
                  offsetDays: 2,
                },
              },
              {
                key: "anchor",
                title: "Anchor date work",
                templateTeamKey: null,
                parentTemplateTaskKey: null,
                schedulingRule: {
                  kind: "relativeToAnchorDate",
                  focusWindowId: "holy-week",
                  offsetDays: -3,
                },
              },
              {
                key: "key-date",
                title: "Key Date work",
                templateTeamKey: null,
                parentTemplateTaskKey: null,
                schedulingRule: {
                  kind: "relativeToKeyDate",
                  keyDateId: easter.id,
                  year: 2026,
                  offsetDays: -7,
                },
              },
              {
                key: "cycle-offset",
                title: "Cycle offset work",
                templateTeamKey: null,
                parentTemplateTaskKey: null,
                schedulingRule: {
                  kind: "cycleOffset",
                  baseLocalDate: "2026-03-28",
                  offsetCycles: 1,
                  dayOffset: 4,
                },
              },
            ],
          },
        ],
      });
      const resolved = yield* authenticated.query(refs.public.templates.resolveSchedules, {
        churchId: church.id!,
      });
      const schedules = [...resolved.data.resolvedSchedules].sort((left, right) =>
        left.templateTaskKey.localeCompare(right.templateTaskKey),
      );
      const child = created.data.templateTasks.find((task) => task.key === "window-start")!;
      const parent = created.data.templateTasks.find((task) => task.key === "fixed")!;

      expect(created.ok).toBe(true);
      expect(created.data.templates.map((template) => template.recurrence)).toEqual(["yearly"]);
      expect(child.parentTemplateTaskId).toBe(parent.id);
      expect(schedules.map((schedule) => [schedule.templateTaskKey, schedule.dueDate])).toEqual([
        ["anchor", "2026-04-02"],
        ["cycle-offset", "2026-04-03"],
        ["fixed", "2026-03-28"],
        ["key-date", "2026-03-29"],
        ["window-start", "2026-04-01"],
      ]);
      expect(
        schedules.find((schedule) => schedule.templateTaskKey === "key-date")!.cycle,
      ).toMatchObject({
        startDate: "2026-03-23",
        endDate: "2026-03-29",
        churchTimeZone: "America/New_York",
      });
      expect(schedules.every((schedule) => typeof schedule.dueDate === "string")).toBe(true);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Template recurrence supports none, weekly, monthly, quarterly, and yearly", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-template-recurrence-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Template Recurrence Church",
        slug: `template-recurrence-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const templateTeamId = yield* firstTeamId(authenticated, church.id!);

      const created = yield* authenticated.mutation(refs.public.templates.createForChurch, {
        churchId: church.id!,
        templates: ["none", "weekly", "monthly", "quarterly", "yearly"].map((recurrence) => ({
          key: `template-${recurrence}`,
          name: `Template ${recurrence}`,
          recurrence,
          templateTeams: [{ key: "owner", name: "Owner", mappedTeamId: templateTeamId }],
          focusWindows: [],
          templateTasks: [
            {
              key: "task",
              title: `Task ${recurrence}`,
              templateTeamKey: null,
              parentTemplateTaskKey: null,
              schedulingRule: { kind: "fixedDate", localDate: "2026-06-01" },
            },
          ],
        })),
      });

      expect(created.ok).toBe(true);
      expect(created.data.templates.map((template) => template.recurrence).sort()).toEqual([
        "monthly",
        "none",
        "quarterly",
        "weekly",
        "yearly",
      ]);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Cycle Adjustment merge preserves sparse, null, and skipped semantics", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-cycle-adjustment-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Cycle Adjustment Church",
        slug: `cycle-adjustment-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const todoStatus = defaults.data.workflowStatuses.find(
        (status) => status.taskState === "todo",
      )!;
      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      const cycleSeed = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Seed cycle",
            teamId: taskTeamId,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
        ],
      });
      const cycleId = cycleSeed.data.tasks[0]!.cycleId;
      const created = yield* authenticated.mutation(refs.public.templates.createForChurch, {
        churchId: church.id!,
        templates: [
          {
            key: "weekly-prep",
            name: "Weekly Prep",
            recurrence: "weekly",
            templateTeams: [{ key: "owner", name: "Owner", mappedTeamId: taskTeamId }],
            focusWindows: [],
            templateTasks: [
              {
                key: "parent",
                title: "Prepare worship plan",
                templateTeamKey: null,
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-03" },
              },
              {
                key: "child",
                title: "Confirm musicians",
                templateTeamKey: null,
                parentTemplateTaskKey: "parent",
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-03" },
              },
              {
                key: "skip-me",
                title: "Print handouts",
                templateTeamKey: null,
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-03" },
              },
            ],
          },
        ],
      });
      const parent = created.data.templateTasks.find((task) => task.key === "parent")!;
      const child = created.data.templateTasks.find((task) => task.key === "child")!;
      const skipped = created.data.templateTasks.find((task) => task.key === "skip-me")!;

      const setAdjustments = yield* authenticated.mutation(
        refs.public.templates.setCycleAdjustments,
        {
          churchId: church.id!,
          adjustments: [
            {
              cycleId,
              templateTaskId: child.id,
              lifecycle: "active",
              overrides: [
                { field: "title", value: "Confirm substitute musicians" },
                { field: "parentTemplateTaskId", value: null },
              ],
            },
            {
              cycleId,
              templateTaskId: skipped.id,
              lifecycle: "skipped",
              overrides: [],
            },
          ],
        },
      );
      const preview = yield* authenticated.query(
        refs.public.templates.previewCycleAdjustmentMerge,
        {
          churchId: church.id!,
          projections: [
            { cycleId, templateTaskId: parent.id, dueDate: "2026-06-03" },
            { cycleId, templateTaskId: child.id, dueDate: "2026-06-03" },
            { cycleId, templateTaskId: skipped.id, dueDate: "2026-06-03" },
          ],
        },
      );
      const merged = preview.data.mergedProjectedTasks;

      expect(setAdjustments.ok).toBe(true);
      expect(setAdjustments.data.cycleAdjustments).toHaveLength(2);
      expect(merged.find((task) => task.templateTaskId === parent.id)).toMatchObject({
        skipped: false,
        effectiveTask: {
          title: "Prepare worship plan",
          dueDate: "2026-06-03",
          parentTemplateTaskId: null,
        },
        appliedOverrides: [],
      });
      expect(merged.find((task) => task.templateTaskId === child.id)).toMatchObject({
        skipped: false,
        effectiveTask: {
          title: "Confirm substitute musicians",
          dueDate: "2026-06-03",
          parentTemplateTaskId: null,
        },
      });
      expect(merged.find((task) => task.templateTaskId === skipped.id)).toMatchObject({
        skipped: true,
        effectiveTask: null,
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect(
    "Template Task materialization is idempotent and preserves Source Template traceability",
    () =>
      Effect.gen(function* () {
        const c = yield* TestConfect.TestConfect;
        const email = `agent-template-materialize-${crypto.randomUUID()}@example.com`;
        const signUpResponse = yield* signUpWithEmail(c, email);
        const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
          user?: { id?: string };
          token?: string;
        };
        const churchResponse = yield* createChurch(c, {
          token: signUpBody.token!,
          name: "Template Materialization Church",
          slug: `template-materialization-${crypto.randomUUID()}`,
        });
        const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
        const authenticated = yield* authenticatedConfect(c, {
          userId: signUpBody.user!.id!,
          sessionToken: signUpBody.token!,
        });
        const templateTeamId = yield* firstTeamId(authenticated, church.id!);

        const created = yield* authenticated.mutation(refs.public.templates.createForChurch, {
          churchId: church.id!,
          templates: [
            {
              key: "weekly-service",
              name: "Weekly Service",
              recurrence: "weekly",
              templateTeams: [{ key: "owner", name: "Owner", mappedTeamId: templateTeamId }],
              focusWindows: [],
              templateTasks: [
                {
                  key: "parent",
                  title: "Prepare service plan",
                  templateTeamKey: null,
                  parentTemplateTaskKey: null,
                  schedulingRule: { kind: "fixedDate", localDate: "2026-06-03" },
                },
                {
                  key: "child-next-week",
                  title: "Prepare follow-up email",
                  templateTeamKey: null,
                  parentTemplateTaskKey: "parent",
                  schedulingRule: { kind: "fixedDate", localDate: "2026-06-10" },
                },
              ],
            },
          ],
        });
        const firstMaterialize = yield* authenticated.mutation(
          refs.public.templates.materializeProjectedTasks,
          { churchId: church.id!, occurrenceCycleIds: [] },
        );
        const secondMaterialize = yield* authenticated.mutation(
          refs.public.templates.materializeProjectedTasks,
          { churchId: church.id!, occurrenceCycleIds: [] },
        );
        const tasks = yield* authenticated.query(refs.public.tasks.listForChurch, {
          churchId: church.id!,
        });
        const parentTemplate = created.data.templateTasks.find((task) => task.key === "parent")!;
        const childTemplate = created.data.templateTasks.find(
          (task) => task.key === "child-next-week",
        )!;
        const parent = tasks.data.tasks.find(
          (task) => task.sourceTemplateTaskId === parentTemplate.id,
        )!;
        const child = tasks.data.tasks.find(
          (task) => task.sourceTemplateTaskId === childTemplate.id,
        )!;

        expect(firstMaterialize.ok).toBe(true);
        expect(secondMaterialize.ok).toBe(true);
        expect(tasks.data.tasks.filter((task) => task.sourceTemplateTaskId)).toHaveLength(2);
        expect(parent).toMatchObject({
          title: "Prepare service plan",
          dueDate: "2026-06-03",
          parentTaskId: null,
          sourceTemplateId: created.data.templates[0]!.id,
          sourceTemplateTaskId: parentTemplate.id,
          sourceTemplateSyncEnabled: true,
        });
        expect(child).toMatchObject({
          title: "Prepare follow-up email",
          dueDate: "2026-06-10",
          parentTaskId: parent.id,
          sourceTemplateId: created.data.templates[0]!.id,
          sourceTemplateTaskId: childTemplate.id,
          sourceTemplateSyncEnabled: true,
        });
        expect(child.cycleId).not.toBe(parent.cycleId);
        expect(child.sourceTemplateCycleId).not.toBe(parent.sourceTemplateCycleId);
      }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Template Teams map projected Tasks to each slot's Team sequence", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-template-teams-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Template Teams Church",
        slug: `template-teams-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const firstTeamIdValue = yield* firstTeamId(authenticated, church.id!);
      const createdTeams = yield* authenticated.mutation(refs.public.teams.createForChurch, {
        churchId: church.id!,
        name: "Production",
      });
      const productionTeam = createdTeams.data.teams.find((team) => team.name === "Production")!;
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const firstTeamTodo = statusForTeam(defaults, firstTeamIdValue, "todo");

      yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Seed first team number",
            teamId: firstTeamIdValue,
            workflowStatusId: firstTeamTodo.id,
            dueDate: "2026-06-01",
            parentTaskId: null,
          },
        ],
      });
      const created = yield* authenticated.mutation(refs.public.templates.createForChurch, {
        churchId: church.id!,
        templates: [
          {
            key: "multi-team-service",
            name: "Multi-team Service",
            recurrence: "weekly",
            templateTeams: [
              { key: "worship", name: "Worship Slot", mappedTeamId: firstTeamIdValue },
              { key: "production", name: "Production Slot", mappedTeamId: productionTeam.id },
            ],
            focusWindows: [],
            templateTasks: [
              {
                key: "plan-songs",
                title: "Plan songs",
                templateTeamKey: "worship",
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-03" },
              },
              {
                key: "prep-slides",
                title: "Prep slides",
                templateTeamKey: "production",
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-03" },
              },
            ],
          },
        ],
      });
      const materialized = yield* authenticated.mutation(
        refs.public.templates.materializeProjectedTasks,
        { churchId: church.id!, occurrenceCycleIds: [] },
      );
      const listed = yield* authenticated.query(refs.public.tasks.listForChurch, {
        churchId: church.id!,
      });
      const worshipTask = listed.data.tasks.find((task) => task.title === "Plan songs")!;
      const productionTask = listed.data.tasks.find((task) => task.title === "Prep slides")!;
      const worshipSlot = created.data.templateTeams.find((slot) => slot.key === "worship")!;
      const worshipTemplateTask = created.data.templateTasks.find(
        (task) => task.key === "plan-songs",
      )!;

      expect(created.ok).toBe(true);
      expect(worshipTemplateTask.templateTeamId).toBe(worshipSlot.id);
      expect(materialized.ok).toBe(true);
      expect(worshipTask).toMatchObject({ teamId: firstTeamIdValue, number: 2 });
      expect(productionTask).toMatchObject({ teamId: productionTeam.id, number: 1 });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Team deletion remaps or abandons mapped Template Teams before removal", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-template-team-delete-repair-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Template Team Delete Repair Church",
        slug: `template-team-delete-repair-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const createdTeams = yield* authenticated.mutation(refs.public.teams.createForChurch, {
        churchId: church.id!,
        name: "Disposable",
      });
      const disposable = createdTeams.data.teams.find((team) => team.name === "Disposable")!;
      const target = createdTeams.data.teams.find((team) => team.name === "Worship")!;

      const created = yield* authenticated.mutation(refs.public.templates.createForChurch, {
        churchId: church.id!,
        templates: [
          {
            key: "repair-delete-template",
            name: "Repair Delete Template",
            recurrence: "weekly",
            templateTeams: [
              { key: "remap", name: "Remap Slot", mappedTeamId: disposable.id },
              { key: "abandon", name: "Abandon Slot", mappedTeamId: disposable.id },
            ],
            focusWindows: [],
            templateTasks: [
              {
                key: "remapped-task",
                title: "Remapped task",
                templateTeamKey: "remap",
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-03" },
              },
              {
                key: "abandoned-task",
                title: "Abandoned task",
                templateTeamKey: "abandon",
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-03" },
              },
            ],
          },
        ],
      });
      const remapSlot = created.data.templateTeams.find((slot) => slot.key === "remap")!;
      const abandonSlot = created.data.templateTeams.find((slot) => slot.key === "abandon")!;
      const abandonedTemplateTask = created.data.templateTasks.find(
        (task) => task.key === "abandoned-task",
      )!;

      const blocked = yield* authenticated.mutation(refs.public.teams.deleteForChurch, {
        churchId: church.id!,
        teamId: disposable.id,
      });
      const deleted = yield* authenticated.mutation(refs.public.teams.deleteForChurch, {
        churchId: church.id!,
        teamId: disposable.id,
        templateTeamRepairs: [
          { templateTeamId: remapSlot.id, action: "remap", mappedTeamId: target.id },
          { templateTeamId: abandonSlot.id, action: "abandon" },
        ],
      });
      const materialized = yield* authenticated.mutation(
        refs.public.templates.materializeProjectedTasks,
        { churchId: church.id!, occurrenceCycleIds: [] },
      );
      const listedTasks = yield* authenticated.query(refs.public.tasks.listForChurch, {
        churchId: church.id!,
      });
      const templateTeamsMappedToDeleted = materialized.data.templateTeams.filter(
        (slot) => slot.archivedAt === null && slot.mappedTeamId === disposable.id,
      );

      expect(blocked).toEqual({
        ok: false,
        operation: "deleteTeam",
        error: {
          code: "template_team_repair_required",
          message:
            "Template Teams mapped to this Team must be remapped or abandoned before deleting.",
        },
      });
      expect(deleted.ok).toBe(true);
      expect(materialized.ok).toBe(true);
      expect(templateTeamsMappedToDeleted).toEqual([]);
      expect(
        materialized.data.templateTeams.find((slot) => slot.id === remapSlot.id),
      ).toMatchObject({
        mappedTeamId: target.id,
        archivedAt: null,
      });
      expect(
        materialized.data.templateTeams.find((slot) => slot.id === abandonSlot.id),
      ).toMatchObject({ archivedAt: expect.any(String) });
      expect(
        materialized.data.templateTasks.find((task) => task.id === abandonedTemplateTask.id),
      ).toMatchObject({ archivedAt: expect.any(String) });
      expect(listedTasks.data.tasks.find((task) => task.title === "Remapped task")).toMatchObject({
        teamId: target.id,
      });
      expect(listedTasks.data.tasks.some((task) => task.title === "Abandoned task")).toBe(false);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Team archival requires Template Team repairs before archiving", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-template-team-archive-repair-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Template Team Archive Repair Church",
        slug: `template-team-archive-repair-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const createdTeams = yield* authenticated.mutation(refs.public.teams.createForChurch, {
        churchId: church.id!,
        name: "Archive Source",
      });
      const source = createdTeams.data.teams.find((team) => team.name === "Archive Source")!;
      const target = createdTeams.data.teams.find((team) => team.name === "Worship")!;
      const created = yield* authenticated.mutation(refs.public.templates.createForChurch, {
        churchId: church.id!,
        templates: [
          {
            key: "repair-archive-template",
            name: "Repair Archive Template",
            recurrence: "weekly",
            templateTeams: [{ key: "owner", name: "Owner", mappedTeamId: source.id }],
            focusWindows: [],
            templateTasks: [
              {
                key: "archive-remapped-task",
                title: "Archive remapped task",
                templateTeamKey: null,
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-03" },
              },
            ],
          },
        ],
      });
      const slot = created.data.templateTeams[0]!;

      const blocked = yield* authenticated.mutation(refs.public.teams.archiveForChurch, {
        churchId: church.id!,
        teamId: source.id,
      });
      const archived = yield* authenticated.mutation(refs.public.teams.archiveForChurch, {
        churchId: church.id!,
        teamId: source.id,
        templateTeamRepairs: [
          { templateTeamId: slot.id, action: "remap", mappedTeamId: target.id },
        ],
      });
      const materialized = yield* authenticated.mutation(
        refs.public.templates.materializeProjectedTasks,
        { churchId: church.id!, occurrenceCycleIds: [] },
      );
      const listedTasks = yield* authenticated.query(refs.public.tasks.listForChurch, {
        churchId: church.id!,
      });

      expect(blocked).toEqual({
        ok: false,
        operation: "archiveTeam",
        error: {
          code: "template_team_repair_required",
          message:
            "Template Teams mapped to this Team must be remapped or abandoned before archiving.",
        },
      });
      expect(archived.ok).toBe(true);
      expect(archived.data.teams.some((team) => team.id === source.id)).toBe(false);
      expect(materialized.data.templateTeams.find((team) => team.id === slot.id)).toMatchObject({
        mappedTeamId: target.id,
        archivedAt: null,
      });
      expect(
        listedTasks.data.tasks.find((task) => task.title === "Archive remapped task"),
      ).toMatchObject({ teamId: target.id });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Template Task edits sync only future unadjusted projected Tasks", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-template-sync-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Template Sync Church",
        slug: `template-sync-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const todoStatus = defaults.data.workflowStatuses.find(
        (status) => status.taskState === "todo",
      )!;

      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      const cycleSeed = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Seed future adjustment cycle",
            teamId: taskTeamId,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-17",
            parentTaskId: null,
          },
        ],
      });
      const futureCycleId = cycleSeed.data.tasks[0]!.cycleId;
      const created = yield* authenticated.mutation(refs.public.templates.createForChurch, {
        churchId: church.id!,
        templates: [
          {
            key: "template-sync",
            name: "Template Sync",
            recurrence: "weekly",
            templateTeams: [{ key: "owner", name: "Owner", mappedTeamId: taskTeamId }],
            focusWindows: [],
            templateTasks: [
              {
                key: "past",
                title: "Past projected work",
                templateTeamKey: null,
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-03" },
              },
              {
                key: "current",
                title: "Current projected work",
                templateTeamKey: null,
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-10" },
              },
              {
                key: "future",
                title: "Future projected work",
                templateTeamKey: null,
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-17" },
              },
              {
                key: "adjusted",
                title: "Adjusted projected work",
                templateTeamKey: null,
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-17" },
              },
              {
                key: "rolled",
                title: "Rolled projected work",
                templateTeamKey: null,
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-03" },
              },
            ],
          },
        ],
      });
      const templateTasksByKey = new Map(
        created.data.templateTasks.map((templateTask) => [templateTask.key, templateTask]),
      );
      yield* authenticated.mutation(refs.public.templates.setCycleAdjustments, {
        churchId: church.id!,
        adjustments: [
          {
            cycleId: futureCycleId,
            templateTaskId: templateTasksByKey.get("adjusted")!.id,
            lifecycle: "active",
            overrides: [{ field: "title", value: "Adjusted one-off coverage" }],
          },
        ],
      });
      yield* authenticated.mutation(refs.public.templates.materializeProjectedTasks, {
        churchId: church.id!,
        occurrenceCycleIds: [],
      });

      const beforeMaintenance = yield* authenticated.query(refs.public.tasks.listForChurch, {
        churchId: church.id!,
      });
      const pastTask = beforeMaintenance.data.tasks.find(
        (task) => task.sourceTemplateTaskId === templateTasksByKey.get("past")!.id,
      )!;
      const rolledTaskBefore = beforeMaintenance.data.tasks.find(
        (task) => task.sourceTemplateTaskId === templateTasksByKey.get("rolled")!.id,
      )!;
      yield* authenticated.mutation(refs.public.tasks.completeBatch, {
        churchId: church.id!,
        taskIds: [pastTask.id],
      });
      yield* authenticated.mutation(refs.public.cycleMaintenance.runForChurch, {
        churchId: church.id!,
        now: "2026-06-08T04:30:00.000Z",
      });

      const update = yield* authenticated.mutation(refs.public.templates.updateTemplateTasks, {
        churchId: church.id!,
        now: "2026-06-10T12:00:00.000Z",
        templateTasks: created.data.templateTasks.map((templateTask) => ({
          templateTaskId: templateTask.id,
          title: `Updated ${templateTask.key}`,
          schedulingRule:
            templateTask.key === "adjusted"
              ? { kind: "fixedDate" as const, localDate: "2026-06-18" }
              : templateTask.schedulingRule,
        })),
      });
      const listed = yield* authenticated.query(refs.public.tasks.listForChurch, {
        churchId: church.id!,
      });
      const taskFor = (key: string) =>
        listed.data.tasks.find(
          (task) => task.sourceTemplateTaskId === templateTasksByKey.get(key)!.id,
        )!;
      const futureTask = taskFor("future");
      const adjustedTask = taskFor("adjusted");
      const currentTask = taskFor("current");
      const rolledTask = taskFor("rolled");
      const templateActivities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "template",
        entityId: created.data.templates[0]!.id,
      });
      const futureActivities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "task",
        entityId: futureTask.id,
      });

      expect(update.ok).toBe(true);
      expect(futureTask).toMatchObject({ title: "Updated future", dueDate: "2026-06-17" });
      expect(adjustedTask).toMatchObject({
        title: "Adjusted one-off coverage",
        dueDate: "2026-06-18",
      });
      expect(currentTask).toMatchObject({ title: "Current projected work" });
      expect(taskFor("past")).toMatchObject({ title: "Past projected work", taskState: "done" });
      expect(rolledTask).toMatchObject({
        id: rolledTaskBefore.id,
        title: "Rolled projected work",
        sourceTemplateSyncEnabled: false,
      });
      expect(templateActivities.data.activities.map((activity) => activity.eventType)).toContain(
        "template.updated",
      );
      expect(futureActivities.data.activities.map((activity) => activity.eventType)).toContain(
        "task.template_synced",
      );
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Cycle maintenance rolls unfinished work and materializes upcoming Template work", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-cycle-maintenance-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Cycle Maintenance Church",
        slug: `cycle-maintenance-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const todoStatus = defaults.data.workflowStatuses.find(
        (status) => status.taskState === "todo",
      )!;
      const doneStatus = defaults.data.workflowStatuses.find(
        (status) => status.taskState === "done",
      )!;

      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      const seededTasks = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Carry sermon outline",
            teamId: taskTeamId,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
          {
            title: "Completed slides",
            teamId: taskTeamId,
            workflowStatusId: doneStatus.id,
            dueDate: "2026-06-04",
            parentTaskId: null,
          },
        ],
      });
      yield* authenticated.mutation(refs.public.templates.createForChurch, {
        churchId: church.id!,
        templates: [
          {
            key: "next-week-service",
            name: "Next Week Service",
            recurrence: "weekly",
            templateTeams: [{ key: "owner", name: "Owner", mappedTeamId: taskTeamId }],
            focusWindows: [],
            templateTasks: [
              {
                key: "prepare-next-week",
                title: "Prepare next week service plan",
                templateTeamKey: null,
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-10" },
              },
            ],
          },
        ],
      });

      const firstMaintenance = yield* authenticated.mutation(
        refs.public.cycleMaintenance.runForChurch,
        { churchId: church.id!, now: "2026-06-08T04:30:00.000Z" },
      );
      const secondMaintenance = yield* authenticated.mutation(
        refs.public.cycleMaintenance.runForChurch,
        { churchId: church.id!, now: "2026-06-08T04:30:00.000Z" },
      );
      const listed = yield* authenticated.query(refs.public.tasks.listForChurch, {
        churchId: church.id!,
      });
      const carried = listed.data.tasks.find((task) => task.title === "Carry sermon outline")!;
      const completed = listed.data.tasks.find((task) => task.title === "Completed slides")!;
      const projected = listed.data.tasks.find(
        (task) => task.title === "Prepare next week service plan",
      )!;
      const closingCycle = listed.data.cycles.find((cycle) => cycle.startDate === "2026-06-01")!;
      const nextCycle = listed.data.cycles.find((cycle) => cycle.startDate === "2026-06-08")!;
      const followingCycle = listed.data.cycles.find((cycle) => cycle.startDate === "2026-06-15")!;
      const rolloverActivities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "task",
        entityId: carried.id,
      });
      const nextCycleActivities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "cycle",
        entityId: nextCycle.id,
      });

      expect(firstMaintenance.ok).toBe(true);
      expect(secondMaintenance.ok).toBe(true);
      expect(firstMaintenance.data.rolledOverTaskIds).toEqual([carried.id]);
      expect(secondMaintenance.data.rolledOverTaskIds).toEqual([]);
      expect(firstMaintenance.data.materializedTaskIds).toEqual([projected.id]);
      expect(secondMaintenance.data.materializedTaskIds).toEqual([]);
      expect(carried).toMatchObject({
        cycleId: nextCycle.id,
        dueDate: "2026-06-10",
        taskState: "todo",
        sourceTemplateSyncEnabled: false,
      });
      expect(completed).toMatchObject({ cycleId: closingCycle.id, dueDate: "2026-06-04" });
      expect(projected).toMatchObject({ cycleId: nextCycle.id, dueDate: "2026-06-10" });
      expect(followingCycle).toMatchObject({ startDate: "2026-06-15", endDate: "2026-06-21" });
      expect(rolloverActivities.data.activities.map((activity) => activity.eventType)).toContain(
        "task.rolled_over",
      );
      expect(
        rolloverActivities.data.activities.find(
          (activity) => activity.eventType === "task.rolled_over",
        )?.metadata,
      ).toMatchObject({ fromCycleId: closingCycle.id, toCycleId: nextCycle.id });
      expect(nextCycleActivities.data.activities.map((activity) => activity.eventType)).toEqual([
        "cycle.created",
      ]);
      expect(seededTasks.data.tasks).toHaveLength(2);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Task and Subtask creation assigns Cycles from Due Dates", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-task-create-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Task Create Church",
        slug: `task-create-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const todoStatus = defaults.data.workflowStatuses.find(
        (status) => status.taskState === "todo",
      )!;
      const doneStatus = defaults.data.workflowStatuses.find(
        (status) => status.taskState === "done",
      )!;

      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      const createdParent = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Prepare Sunday slides",
            teamId: taskTeamId,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
          {
            title: "Plan next month volunteers",
            teamId: taskTeamId,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-17",
            parentTaskId: null,
          },
        ],
      });
      const parentTask = createdParent.data.tasks.find(
        (task) => task.title === "Prepare Sunday slides",
      )!;
      const futureTask = createdParent.data.tasks.find(
        (task) => task.title === "Plan next month volunteers",
      )!;

      const createdSubtask = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Export final slide deck",
            teamId: taskTeamId,
            workflowStatusId: doneStatus.id,
            dueDate: "2026-06-10",
            parentTaskId: parentTask.id,
          },
        ],
      });
      const subtask = createdSubtask.data.tasks.find(
        (task) => task.title === "Export final slide deck",
      )!;
      const listed = yield* authenticated.query(refs.public.tasks.listForChurch, {
        churchId: church.id!,
      });
      const parentCycle = listed.data.cycles.find((cycle) => cycle.id === parentTask.cycleId)!;
      const futureCycle = listed.data.cycles.find((cycle) => cycle.id === futureTask.cycleId)!;
      const subtaskCycle = listed.data.cycles.find((cycle) => cycle.id === subtask.cycleId)!;
      const parentActivities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "task",
        entityId: parentTask.id,
      });
      const subtaskActivities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "task",
        entityId: subtask.id,
      });

      expect(parentTask).toMatchObject({
        dueDate: "2026-06-03",
        parentTaskId: null,
        taskState: "todo",
      });
      expect(parentCycle).toMatchObject({
        startDate: "2026-06-01",
        endDate: "2026-06-07",
        startsAt: "2026-06-01T04:00:00.000Z",
      });
      expect(futureCycle).toMatchObject({ startDate: "2026-06-15", endDate: "2026-06-21" });
      expect(subtask).toMatchObject({
        parentTaskId: parentTask.id,
        taskState: "done",
      });
      expect(subtask.cycleId).not.toBe(parentTask.cycleId);
      expect(subtaskCycle).toMatchObject({ startDate: "2026-06-08", endDate: "2026-06-14" });
      expect(parentActivities.data.activities.map((activity) => activity.eventType)).toEqual([
        "task.created",
      ]);
      expect(subtaskActivities.data.activities).toHaveLength(1);
      expect(subtaskActivities.data.activities[0]).toMatchObject({
        eventType: "task.created",
        metadata: { parentTaskId: parentTask.id },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Task creation validates assigned Users through Church Membership", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const ownerResponse = yield* signUpWithEmail(
        c,
        `agent-task-assignment-owner-${crypto.randomUUID()}@example.com`,
      );
      const memberResponse = yield* signUpWithEmail(
        c,
        `agent-task-assignment-member-${crypto.randomUUID()}@example.com`,
      );
      const outsiderResponse = yield* signUpWithEmail(
        c,
        `agent-task-assignment-outsider-${crypto.randomUUID()}@example.com`,
      );
      const owner = (yield* Effect.promise(() => ownerResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const member = (yield* Effect.promise(() => memberResponse.json())) as {
        user?: { id?: string };
      };
      const outsider = (yield* Effect.promise(() => outsiderResponse.json())) as {
        user?: { id?: string };
      };
      const churchResponse = yield* createChurch(c, {
        token: owner.token!,
        name: "Task Assignment Church",
        slug: `task-assignment-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();
          yield* Effect.promise(() =>
            ctx.runMutation(components.betterAuth.adapter.create, {
              input: {
                model: "member",
                data: {
                  userId: member.user!.id!,
                  organizationId: church.id!,
                  role: "member",
                  createdAt: Date.now(),
                },
              },
            }),
          );
        }),
        Schema.Void,
      );
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

      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      const assigned = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Call assigned volunteer",
            teamId: taskTeamId,
            assignedUserId: member.user!.id!,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
        ],
      });
      const rejected = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Call outside volunteer",
            teamId: taskTeamId,
            assignedUserId: outsider.user!.id!,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
        ],
      });

      expect(
        assigned.data.tasks.find((task) => task.title === "Call assigned volunteer"),
      ).toMatchObject({ assignedUserId: member.user!.id! });
      expect(rejected).toEqual({
        ok: false,
        operation: "createTasks",
        error: {
          code: "assigned_user_not_church_member",
          message: "Assigned User must be a Church Member of the Task's Church.",
        },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Task creation validates statuses against the Team's own Workflow", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const ownerResponse = yield* signUpWithEmail(
        c,
        `agent-task-team-create-owner-${crypto.randomUUID()}@example.com`,
      );
      const owner = (yield* Effect.promise(() => ownerResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: owner.token!,
        name: "Task Team Create Church",
        slug: `task-team-create-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const teamResponse = yield* createTeam(c, {
        token: owner.token!,
        name: "Hospitality",
        organizationId: church.id!,
      });
      const archivedTeamResponse = yield* createTeam(c, {
        token: owner.token!,
        name: "Archived Hospitality",
        organizationId: church.id!,
      });
      const team = (yield* Effect.promise(() => teamResponse.json())) as { id?: string };
      const archivedTeam = (yield* Effect.promise(() => archivedTeamResponse.json())) as {
        id?: string;
      };
      const authenticated = yield* authenticatedConfect(c, {
        userId: owner.user!.id!,
        sessionToken: owner.token!,
      });
      yield* authenticated.mutation(refs.public.teams.updateProductFields, {
        churchId: church.id!,
        updates: [{ teamId: archivedTeam.id!, fields: { archivedAt: "2026-06-01T00:00:00.000Z" } }],
      });
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      // Every Team owns its Workflow (ADR 0013): the new Team's Workflow was
      // seeded through the Better Auth create-team hook.
      const teamWorkflow = workflowForTeam(defaults, team.id!);
      const teamTodo = statusForTeam(defaults, team.id!, "todo");
      const starterTeamId = yield* firstTeamId(authenticated, church.id!);
      const starterTodo = statusForTeam(defaults, starterTeamId, "todo");

      const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Prepare welcome table",
            teamId: team.id!,
            assignedUserId: owner.user!.id!,
            workflowStatusId: teamTodo.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
        ],
      });
      const mismatchedStatus = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Wrong Workflow Status",
            teamId: team.id!,
            workflowStatusId: starterTodo.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
        ],
      });
      const archivedTeamCreate = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Archived Team Task",
            teamId: archivedTeam.id!,
            workflowStatusId: teamTodo.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
        ],
      });

      expect(
        created.data.tasks.find((task) => task.title === "Prepare welcome table"),
      ).toMatchObject({
        teamId: team.id,
        assignedUserId: owner.user!.id,
        workflowId: teamWorkflow.id,
        workflowStatusId: teamTodo.id,
        taskState: "todo",
      });
      expect(mismatchedStatus).toEqual({
        ok: false,
        operation: "createTasks",
        error: {
          code: "workflow_status_not_in_effective_workflow",
          message: "Workflow Status must belong to the Task's effective Workflow.",
        },
      });
      expect(archivedTeamCreate).toEqual({
        ok: false,
        operation: "createTasks",
        error: {
          code: "team_not_found",
          message: "Team was not found in the active Church.",
        },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Task creation rejects Tasks without a Team", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const ownerResponse = yield* signUpWithEmail(
        c,
        `agent-task-team-required-${crypto.randomUUID()}@example.com`,
      );
      const owner = (yield* Effect.promise(() => ownerResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: owner.token!,
        name: "Task Team Required Church",
        slug: `task-team-required-${crypto.randomUUID()}`,
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

      // Every Task belongs to exactly one Team (ADR 0013): a null team no
      // longer passes the creation args, so no code path can create a
      // team-less Task through the centralized creation helper.
      const teamlessExit = yield* authenticated
        .mutation(refs.public.tasks.createBatch, {
          churchId: church.id!,
          tasks: [
            {
              title: "Teamless Task",
              teamId: null as unknown as string,
              workflowStatusId: todoStatus.id,
              dueDate: "2026-06-03",
              parentTaskId: null,
            },
          ],
        })
        .pipe(Effect.exit);

      expect(teamlessExit._tag).toBe("Failure");

      const listed = yield* authenticated.query(refs.public.tasks.listForChurch, {
        churchId: church.id!,
      });
      expect(listed.data.tasks).toEqual([]);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Task update assigns and unassigns Users with Activity history", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const ownerResponse = yield* signUpWithEmail(
        c,
        `agent-task-update-owner-${crypto.randomUUID()}@example.com`,
      );
      const memberResponse = yield* signUpWithEmail(
        c,
        `agent-task-update-member-${crypto.randomUUID()}@example.com`,
      );
      const outsiderResponse = yield* signUpWithEmail(
        c,
        `agent-task-update-outsider-${crypto.randomUUID()}@example.com`,
      );
      const owner = (yield* Effect.promise(() => ownerResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const member = (yield* Effect.promise(() => memberResponse.json())) as {
        user?: { id?: string };
      };
      const outsider = (yield* Effect.promise(() => outsiderResponse.json())) as {
        user?: { id?: string };
      };
      const churchResponse = yield* createChurch(c, {
        token: owner.token!,
        name: "Task Update Assignment Church",
        slug: `task-update-assignment-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();
          yield* Effect.promise(() =>
            ctx.runMutation(components.betterAuth.adapter.create, {
              input: {
                model: "member",
                data: {
                  userId: member.user!.id!,
                  organizationId: church.id!,
                  role: "member",
                  createdAt: Date.now(),
                },
              },
            }),
          );
        }),
        Schema.Void,
      );
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
      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Assign through update",
            teamId: taskTeamId,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
        ],
      });
      const task = created.data.tasks.find(
        (candidate) => candidate.title === "Assign through update",
      )!;

      const assigned = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: task.id, fields: { assignedUserId: member.user!.id! } }],
      });
      const unassigned = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: task.id, fields: { assignedUserId: null } }],
      });
      const renamed = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: task.id, fields: { title: "Renamed through update" } }],
      });
      const rejected = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: task.id, fields: { assignedUserId: outsider.user!.id! } }],
      });
      const activities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "task",
        entityId: task.id,
      });

      expect(assigned.data.tasks.find((candidate) => candidate.id === task.id)).toMatchObject({
        assignedUserId: member.user!.id!,
      });
      expect(unassigned.data.tasks.find((candidate) => candidate.id === task.id)).toMatchObject({
        assignedUserId: null,
      });
      expect(renamed.data.tasks.find((candidate) => candidate.id === task.id)).toMatchObject({
        title: "Renamed through update",
      });
      expect(rejected).toEqual({
        ok: false,
        operation: "updateTasks",
        error: {
          code: "assigned_user_not_church_member",
          message: "Assigned User must be a Church Member of the Task's Church.",
        },
      });
      expect(activities.data.activities.map((activity) => activity.eventType)).toEqual([
        "task.created",
        "task.user_assigned",
        "task.user_unassigned",
        "task.updated",
      ]);
      expect(activities.data.activities.map((activity) => activity.actorId)).toEqual([
        owner.user!.id!,
        owner.user!.id!,
        owner.user!.id!,
        owner.user!.id!,
      ]);
      expect(activities.data.activities[1]!.metadata).toEqual({
        previousAssignedUserId: null,
        assignedUserId: member.user!.id!,
      });
      expect(activities.data.activities[2]!.metadata).toEqual({
        previousAssignedUserId: member.user!.id!,
      });
      expect(activities.data.activities[3]!.metadata).toEqual({
        updatedFields: ["title"],
        previousTitle: "Assign through update",
        title: "Renamed through update",
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Task update moves Tasks between Teams with Workflow remap Activity", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const ownerResponse = yield* signUpWithEmail(
        c,
        `agent-task-team-update-owner-${crypto.randomUUID()}@example.com`,
      );
      const owner = (yield* Effect.promise(() => ownerResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: owner.token!,
        name: "Task Team Update Church",
        slug: `task-team-update-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: owner.user!.id!,
        sessionToken: owner.token!,
      });
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      const todoStatus = statusForTeam(defaults, taskTeamId, "todo");
      const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Team move task",
            teamId: taskTeamId,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
        ],
      });

      expect(created.data.tasks[0]?.teamId).toBe(taskTeamId);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Task estimate persists through create, update, and clear with Activity", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const ownerResponse = yield* signUpWithEmail(
        c,
        `agent-task-estimate-owner-${crypto.randomUUID()}@example.com`,
      );
      const owner = (yield* Effect.promise(() => ownerResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: owner.token!,
        name: "Task Estimate Church",
        slug: `task-estimate-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: owner.user!.id!,
        sessionToken: owner.token!,
      });
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      const todoStatus = statusForTeam(defaults, taskTeamId, "todo");
      const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Estimated task",
            teamId: taskTeamId,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
            estimate: "m",
          },
          {
            title: "Unestimated task",
            teamId: taskTeamId,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
        ],
      });
      const estimated = created.data.tasks.find(
        (candidate) => candidate.title === "Estimated task",
      )!;
      const unestimated = created.data.tasks.find(
        (candidate) => candidate.title === "Unestimated task",
      )!;

      const resized = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: estimated.id, fields: { estimate: "l" } }],
      });
      const cleared = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: estimated.id, fields: { estimate: null } }],
      });
      const activities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "task",
        entityId: estimated.id,
      });

      expect(estimated.estimate).toBe("m");
      expect(unestimated.estimate).toBeNull();
      expect(resized.data.tasks.find((candidate) => candidate.id === estimated.id)).toMatchObject({
        estimate: "l",
      });
      expect(cleared.data.tasks.find((candidate) => candidate.id === estimated.id)).toMatchObject({
        estimate: null,
      });
      expect(activities.data.activities.map((activity) => activity.eventType)).toEqual([
        "task.created",
        "task.updated",
        "task.updated",
      ]);
      expect(activities.data.activities[1]!.metadata).toEqual({
        updatedFields: ["estimate"],
      });
      expect(activities.data.activities[2]!.metadata).toEqual({
        updatedFields: ["estimate"],
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Task update assigns and unassigns Teams with Workflow remap Activity", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const ownerResponse = yield* signUpWithEmail(
        c,
        `agent-task-team-update-owner-${crypto.randomUUID()}@example.com`,
      );
      const owner = (yield* Effect.promise(() => ownerResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: owner.token!,
        name: "Task Team Update Church",
        slug: `task-team-update-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const teamResponse = yield* createTeam(c, {
        token: owner.token!,
        name: "Care",
        organizationId: church.id!,
      });
      const secondTeamResponse = yield* createTeam(c, {
        token: owner.token!,
        name: "Grounds",
        organizationId: church.id!,
      });
      const invalidTeamResponse = yield* createTeam(c, {
        token: owner.token!,
        name: "Invalid Remap",
        organizationId: church.id!,
      });
      const team = (yield* Effect.promise(() => teamResponse.json())) as { id?: string };
      const secondTeam = (yield* Effect.promise(() => secondTeamResponse.json())) as {
        id?: string;
      };
      const invalidTeam = (yield* Effect.promise(() => invalidTeamResponse.json())) as {
        id?: string;
      };
      const authenticated = yield* authenticatedConfect(c, {
        userId: owner.user!.id!,
        sessionToken: owner.token!,
      });
      const teams = yield* authenticated.query(refs.public.teams.listForChurch, {
        churchId: church.id!,
      });
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      // Every Team owns its Workflow (ADR 0013): each Team created above was
      // seeded its own To Do / In Progress / Done Workflow.
      const teamWorkflow = workflowForTeam(defaults, team.id!);
      const teamTodo = statusForTeam(defaults, team.id!, "todo");
      const secondTeamWorkflow = workflowForTeam(defaults, secondTeam.id!);
      const secondTeamTodo = statusForTeam(defaults, secondTeam.id!, "todo");
      const invalidTodo = statusForTeam(defaults, invalidTeam.id!, "todo");
      // Archive the invalid Team's only To Do status so a todo Task cannot
      // preserve its Task State in that Team's Workflow.
      yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();
          yield* Effect.promise(() =>
            ctx.db.patch(invalidTodo.id as Id<"workflowStatuses">, {
              archivedAt: "2026-06-01T00:00:00.000Z",
            }),
          );
        }),
        Schema.Void,
      );
      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      const sourceWorkflow = workflowForTeam(defaults, taskTeamId);
      const sourceTodo = statusForTeam(defaults, taskTeamId, "todo");
      const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Assign Team through update",
            teamId: taskTeamId,
            workflowStatusId: sourceTodo.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
        ],
      });
      const task = created.data.tasks.find(
        (candidate) => candidate.title === "Assign Team through update",
      )!;
      yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Existing destination task",
            teamId: secondTeam.id!,
            workflowStatusId: secondTeamTodo.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
        ],
      });

      const assigned = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: task.id, fields: { teamId: team.id! } }],
      });
      const changed = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: task.id, fields: { teamId: secondTeam.id! } }],
      });
      const rejected = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: task.id, fields: { teamId: invalidTeam.id! } }],
      });
      const activities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "task",
        entityId: task.id,
      });
      const assignedTask = assigned.data.tasks.find((candidate) => candidate.id === task.id)!;
      const changedTask = changed.data.tasks.find((candidate) => candidate.id === task.id)!;
      const sourceTeam = teams.data.teams.find((candidate) => candidate.id === taskTeamId)!;
      const firstDestinationTeam = teams.data.teams.find((candidate) => candidate.id === team.id)!;
      const secondDestinationTeam = teams.data.teams.find(
        (candidate) => candidate.id === secondTeam.id,
      )!;
      const resolvedInitialAlias = yield* authenticated.query(
        refs.public.tasks.resolveByIdentifier,
        {
          churchId: church.id!,
          identifier: task.identifier.toLowerCase(),
        },
      );
      const resolvedFirstMoveAlias = yield* authenticated.query(
        refs.public.tasks.resolveByIdentifier,
        {
          churchId: church.id!,
          identifier: assignedTask.identifier,
        },
      );

      expect(assignedTask).toMatchObject({
        teamId: team.id,
        number: 1,
        identifier: `${firstDestinationTeam.identifier}-1`,
        workflowId: teamWorkflow.id,
        workflowStatusId: teamTodo.id,
        taskState: "todo",
      });
      expect(changedTask).toMatchObject({
        teamId: secondTeam.id,
        number: 2,
        identifier: `${secondDestinationTeam.identifier}-2`,
        workflowId: secondTeamWorkflow.id,
        workflowStatusId: secondTeamTodo.id,
        taskState: "todo",
      });
      expect(resolvedInitialAlias.data.tasks[0]).toMatchObject({
        id: task.id,
        identifier: changedTask.identifier,
      });
      expect(resolvedFirstMoveAlias.data.tasks[0]).toMatchObject({
        id: task.id,
        identifier: changedTask.identifier,
      });
      expect(rejected).toEqual({
        ok: false,
        operation: "updateTasks",
        error: {
          code: "workflow_status_remap_failed",
          message: "Destination Workflow cannot preserve the Task State.",
        },
      });
      expect(activities.data.activities.map((activity) => activity.eventType)).toEqual([
        "task.created",
        "task.team_changed",
        "task.renumbered",
        "task.team_changed",
        "task.renumbered",
      ]);
      expect(activities.data.activities.map((activity) => activity.actorId)).toEqual([
        owner.user!.id!,
        owner.user!.id!,
        owner.user!.id!,
        owner.user!.id!,
        owner.user!.id!,
      ]);
      expect(activities.data.activities[1]!.metadata).toEqual({
        previousTeamId: taskTeamId,
        teamId: team.id,
        previousWorkflowId: sourceWorkflow.id,
        workflowId: teamWorkflow.id,
        previousWorkflowStatusId: sourceTodo.id,
        workflowStatusId: teamTodo.id,
      });
      expect(activities.data.activities[2]!.metadata).toEqual({
        previousIdentifier: task.identifier,
        identifier: assignedTask.identifier,
        previousNumber: task.number,
        number: assignedTask.number,
        previousTeamId: taskTeamId,
        teamId: team.id,
      });
      expect(activities.data.activities[3]!.metadata).toEqual({
        previousTeamId: team.id,
        teamId: secondTeam.id,
        previousWorkflowId: teamWorkflow.id,
        workflowId: secondTeamWorkflow.id,
        previousWorkflowStatusId: teamTodo.id,
        workflowStatusId: secondTeamTodo.id,
      });
      expect(activities.data.activities[4]!.metadata).toEqual({
        previousIdentifier: assignedTask.identifier,
        identifier: changedTask.identifier,
        previousNumber: assignedTask.number,
        number: changedTask.number,
        previousTeamId: team.id,
        teamId: secondTeam.id,
      });
      expect(task.identifier).toBe(`${sourceTeam.identifier}-${task.number}`);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Task update moves Due Date and Cycle while preserving Due Date-derived Cycle", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const ownerResponse = yield* signUpWithEmail(
        c,
        `agent-task-date-cycle-owner-${crypto.randomUUID()}@example.com`,
      );
      const owner = (yield* Effect.promise(() => ownerResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: owner.token!,
        name: "Task Date Cycle Church",
        slug: `task-date-cycle-${crypto.randomUUID()}`,
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

      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Move date and cycle",
            teamId: taskTeamId,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
          {
            title: "Create next cycle",
            teamId: taskTeamId,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-10",
            parentTaskId: null,
          },
          {
            title: "Create later cycle",
            teamId: taskTeamId,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-24",
            parentTaskId: null,
          },
        ],
      });
      const task = created.data.tasks.find(
        (candidate) => candidate.title === "Move date and cycle",
      )!;
      const originalCycleId = task.cycleId;
      const nextCycleId = created.data.tasks.find(
        (candidate) => candidate.title === "Create next cycle",
      )!.cycleId;
      const laterCycleId = created.data.tasks.find(
        (candidate) => candidate.title === "Create later cycle",
      )!.cycleId;

      const sameWeek = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: task.id, fields: { dueDate: "2026-06-04" } }],
      });
      const crossWeek = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: task.id, fields: { dueDate: "2026-06-10" } }],
      });
      const oneWeekCycleMove = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: task.id, fields: { cycleId: originalCycleId } }],
      });
      const multiWeekCycleMove = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: task.id, fields: { cycleId: laterCycleId } }],
      });
      const invalidDueDate = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: task.id, fields: { dueDate: "2026-02-30" } }],
      });
      const activities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "task",
        entityId: task.id,
      });

      expect(sameWeek.data.tasks.find((candidate) => candidate.id === task.id)).toMatchObject({
        dueDate: "2026-06-04",
        cycleId: originalCycleId,
      });
      expect(crossWeek.data.tasks.find((candidate) => candidate.id === task.id)).toMatchObject({
        dueDate: "2026-06-10",
        cycleId: nextCycleId,
      });
      expect(
        oneWeekCycleMove.data.tasks.find((candidate) => candidate.id === task.id),
      ).toMatchObject({
        dueDate: "2026-06-03",
        cycleId: originalCycleId,
      });
      expect(
        multiWeekCycleMove.data.tasks.find((candidate) => candidate.id === task.id),
      ).toMatchObject({
        dueDate: "2026-06-24",
        cycleId: laterCycleId,
      });
      expect(invalidDueDate).toEqual({
        ok: false,
        operation: "updateTasks",
        error: {
          code: "invalid_due_date",
          message: "Task Due Date must be a real Church-local date in YYYY-MM-DD format.",
        },
      });
      expect(activities.data.activities.map((activity) => activity.eventType)).toEqual([
        "task.created",
        "task.due_date_changed",
        "task.due_date_changed",
        "task.cycle_changed",
        "task.cycle_changed",
      ]);
      expect(activities.data.activities.map((activity) => activity.actorId)).toEqual([
        owner.user!.id!,
        owner.user!.id!,
        owner.user!.id!,
        owner.user!.id!,
        owner.user!.id!,
      ]);
      expect(activities.data.activities[1]!.metadata).toEqual({
        previousDueDate: "2026-06-03",
        dueDate: "2026-06-04",
        previousCycleId: originalCycleId,
        cycleId: originalCycleId,
      });
      expect(activities.data.activities[2]!.metadata).toEqual({
        previousDueDate: "2026-06-04",
        dueDate: "2026-06-10",
        previousCycleId: originalCycleId,
        cycleId: nextCycleId,
      });
      expect(activities.data.activities[3]!.metadata).toEqual({
        previousCycleId: nextCycleId,
        cycleId: originalCycleId,
        previousDueDate: "2026-06-10",
        dueDate: "2026-06-03",
      });
      expect(activities.data.activities[4]!.metadata).toEqual({
        previousCycleId: originalCycleId,
        cycleId: laterCycleId,
        previousDueDate: "2026-06-03",
        dueDate: "2026-06-24",
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Task execution-window reads filter My Work and Our Work", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const ownerResponse = yield* signUpWithEmail(
        c,
        `agent-task-execution-owner-${crypto.randomUUID()}@example.com`,
      );
      const memberResponse = yield* signUpWithEmail(
        c,
        `agent-task-execution-member-${crypto.randomUUID()}@example.com`,
      );
      const owner = (yield* Effect.promise(() => ownerResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const member = (yield* Effect.promise(() => memberResponse.json())) as {
        user?: { id?: string };
      };
      const churchResponse = yield* createChurch(c, {
        token: owner.token!,
        name: "Task Execution Window Church",
        slug: `task-execution-window-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();
          yield* Effect.promise(() =>
            ctx.runMutation(components.betterAuth.adapter.create, {
              input: {
                model: "member",
                data: {
                  userId: member.user!.id!,
                  organizationId: church.id!,
                  role: "member",
                  createdAt: Date.now(),
                },
              },
            }),
          );
        }),
        Schema.Void,
      );
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
      const doneStatus = defaults.data.workflowStatuses.find(
        (status) => status.taskState === "done",
      )!;

      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Current assigned to me",
            teamId: taskTeamId,
            assignedUserId: owner.user!.id!,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
          {
            title: "Current assigned to another member",
            teamId: taskTeamId,
            assignedUserId: member.user!.id!,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
          {
            title: "Overdue assigned to me",
            teamId: taskTeamId,
            assignedUserId: owner.user!.id!,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-05-29",
            parentTaskId: null,
          },
          {
            title: "Future assigned to me",
            teamId: taskTeamId,
            assignedUserId: owner.user!.id!,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-10",
            parentTaskId: null,
          },
          {
            title: "Finished during cycle assigned to me",
            teamId: taskTeamId,
            assignedUserId: owner.user!.id!,
            workflowStatusId: doneStatus.id,
            dueDate: "2026-06-02",
            parentTaskId: null,
          },
          {
            title: "Finished before cycle assigned to me",
            teamId: taskTeamId,
            assignedUserId: owner.user!.id!,
            workflowStatusId: doneStatus.id,
            dueDate: "2026-05-28",
            parentTaskId: null,
          },
        ],
      });
      const cycle = created.data.cycles.find((candidate) => candidate.startDate === "2026-06-01")!;
      const finishedDuring = created.data.tasks.find(
        (task) => task.title === "Finished during cycle assigned to me",
      )!;
      const finishedBefore = created.data.tasks.find(
        (task) => task.title === "Finished before cycle assigned to me",
      )!;
      yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();
          yield* Effect.promise(() =>
            ctx.db.patch(finishedDuring.id as Id<"tasks">, {
              taskState: "done",
              finishedAt: "2026-06-03T12:00:00.000Z",
            }),
          );
          yield* Effect.promise(() =>
            ctx.db.patch(finishedBefore.id as Id<"tasks">, {
              taskState: "done",
              finishedAt: "2026-05-31T12:00:00.000Z",
            }),
          );
        }),
        Schema.Void,
      );

      const myWork = yield* authenticated.query(refs.public.tasks.listForChurch, {
        churchId: church.id!,
        surface: "my_work",
        cycleId: cycle.id,
      });
      const ourWork = yield* authenticated.query(refs.public.tasks.listForChurch, {
        churchId: church.id!,
        surface: "our_work",
        cycleId: cycle.id,
      });

      expect(myWork.data.tasks.map((task) => task.title).sort()).toEqual([
        "Current assigned to me",
        "Finished during cycle assigned to me",
        "Overdue assigned to me",
      ]);
      expect(ourWork.data.tasks.map((task) => task.title).sort()).toEqual([
        "Current assigned to another member",
        "Current assigned to me",
        "Finished during cycle assigned to me",
        "Overdue assigned to me",
      ]);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Task transitions complete, cancel, and reopen through public operations", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-task-transitions-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Task Transition Church",
        slug: `task-transition-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      // Every Team owns its Workflow (ADR 0013): statuses come from the Task
      // Team's own Workflow.
      const teamWorkflow = workflowForTeam(defaults, taskTeamId);
      const todoStatus = statusForTeam(defaults, taskTeamId, "todo");
      const doingStatus = statusForTeam(defaults, taskTeamId, "in_progress");
      const doneStatus = statusForTeam(defaults, taskTeamId, "done");
      const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Complete me",
            teamId: taskTeamId,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
          {
            title: "Cancel me",
            teamId: taskTeamId,
            workflowStatusId: doingStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
        ],
      });
      const completeMe = created.data.tasks.find((task) => task.title === "Complete me")!;
      const cancelMe = created.data.tasks.find((task) => task.title === "Cancel me")!;

      const completed = yield* authenticated.mutation(refs.public.tasks.completeBatch, {
        churchId: church.id!,
        taskIds: [completeMe.id],
      });
      const canceled = yield* authenticated.mutation(refs.public.tasks.cancelBatch, {
        churchId: church.id!,
        taskIds: [cancelMe.id],
      });
      const reopened = yield* authenticated.mutation(refs.public.tasks.reopenBatch, {
        churchId: church.id!,
        taskIds: [cancelMe.id],
      });
      const completedTask = completed.data.tasks.find((task) => task.id === completeMe.id)!;
      const canceledTask = canceled.data.tasks.find((task) => task.id === cancelMe.id)!;
      const reopenedTask = reopened.data.tasks.find((task) => task.id === cancelMe.id)!;
      const completedActivities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "task",
        entityId: completeMe.id,
      });
      const transitionActivities = yield* authenticated.query(
        refs.public.activities.listForEntity,
        {
          churchId: church.id!,
          entityType: "task",
          entityId: cancelMe.id,
        },
      );

      const inconsistentTaskId = yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();

          return yield* Effect.promise(() =>
            ctx.db.insert("tasks", {
              churchId: church.id!,
              title: "Inconsistent Task",
              teamId: taskTeamId,
              // Test fixture bypassing createTasks; a fixed number is fine here.
              number: 9999,
              previousIdentifiers: [],
              assignedUserId: null,
              cycleId: cancelMe.cycleId,
              dueDate: "2026-06-03",
              parentTaskId: null,
              workflowId: teamWorkflow.id,
              workflowStatusId: todoStatus.id,
              taskState: "done",
              boardOrder: "a0",
              finishedAt: null,
              sourceTemplateId: null,
              sourceTemplateTaskId: null,
              sourceTemplateCycleId: null,
              sourceTemplateSyncEnabled: false,
            }),
          );
        }),
        Schema.String,
      );
      const inconsistent = yield* authenticated.mutation(refs.public.tasks.completeBatch, {
        churchId: church.id!,
        taskIds: [inconsistentTaskId],
      });

      expect(completedTask).toMatchObject({
        taskState: "done",
        workflowStatusId: doneStatus.id,
      });
      expect(completedTask.finishedAt).toEqual(expect.any(String));
      expect(canceledTask).toMatchObject({
        taskState: "canceled",
        workflowStatusId: doneStatus.id,
      });
      expect(canceledTask.finishedAt).toEqual(expect.any(String));
      expect(reopenedTask).toMatchObject({
        taskState: "in_progress",
        workflowStatusId: doingStatus.id,
        finishedAt: null,
      });
      expect(completedActivities.data.activities.map((activity) => activity.eventType)).toEqual([
        "task.created",
        "task.completed",
      ]);
      expect(completedActivities.data.activities.map((activity) => activity.actorId)).toEqual([
        signUpBody.user!.id!,
        signUpBody.user!.id!,
      ]);
      expect(transitionActivities.data.activities.map((activity) => activity.eventType)).toEqual([
        "task.created",
        "task.canceled",
        "task.reopened",
      ]);
      expect(transitionActivities.data.activities.map((activity) => activity.actorId)).toEqual([
        signUpBody.user!.id!,
        signUpBody.user!.id!,
        signUpBody.user!.id!,
      ]);
      expect(transitionActivities.data.activities[1]!.metadata).toMatchObject({
        previousTaskState: "in_progress",
        previousWorkflowStatusId: doingStatus.id,
        previousWorkflowStatusName: doingStatus.name,
      });
      expect(inconsistent).toEqual({
        ok: false,
        operation: "completeTasks",
        error: {
          code: "inconsistent_task_status",
          message: "Task State and Workflow Status are inconsistent.",
        },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Task status movement derives Task State and records Activity", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-task-status-move-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Task Status Move Church",
        slug: `task-status-move-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      // Another Team's Workflow stands in for "a status outside the Task's
      // own Workflow" (ADR 0013: every Team owns its Workflow).
      const otherTeamResponse = yield* createTeam(c, {
        token: signUpBody.token!,
        name: "Status Move Other",
        organizationId: church.id!,
      });
      const otherTeam = (yield* Effect.promise(() => otherTeamResponse.json())) as { id?: string };
      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const todoStatus = statusForTeam(defaults, taskTeamId, "todo");
      const doingStatus = statusForTeam(defaults, taskTeamId, "in_progress");
      const doneStatus = statusForTeam(defaults, taskTeamId, "done");
      const otherTodoStatus = statusForTeam(defaults, otherTeam.id!, "todo");
      const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Move through board",
            teamId: taskTeamId,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
        ],
      });
      const task = created.data.tasks.find(
        (candidate) => candidate.title === "Move through board",
      )!;

      const moved = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: task.id, fields: { workflowStatusId: doingStatus.id } }],
      });
      const movedTask = moved.data.tasks.find((candidate) => candidate.id === task.id)!;
      const finished = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: task.id, fields: { workflowStatusId: doneStatus.id } }],
      });
      const finishedTask = finished.data.tasks.find((candidate) => candidate.id === task.id)!;
      const invalid = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: task.id, fields: { workflowStatusId: otherTodoStatus.id } }],
      });
      const createdCanceled = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Canceled task stays action-only",
            teamId: taskTeamId,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
        ],
      });
      const canceledTask = createdCanceled.data.tasks.find(
        (candidate) => candidate.title === "Canceled task stays action-only",
      )!;
      yield* authenticated.mutation(refs.public.tasks.cancelBatch, {
        churchId: church.id!,
        taskIds: [canceledTask.id],
      });
      const canceledMove = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: canceledTask.id, fields: { workflowStatusId: doingStatus.id } }],
      });
      const activities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "task",
        entityId: task.id,
      });

      expect(movedTask).toMatchObject({
        workflowStatusId: doingStatus.id,
        taskState: "in_progress",
        finishedAt: null,
      });
      expect(finishedTask).toMatchObject({
        workflowStatusId: doneStatus.id,
        taskState: "done",
      });
      expect(finishedTask.finishedAt).toEqual(expect.any(String));
      expect(invalid).toEqual({
        ok: false,
        operation: "updateTasks",
        error: {
          code: "workflow_status_not_in_effective_workflow",
          message: "Workflow Status must belong to the Task's effective Workflow.",
        },
      });
      expect(canceledMove).toEqual({
        ok: false,
        operation: "updateTasks",
        error: {
          code: "invalid_task_transition",
          message: "Task cannot perform that transition from its current state.",
        },
      });
      expect(activities.data.activities.map((activity) => activity.eventType)).toEqual([
        "task.created",
        "task.status_moved",
        "task.status_moved",
      ]);
      expect(activities.data.activities[1]).toMatchObject({
        actorId: signUpBody.user!.id!,
        metadata: {
          previousTaskState: "todo",
          taskState: "in_progress",
          previousWorkflowStatusId: todoStatus.id,
          previousWorkflowStatusName: todoStatus.name,
          workflowStatusId: doingStatus.id,
          workflowStatusName: doingStatus.name,
        },
      });
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
      const memberships = yield* authenticated.query(refs.public.teams.listMembershipsForChurch, {
        churchId: church.id!,
      });

      expect(initialRead.ok).toBe(true);
      expect(initialRead.data.teams).toContainEqual({
        id: team.id,
        name: "Worship Team",
        churchId: church.id,
        archivedAt: null,
        color: "pink",
        // Raw Better Auth team creation stores no identifier; reads fall
        // back to the name-derived base.
        identifier: "WOR",
        previousIdentifiers: [],
        sortOrder: 0,
      });
      expect(memberships.data.teamMemberships).toContainEqual({
        id: expect.any(String),
        churchId: church.id!,
        teamId: team.id!,
        userId: signUpBody.user!.id!,
      });

      const updated = yield* authenticated.mutation(refs.public.teams.updateProductFields, {
        churchId: church.id!,
        updates: [
          {
            teamId: team.id!,
            fields: {
              archivedAt: "2026-06-01T00:00:00.000Z",
              sortOrder: 7,
            },
          },
        ],
      });

      expect(updated.ok).toBe(true);
      expect(updated.data.teams).toContainEqual({
        id: team.id,
        name: "Worship Team",
        churchId: church.id,
        archivedAt: "2026-06-01T00:00:00.000Z",
        color: "pink",
        identifier: "WOR",
        previousIdentifiers: [],
        sortOrder: 7,
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Better Auth hooks record product-visible Activities", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const ownerEmail = `agent-auth-hook-owner-${crypto.randomUUID()}@example.com`;
      const ownerSignUpResponse = yield* signUpWithEmail(c, ownerEmail);
      const ownerSignUpBody = (yield* Effect.promise(() => ownerSignUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: ownerSignUpBody.token!,
        name: "Auth Hook Church",
        slug: `auth-hook-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const teamResponse = yield* createTeam(c, {
        token: ownerSignUpBody.token!,
        name: "Care Team",
        organizationId: church.id!,
      });
      const team = (yield* Effect.promise(() => teamResponse.json())) as { id?: string };
      const addTeamMemberResponse = yield* addTeamMember(c, {
        token: ownerSignUpBody.token!,
        userId: ownerSignUpBody.user!.id!,
        organizationId: church.id!,
        teamId: team.id!,
      });
      const removeTeamMemberResponse = yield* removeTeamMember(c, {
        token: ownerSignUpBody.token!,
        userId: ownerSignUpBody.user!.id!,
        organizationId: church.id!,
        teamId: team.id!,
      });
      const authenticated = yield* authenticatedConfect(c, {
        userId: ownerSignUpBody.user!.id!,
        sessionToken: ownerSignUpBody.token!,
      });

      expect(churchResponse.status).toBe(200);
      expect(teamResponse.status).toBe(200);
      expect(addTeamMemberResponse.status).toBe(200);
      expect(removeTeamMemberResponse.status).toBe(200);

      const churchActivities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "church",
        entityId: church.id!,
      });
      const teamActivities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "team",
        entityId: team.id!,
      });

      expect(churchActivities.data.activities.map((activity) => activity.eventType)).toEqual([
        "church.member.added",
        "church.created",
      ]);
      expect(churchActivities.data.activities[0]!.metadata).toEqual({
        memberUserId: ownerSignUpBody.user!.id,
        role: "owner",
      });
      expect(churchActivities.data.activities[1]!.metadata).toMatchObject({
        name: "Auth Hook Church",
        churchTimeZone: "America/New_York",
      });
      expect(teamActivities.data.activities.map((activity) => activity.eventType)).toEqual([
        "team.created",
        "team.member.added",
        "team.member.removed",
      ]);
      expect(teamActivities.data.activities.map((activity) => activity.actorType)).toEqual([
        "better_auth",
        "better_auth",
        "better_auth",
      ]);
      expect(teamActivities.data.activities[0]!.metadata).toEqual({ name: "Care Team" });
      expect(teamActivities.data.activities[1]!.metadata).toEqual({
        memberUserId: ownerSignUpBody.user!.id,
      });
      expect(teamActivities.data.activities[2]!.metadata).toEqual({
        memberUserId: ownerSignUpBody.user!.id,
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("owners manage Teams through public setup operations", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-team-setup-owner-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Team Setup Church",
        slug: `team-setup-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      const created = yield* authenticated.mutation(refs.public.teams.createForChurch, {
        churchId: church.id!,
        name: "Care",
      });
      const care = created.data.teams.find((team) => team.name === "Care")!;
      const renamed = yield* authenticated.mutation(refs.public.teams.renameForChurch, {
        churchId: church.id!,
        teamId: care.id,
        name: "Pastoral Care",
      });
      const reordered = yield* authenticated.mutation(refs.public.teams.reorderForChurch, {
        churchId: church.id!,
        teamIds: [
          care.id,
          ...renamed.data.teams.filter((team) => team.id !== care.id).map((team) => team.id),
        ],
      });
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      // Every Team owns its Workflow (ADR 0013): the Task uses the Care
      // Team's own To Do status.
      const todoStatus = statusForTeam(defaults, care.id, "todo");
      const createdTask = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Prepare care roster",
            teamId: care.id,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-07",
            parentTaskId: null,
          },
        ],
      });
      const archived = yield* authenticated.mutation(refs.public.teams.archiveForChurch, {
        churchId: church.id!,
        teamId: care.id,
      });
      const tasks = yield* authenticated.query(refs.public.tasks.listForChurch, {
        churchId: church.id!,
      });
      const withArchived = yield* authenticated.query(refs.public.teams.listForChurch, {
        churchId: church.id!,
        includeArchived: true,
      });
      const activities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "team",
        entityId: care.id,
      });

      expect(created.ok).toBe(true);
      expect(renamed.data.teams.find((team) => team.id === care.id)?.name).toBe("Pastoral Care");
      expect(reordered.data.teams[0]).toMatchObject({ id: care.id, sortOrder: 0 });
      expect(
        createdTask.data.tasks.find((task) => task.title === "Prepare care roster"),
      ).toMatchObject({
        teamId: care.id,
      });
      expect(archived.data.teams.some((team) => team.id === care.id)).toBe(false);
      expect(tasks.data.tasks.find((task) => task.title === "Prepare care roster")).toMatchObject({
        teamId: care.id,
      });
      expect(withArchived.data.teams.find((team) => team.id === care.id)).toMatchObject({
        id: care.id,
        name: "Pastoral Care",
        archivedAt: expect.any(String),
      });
      expect(activities.data.activities.map((activity) => activity.eventType)).toEqual([
        "team.created",
        "team.renamed",
        "team.reordered",
        "team.archived",
      ]);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Team creation seeds the Team its own To Do / In Progress / Done Workflow", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-team-workflow-seed-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Team Workflow Seed Church",
        slug: `team-workflow-seed-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      const created = yield* authenticated.mutation(refs.public.teams.createForChurch, {
        churchId: church.id!,
        name: "Outreach",
      });
      const outreach = created.data.teams.find((team) => team.name === "Outreach")!;
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const workflow = workflowForTeam(defaults, outreach.id);

      // Every Team owns its Workflow (ADR 0013): Team creation seeds it.
      expect(workflow).toMatchObject({
        teamId: outreach.id,
        key: `team-${outreach.id}`,
        name: "Outreach",
        sortOrder: 0,
        archivedAt: null,
      });
      expect(
        defaults.data.workflowStatuses
          .filter((status) => status.workflowId === workflow.id)
          .map((status) => [status.key, status.name, status.taskState, status.sortOrder]),
      ).toEqual([
        ["to-do", "To Do", "todo", 0],
        ["in-progress", "In Progress", "in_progress", 1],
        ["done", "Done", "done", 2],
      ]);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Teams get unique generated Team Identifiers, bumped on collision", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-team-identifier-gen-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Identifier Gen Church",
        slug: `identifier-gen-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      // Starter Teams seeded at Church creation each get a generated
      // identifier, unique within the Church.
      const starters = yield* authenticated.query(refs.public.teams.listForChurch, {
        churchId: church.id!,
      });
      const starterIdentifiers = starters.data.teams.map((team) => team.identifier);
      expect(starterIdentifiers.length).toBeGreaterThan(0);
      for (const identifier of starterIdentifiers) {
        expect(identifier).toMatch(/^[A-Z0-9]{1,7}$/);
      }
      expect(new Set(starterIdentifiers).size).toBe(starterIdentifiers.length);
      expect(starters.data.teams.find((team) => team.name === "Kids")?.identifier).toBe("KID");

      // A new Team whose name collides with a Starter Team's identifier
      // bumps deterministically.
      const created = yield* authenticated.mutation(refs.public.teams.createForChurch, {
        churchId: church.id!,
        name: "Kidmin",
      });
      expect(created.data.teams.find((team) => team.name === "Kidmin")).toMatchObject({
        identifier: "KID2",
        previousIdentifiers: [],
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("owners edit Team Identifiers with validation, uniqueness, and alias history", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-team-identifier-edit-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Identifier Edit Church",
        slug: `identifier-edit-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      const created = yield* authenticated.mutation(refs.public.teams.createForChurch, {
        churchId: church.id!,
        name: "Care",
      });
      const care = created.data.teams.find((team) => team.name === "Care")!;
      expect(care.identifier).toBe("CAR");

      const invalid = yield* authenticated.mutation(refs.public.teams.setIdentifierForChurch, {
        churchId: church.id!,
        teamId: care.id,
        identifier: "TOOLONG8",
      });
      expect(invalid).toMatchObject({
        ok: false,
        operation: "setTeamIdentifier",
        error: { code: "invalid_team_identifier" },
      });

      // Uniqueness within the Church is case-insensitive: "kid" collides
      // with the Kids Starter Team's "KID".
      const taken = yield* authenticated.mutation(refs.public.teams.setIdentifierForChurch, {
        churchId: church.id!,
        teamId: care.id,
        identifier: "kid",
      });
      expect(taken).toMatchObject({
        ok: false,
        operation: "setTeamIdentifier",
        error: { code: "team_identifier_taken" },
      });

      // Lowercase input normalizes to the uppercase canonical form; the
      // previous identifier is remembered as an alias.
      const renamedOnce = yield* authenticated.mutation(refs.public.teams.setIdentifierForChurch, {
        churchId: church.id!,
        teamId: care.id,
        identifier: "pastoral",
      });
      expect(renamedOnce).toMatchObject({
        ok: false,
        operation: "setTeamIdentifier",
        error: { code: "invalid_team_identifier" },
      });

      const first = yield* authenticated.mutation(refs.public.teams.setIdentifierForChurch, {
        churchId: church.id!,
        teamId: care.id,
        identifier: "pastor",
      });
      expect(first.data.teams.find((team) => team.id === care.id)).toMatchObject({
        identifier: "PASTOR",
        previousIdentifiers: ["CAR"],
      });

      const second = yield* authenticated.mutation(refs.public.teams.setIdentifierForChurch, {
        churchId: church.id!,
        teamId: care.id,
        identifier: "CARE",
      });
      expect(second.data.teams.find((team) => team.id === care.id)).toMatchObject({
        identifier: "CARE",
        previousIdentifiers: ["CAR", "PASTOR"],
      });

      // Setting the same identifier again is a no-op: no duplicate alias,
      // no extra activity entry.
      const noop = yield* authenticated.mutation(refs.public.teams.setIdentifierForChurch, {
        churchId: church.id!,
        teamId: care.id,
        identifier: " care ",
      });
      expect(noop.data.teams.find((team) => team.id === care.id)).toMatchObject({
        identifier: "CARE",
        previousIdentifiers: ["CAR", "PASTOR"],
      });

      const activities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "team",
        entityId: care.id,
      });
      const identifierChanges = activities.data.activities.filter(
        (activity) => activity.eventType === "team.identifier_changed",
      );
      expect(identifierChanges.map((activity) => activity.metadata)).toEqual([
        { previousIdentifier: "CAR", identifier: "PASTOR" },
        { previousIdentifier: "PASTOR", identifier: "CARE" },
      ]);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("owners delete a Team without Tasks through public setup operations", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-team-delete-owner-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Team Delete Church",
        slug: `team-delete-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      const created = yield* authenticated.mutation(refs.public.teams.createForChurch, {
        churchId: church.id!,
        name: "Disposable",
      });
      const disposable = created.data.teams.find((team) => team.name === "Disposable")!;

      const deleted = yield* authenticated.mutation(refs.public.teams.deleteForChurch, {
        churchId: church.id!,
        teamId: disposable.id,
      });
      const withArchived = yield* authenticated.query(refs.public.teams.listForChurch, {
        churchId: church.id!,
        includeArchived: true,
      });

      expect(deleted.ok).toBe(true);
      expect(deleted.data.teams.some((team) => team.id === disposable.id)).toBe(false);
      expect(withArchived.data.teams.some((team) => team.id === disposable.id)).toBe(false);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Team delete is blocked while Tasks reference the Team", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-team-delete-blocked-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Team Delete Blocked Church",
        slug: `team-delete-blocked-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      const created = yield* authenticated.mutation(refs.public.teams.createForChurch, {
        churchId: church.id!,
        name: "Busy",
      });
      const busy = created.data.teams.find((team) => team.name === "Busy")!;
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      // Every Team owns its Workflow (ADR 0013): the Task uses the Busy
      // Team's own To Do status.
      const todoStatus = statusForTeam(defaults, busy.id, "todo");
      yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Keep this Team busy",
            teamId: busy.id,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-14",
            parentTaskId: null,
          },
        ],
      });

      const deleted = yield* authenticated.mutation(refs.public.teams.deleteForChurch, {
        churchId: church.id!,
        teamId: busy.id,
      });
      const teams = yield* authenticated.query(refs.public.teams.listForChurch, {
        churchId: church.id!,
      });

      expect(deleted).toEqual({
        ok: false,
        operation: "deleteTeam",
        error: {
          code: "team_has_tasks",
          message: "Teams with Tasks can be archived but not deleted.",
        },
      });
      expect(teams.data.teams.some((team) => team.id === busy.id)).toBe(true);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Team delete and archive are blocked for the last active Team", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-team-floor-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Team Floor Church",
        slug: `team-floor-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      const initialTeams = yield* authenticated.query(refs.public.teams.listForChurch, {
        churchId: church.id!,
      });
      const [remainingTeam, ...discardedTeams] = initialTeams.data.teams;
      expect(remainingTeam).toBeDefined();

      for (const team of discardedTeams) {
        const deleted = yield* authenticated.mutation(refs.public.teams.deleteForChurch, {
          churchId: church.id!,
          teamId: team.id,
        });
        expect(deleted.ok).toBe(true);
      }

      const deleteLast = yield* authenticated.mutation(refs.public.teams.deleteForChurch, {
        churchId: church.id!,
        teamId: remainingTeam!.id,
      });
      const archiveLast = yield* authenticated.mutation(refs.public.teams.archiveForChurch, {
        churchId: church.id!,
        teamId: remainingTeam!.id,
      });
      const teams = yield* authenticated.query(refs.public.teams.listForChurch, {
        churchId: church.id!,
      });

      expect(deleteLast).toEqual({
        ok: false,
        operation: "deleteTeam",
        error: {
          code: "last_team_required",
          message: "A Church must keep at least one active Team.",
        },
      });
      expect(archiveLast).toEqual({
        ok: false,
        operation: "archiveTeam",
        error: {
          code: "last_team_required",
          message: "A Church must keep at least one active Team.",
        },
      });
      expect(teams.data.teams).toEqual([expect.objectContaining({ id: remainingTeam!.id })]);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Church members can read but cannot mutate Team setup", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const ownerEmail = `agent-team-setup-owner-${crypto.randomUUID()}@example.com`;
      const memberEmail = `agent-team-setup-member-${crypto.randomUUID()}@example.com`;
      const ownerResponse = yield* signUpWithEmail(c, ownerEmail);
      const memberResponse = yield* signUpWithEmail(c, memberEmail);
      const owner = (yield* Effect.promise(() => ownerResponse.json())) as { token?: string };
      const member = (yield* Effect.promise(() => memberResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: owner.token!,
        name: "Team Setup Member Church",
        slug: `team-setup-member-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();
          yield* Effect.promise(() =>
            ctx.runMutation(components.betterAuth.adapter.create, {
              input: {
                model: "member",
                data: {
                  userId: member.user!.id!,
                  organizationId: church.id!,
                  role: "member",
                  createdAt: Date.now(),
                },
              },
            }),
          );
        }),
        Schema.Void,
      );
      const memberAuthenticated = yield* authenticatedConfect(c, {
        userId: member.user!.id!,
        sessionToken: member.token!,
      });

      const read = yield* memberAuthenticated.query(refs.public.teams.listForChurch, {
        churchId: church.id!,
      });
      const create = yield* memberAuthenticated.mutation(refs.public.teams.createForChurch, {
        churchId: church.id!,
        name: "Unauthorized Team",
      });

      expect(read.ok).toBe(true);
      expect(read.data.teams.map((team) => team.name)).toContain("Worship");
      expect(create).toEqual({
        ok: false,
        operation: "createTeam",
        error: {
          code: "not_authorized",
          message: "Only Church owners and admins can manage Teams.",
        },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("owners manage Team Membership through public setup operations", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const ownerEmail = `agent-team-membership-owner-${crypto.randomUUID()}@example.com`;
      const adminEmail = `agent-team-membership-admin-${crypto.randomUUID()}@example.com`;
      const memberEmail = `agent-team-membership-member-${crypto.randomUUID()}@example.com`;
      const ownerResponse = yield* signUpWithEmail(c, ownerEmail);
      const adminResponse = yield* signUpWithEmail(c, adminEmail);
      const memberResponse = yield* signUpWithEmail(c, memberEmail);
      const owner = (yield* Effect.promise(() => ownerResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const admin = (yield* Effect.promise(() => adminResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const member = (yield* Effect.promise(() => memberResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: owner.token!,
        name: "Team Membership Church",
        slug: `team-membership-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();
          yield* Effect.promise(() =>
            ctx.runMutation(components.betterAuth.adapter.create, {
              input: {
                model: "member",
                data: {
                  userId: admin.user!.id!,
                  organizationId: church.id!,
                  role: "admin",
                  createdAt: Date.now(),
                },
              },
            }),
          );
          yield* Effect.promise(() =>
            ctx.runMutation(components.betterAuth.adapter.create, {
              input: {
                model: "member",
                data: {
                  userId: member.user!.id!,
                  organizationId: church.id!,
                  role: "member",
                  createdAt: Date.now(),
                },
              },
            }),
          );
        }),
        Schema.Void,
      );
      const ownerAuthenticated = yield* authenticatedConfect(c, {
        userId: owner.user!.id!,
        sessionToken: owner.token!,
      });
      const adminAuthenticated = yield* authenticatedConfect(c, {
        userId: admin.user!.id!,
        sessionToken: admin.token!,
      });
      const memberAuthenticated = yield* authenticatedConfect(c, {
        userId: member.user!.id!,
        sessionToken: member.token!,
      });
      const teams = yield* ownerAuthenticated.query(refs.public.teams.listForChurch, {
        churchId: church.id!,
      });
      const team = teams.data.teams.find((candidate) => candidate.name === "Worship")!;
      const createdTeam = yield* ownerAuthenticated.mutation(refs.public.teams.createForChurch, {
        churchId: church.id!,
        name: "Owner Created Team",
      });
      const ownerMemberships = yield* ownerAuthenticated.query(
        refs.public.teams.listMembershipsForChurch,
        {
          churchId: church.id!,
        },
      );
      const defaults = yield* ownerAuthenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const todoStatus = defaults.data.workflowStatuses.find(
        (status) => status.taskState === "todo",
      )!;
      const createdTask = yield* ownerAuthenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Plan Sunday set",
            teamId: team.id,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-07",
            parentTaskId: null,
          },
        ],
      });

      const added = yield* ownerAuthenticated.mutation(refs.public.teams.addMemberForChurch, {
        churchId: church.id!,
        teamId: team.id,
        userId: member.user!.id!,
      });
      const unauthorized = yield* memberAuthenticated.mutation(
        refs.public.teams.removeMemberForChurch,
        {
          churchId: church.id!,
          teamId: team.id,
          userId: member.user!.id!,
        },
      );
      const removed = yield* ownerAuthenticated.mutation(refs.public.teams.removeMemberForChurch, {
        churchId: church.id!,
        teamId: team.id,
        userId: member.user!.id!,
      });
      const adminAdded = yield* adminAuthenticated.mutation(refs.public.teams.addMemberForChurch, {
        churchId: church.id!,
        teamId: team.id,
        userId: member.user!.id!,
      });
      const adminRemoved = yield* adminAuthenticated.mutation(
        refs.public.teams.removeMemberForChurch,
        {
          churchId: church.id!,
          teamId: team.id,
          userId: member.user!.id!,
        },
      );
      const memberTasks = yield* memberAuthenticated.query(refs.public.tasks.listForChurch, {
        churchId: church.id!,
      });
      const activities = yield* ownerAuthenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "team",
        entityId: team.id,
      });

      expect(added.data.teamMemberships).toContainEqual({
        id: expect.any(String),
        churchId: church.id!,
        teamId: team.id,
        userId: member.user!.id!,
      });
      expect(ownerMemberships.data.teamMemberships).toContainEqual({
        id: expect.any(String),
        churchId: church.id!,
        teamId: createdTeam.data.teams.find((candidate) => candidate.name === "Owner Created Team")!
          .id,
        userId: owner.user!.id!,
      });
      expect(unauthorized).toEqual({
        ok: false,
        operation: "removeTeamMember",
        error: {
          code: "not_authorized",
          message: "Only Church owners and admins can manage Team Membership.",
        },
      });
      expect(
        removed.data.teamMemberships.some(
          (membership) => membership.teamId === team.id && membership.userId === member.user!.id!,
        ),
      ).toBe(false);
      expect(adminAdded.data.teamMemberships).toContainEqual({
        id: expect.any(String),
        churchId: church.id!,
        teamId: team.id,
        userId: member.user!.id!,
      });
      expect(
        adminRemoved.data.teamMemberships.some(
          (membership) => membership.teamId === team.id && membership.userId === member.user!.id!,
        ),
      ).toBe(false);
      expect(createdTask.data.tasks.find((task) => task.title === "Plan Sunday set")).toMatchObject(
        { teamId: team.id },
      );
      expect(memberTasks.data.tasks.find((task) => task.title === "Plan Sunday set")).toMatchObject(
        {
          teamId: team.id,
        },
      );
      expect(activities.data.activities.map((activity) => activity.eventType)).toEqual([
        "team.member.added",
        "team.member.removed",
        "team.member.added",
        "team.member.removed",
      ]);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Workflow Status edits enforce visible Task States, names, and ordering", () =>
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

      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      // Workflows are only ever seeded per Team (ADR 0013), so status
      // validation now guards the status edit operations.
      const workflow = workflowForTeam(defaults, taskTeamId);
      const todoStatus = statusForTeam(defaults, taskTeamId, "todo");

      const canceledColumn = yield* authenticated.mutation(refs.public.workflows.addStatus, {
        churchId: church.id!,
        workflowId: workflow.id,
        status: { key: "canceled", name: "Canceled", taskState: "canceled", sortOrder: 3 },
      });
      const duplicateName = yield* authenticated.mutation(refs.public.workflows.addStatus, {
        churchId: church.id!,
        workflowId: workflow.id,
        status: {
          key: "doing-again",
          name: "in progress",
          taskState: "in_progress",
          sortOrder: 3,
        },
      });
      const duplicateSort = yield* authenticated.mutation(refs.public.workflows.addStatus, {
        churchId: church.id!,
        workflowId: workflow.id,
        status: { key: "ready", name: "Ready", taskState: "in_progress", sortOrder: 0 },
      });
      const missingTodo = yield* authenticated.mutation(refs.public.workflows.archiveStatus, {
        churchId: church.id!,
        statusId: todoStatus.id,
        archivedAt: "2026-06-01T10:00:00.000Z",
      });

      expect(canceledColumn).toMatchObject({
        ok: false,
        operation: "addWorkflowStatus",
        error: {
          code: "invalid_workflow",
          message: "Canceled is a Task State, not a visible Workflow Status.",
        },
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
      expect(missingTodo).toMatchObject({
        ok: false,
        operation: "archiveWorkflowStatus",
        error: { code: "invalid_workflow" },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("owners can rename and reorder Team-owned Workflows", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-workflow-edit-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Workflow Edit Church",
        slug: `workflow-edit-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      // Every Team owns its Workflow (ADR 0013): edits target the seeded
      // per-Team Workflows.
      const workflow = workflowForTeam(defaults, taskTeamId);
      const reorderedIds = [
        ...defaults.data.workflows
          .filter((candidate) => candidate.id !== workflow.id)
          .map((candidate) => candidate.id),
        workflow.id,
      ];

      const renamed = yield* authenticated.mutation(refs.public.workflows.renameForChurch, {
        churchId: church.id!,
        workflowId: workflow.id,
        name: "Worship Pipeline",
      });
      const reordered = yield* authenticated.mutation(refs.public.workflows.reorderForChurch, {
        churchId: church.id!,
        workflowIds: reorderedIds,
      });
      const activities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "workflow",
        entityId: workflow.id,
      });

      expect(
        renamed.data.workflows.find((candidate) => candidate.id === workflow.id),
      ).toMatchObject({
        name: "Worship Pipeline",
        teamId: taskTeamId,
      });
      expect(reordered.data.workflows.map((candidate) => candidate.id)).toEqual(reorderedIds);
      expect(
        reordered.data.workflows.find((candidate) => candidate.id === workflow.id),
      ).toMatchObject({ sortOrder: reorderedIds.length - 1 });
      expect(activities.data.activities.map((activity) => activity.eventType)).toEqual(
        expect.arrayContaining(["workflow.renamed", "workflow.reordered"]),
      );
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect(
    "Workflow archive is blocked while the owning Team is active or Tasks reference it",
    () =>
      Effect.gen(function* () {
        const c = yield* TestConfect.TestConfect;
        const email = `agent-workflow-in-use-${crypto.randomUUID()}@example.com`;
        const signUpResponse = yield* signUpWithEmail(c, email);
        const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
          user?: { id?: string };
          token?: string;
        };
        const churchResponse = yield* createChurch(c, {
          token: signUpBody.token!,
          name: "Workflow In Use Church",
          slug: `workflow-in-use-${crypto.randomUUID()}`,
        });
        const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
        const idleTeamResponse = yield* createTeam(c, {
          token: signUpBody.token!,
          name: "Idle Team",
          organizationId: church.id!,
        });
        const busyTeamResponse = yield* createTeam(c, {
          token: signUpBody.token!,
          name: "Busy Team",
          organizationId: church.id!,
        });
        const idleTeam = (yield* Effect.promise(() => idleTeamResponse.json())) as { id?: string };
        const busyTeam = (yield* Effect.promise(() => busyTeamResponse.json())) as { id?: string };
        const authenticated = yield* authenticatedConfect(c, {
          userId: signUpBody.user!.id!,
          sessionToken: signUpBody.token!,
        });
        const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
          churchId: church.id!,
        });
        const idleWorkflow = workflowForTeam(defaults, idleTeam.id!);
        const busyWorkflow = workflowForTeam(defaults, busyTeam.id!);
        const busyTodo = statusForTeam(defaults, busyTeam.id!, "todo");

        // Every Team owns its Workflow (ADR 0013): a Workflow stays in use
        // while its owning Team is active.
        const activeTeamArchive = yield* authenticated.mutation(
          refs.public.workflows.archiveForChurch,
          {
            churchId: church.id!,
            workflowId: idleWorkflow.id,
          },
        );

        yield* c.run(
          Effect.gen(function* () {
            const ctx = yield* MutationCtx.MutationCtx<DataModel>();
            yield* Effect.promise(() =>
              ctx.db.insert("tasks", {
                churchId: church.id!,
                title: "Workflow reference task",
                teamId: busyTeam.id!,
                // Test fixture bypassing createTasks; a fixed number is fine here.
                number: 9999,
                previousIdentifiers: [],
                assignedUserId: null,
                cycleId: "cycle-workflow-in-use",
                dueDate: "2026-06-03",
                parentTaskId: null,
                workflowId: busyWorkflow.id,
                workflowStatusId: busyTodo.id,
                taskState: "todo",
                boardOrder: "a0",
                finishedAt: null,
                sourceTemplateId: null,
                sourceTemplateTaskId: null,
                sourceTemplateCycleId: null,
                sourceTemplateSyncEnabled: false,
              }),
            );
          }),
        );
        yield* authenticated.mutation(refs.public.teams.archiveForChurch, {
          churchId: church.id!,
          teamId: idleTeam.id!,
        });
        yield* authenticated.mutation(refs.public.teams.archiveForChurch, {
          churchId: church.id!,
          teamId: busyTeam.id!,
        });

        const taskReferencedArchive = yield* authenticated.mutation(
          refs.public.workflows.archiveForChurch,
          {
            churchId: church.id!,
            workflowId: busyWorkflow.id,
          },
        );
        const archivedTeamArchive = yield* authenticated.mutation(
          refs.public.workflows.archiveForChurch,
          {
            churchId: church.id!,
            workflowId: idleWorkflow.id,
          },
        );

        expect(activeTeamArchive).toEqual({
          ok: false,
          operation: "archiveWorkflow",
          error: {
            code: "workflow_in_use",
            message: "Workflows owned by an active Team or referenced by Tasks cannot be archived.",
          },
        });
        // Tasks keep blocking the archive even after the owning Team is
        // archived.
        expect(taskReferencedArchive).toEqual(activeTeamArchive);
        // With the owning Team archived and no Tasks referencing it, the
        // Workflow can be archived.
        expect(
          archivedTeamArchive.data.workflows.find((candidate) => candidate.id === idleWorkflow.id),
        ).toMatchObject({ archivedAt: expect.any(String) });
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

      // Every Team owns its Workflow (ADR 0013): Workflows are seeded, so the
      // surviving status mutations are what write Workflow Activities.
      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const workflow = workflowForTeam(defaults, taskTeamId);
      const todoStatus = statusForTeam(defaults, taskTeamId, "todo");

      const added = yield* authenticated.mutation(refs.public.workflows.addStatus, {
        churchId: church.id!,
        workflowId: workflow.id,
        status: { key: "ready", name: "Ready", taskState: "in_progress", sortOrder: 3 },
      });
      const readyStatus = added.data.workflowStatuses.find(
        (status) => status.workflowId === workflow.id && status.key === "ready",
      )!;

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
      const statusActivities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "workflow",
        entityId: readyStatus.id,
      });

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

  it.effect("owners can add, rename, and reorder Workflow Statuses", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-workflow-status-edit-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Workflow Status Edit Church",
        slug: `workflow-status-edit-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      // Every Team owns its Workflow (ADR 0013): status edits operate on the
      // Team's seeded Workflow.
      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const workflow = workflowForTeam(defaults, taskTeamId);
      const todoStatus = statusForTeam(defaults, taskTeamId, "todo");
      const doingStatus = statusForTeam(defaults, taskTeamId, "in_progress");
      const doneStatus = statusForTeam(defaults, taskTeamId, "done");

      const added = yield* authenticated.mutation(refs.public.workflows.addStatus, {
        churchId: church.id!,
        workflowId: workflow.id,
        status: { key: "review", name: "Needs Review", taskState: "in_progress", sortOrder: 3 },
      });
      const reviewStatus = added.data.workflowStatuses.find(
        (status) => status.workflowId === workflow.id && status.key === "review",
      )!;
      const renamed = yield* authenticated.mutation(refs.public.workflows.renameStatus, {
        churchId: church.id!,
        statusId: reviewStatus.id,
        name: "Review",
      });
      const reordered = yield* authenticated.mutation(refs.public.workflows.reorderStatuses, {
        churchId: church.id!,
        workflowId: workflow.id,
        statusIds: [reviewStatus.id, doingStatus.id, todoStatus.id, doneStatus.id],
      });
      const statusActivities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "workflow",
        entityId: reviewStatus.id,
      });

      expect(added.data.workflowStatuses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "review",
            name: "Needs Review",
            taskState: "in_progress",
          }),
        ]),
      );
      expect(renamed.data.workflowStatuses).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: reviewStatus.id, name: "Review" })]),
      );
      expect(
        reordered.data.workflowStatuses
          .filter((status) => status.workflowId === workflow.id && status.archivedAt === null)
          .map((status) => [status.id, status.sortOrder]),
      ).toEqual([
        [reviewStatus.id, 0],
        [doingStatus.id, 1],
        [todoStatus.id, 2],
        [doneStatus.id, 3],
      ]);
      expect(statusActivities.data.activities.map((activity) => activity.eventType)).toEqual(
        expect.arrayContaining([
          "workflow.status.created",
          "workflow.status.renamed",
          "workflow.status.reordered",
        ]),
      );
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
      const taskTeamId = yield* firstTeamId(authenticated, church.id!);

      yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();
          yield* Effect.promise(() =>
            ctx.db.insert("tasks", {
              churchId: church.id!,
              title: "Task using To Do",
              teamId: taskTeamId,
              // Test fixture bypassing createTasks; a fixed number is fine here.
              number: 9999,
              previousIdentifiers: [],
              assignedUserId: null,
              cycleId: "cycle-status-in-use",
              dueDate: "2026-06-03",
              parentTaskId: null,
              workflowId: workflow.id,
              workflowStatusId: todoStatus.id,
              taskState: "todo",
              boardOrder: "a0",
              finishedAt: null,
              sourceTemplateId: null,
              sourceTemplateTaskId: null,
              sourceTemplateCycleId: null,
              sourceTemplateSyncEnabled: false,
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

  it.effect("Workflow Status archive ignores canceled Task history", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-status-canceled-history-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Status Canceled History Church",
        slug: `status-canceled-history-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      // Every Team owns its Workflow (ADR 0013): extend the Team's seeded
      // Workflow with a Ready status the canceled Task will reference.
      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const workflow = workflowForTeam(defaults, taskTeamId);
      const added = yield* authenticated.mutation(refs.public.workflows.addStatus, {
        churchId: church.id!,
        workflowId: workflow.id,
        status: { key: "ready", name: "Ready", taskState: "in_progress", sortOrder: 3 },
      });
      const readyStatus = added.data.workflowStatuses.find(
        (status) => status.workflowId === workflow.id && status.key === "ready",
      )!;

      yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();
          yield* Effect.promise(() =>
            ctx.db.insert("tasks", {
              churchId: church.id!,
              title: "Canceled task using Ready",
              teamId: taskTeamId,
              // Test fixture bypassing createTasks; a fixed number is fine here.
              number: 9999,
              previousIdentifiers: [],
              assignedUserId: null,
              cycleId: "cycle-status-canceled-history",
              dueDate: "2026-06-03",
              parentTaskId: null,
              workflowId: workflow.id,
              workflowStatusId: readyStatus.id,
              taskState: "canceled",
              boardOrder: "a0",
              finishedAt: "2026-06-03T12:00:00.000Z",
              sourceTemplateId: null,
              sourceTemplateTaskId: null,
              sourceTemplateCycleId: null,
              sourceTemplateSyncEnabled: false,
            }),
          );
        }),
      );

      const archived = yield* authenticated.mutation(refs.public.workflows.archiveStatus, {
        churchId: church.id!,
        statusId: readyStatus.id,
        archivedAt: "2026-06-01T10:00:00.000Z",
      });

      expect(
        archived.data.workflowStatuses.find((status) => status.id === readyStatus.id),
      ).toMatchObject({
        archivedAt: "2026-06-01T10:00:00.000Z",
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
      // Every Team owns its Workflow (ADR 0013): the source is a starter
      // Team's seeded Workflow, the destination is the new Team's. Add a
      // "Doing" status to both so the name+state match can beat the
      // lower-sortOrder state fallback, and a "Review" status only to the
      // source to exercise the fallback.
      const sourceTeamId = yield* firstTeamId(authenticated, church.id!);
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const sourceWorkflow = workflowForTeam(defaults, sourceTeamId);
      const destinationWorkflow = workflowForTeam(defaults, team.id!);
      const destinationInProgress = statusForTeam(defaults, team.id!, "in_progress");
      const sourceAdded = yield* authenticated.mutation(refs.public.workflows.addStatus, {
        churchId: church.id!,
        workflowId: sourceWorkflow.id,
        status: { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 3 },
      });
      const sourceReviewAdded = yield* authenticated.mutation(refs.public.workflows.addStatus, {
        churchId: church.id!,
        workflowId: sourceWorkflow.id,
        status: { key: "review", name: "Review", taskState: "in_progress", sortOrder: 4 },
      });
      const destinationAdded = yield* authenticated.mutation(refs.public.workflows.addStatus, {
        churchId: church.id!,
        workflowId: destinationWorkflow.id,
        status: { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 3 },
      });
      const sourceDoing = sourceAdded.data.workflowStatuses.find(
        (status) => status.workflowId === sourceWorkflow.id && status.key === "doing",
      )!;
      const sourceReview = sourceReviewAdded.data.workflowStatuses.find(
        (status) => status.workflowId === sourceWorkflow.id && status.key === "review",
      )!;
      const destinationDoing = destinationAdded.data.workflowStatuses.find(
        (status) => status.workflowId === destinationWorkflow.id && status.key === "doing",
      )!;
      const taskId = yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();

          return yield* Effect.promise(() =>
            ctx.db.insert("tasks", {
              churchId: church.id!,
              title: "Remapped Task",
              teamId: sourceTeamId,
              // Test fixture bypassing createTasks; a fixed number is fine here.
              number: 9999,
              previousIdentifiers: [],
              assignedUserId: null,
              cycleId: "cycle-remap",
              dueDate: "2026-06-03",
              parentTaskId: null,
              workflowId: sourceWorkflow.id,
              workflowStatusId: sourceDoing.id,
              taskState: "in_progress",
              boardOrder: "a0",
              finishedAt: null,
              sourceTemplateId: null,
              sourceTemplateTaskId: null,
              sourceTemplateCycleId: null,
              sourceTemplateSyncEnabled: false,
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
              teamId: sourceTeamId,
              // Test fixture bypassing createTasks; a fixed number is fine here.
              number: 9999,
              previousIdentifiers: [],
              assignedUserId: null,
              cycleId: "cycle-remap",
              dueDate: "2026-06-03",
              parentTaskId: null,
              workflowId: sourceWorkflow.id,
              workflowStatusId: sourceReview.id,
              taskState: "in_progress",
              boardOrder: "a0",
              finishedAt: null,
              sourceTemplateId: null,
              sourceTemplateTaskId: null,
              sourceTemplateCycleId: null,
              sourceTemplateSyncEnabled: false,
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

      // No "Review" in the destination Workflow: fall back to the lowest
      // sortOrder status with the same Task State.
      expect(fallbackTask).toMatchObject({
        workflowId: destinationWorkflow.id,
        workflowStatusId: destinationInProgress.id,
        taskState: "in_progress",
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Task Team changes use the destination Team's own Workflow", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-task-team-own-workflow-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Task Remap Own Workflow Church",
        slug: `task-remap-own-workflow-${crypto.randomUUID()}`,
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
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      // Every Team owns its Workflow (ADR 0013): the remap targets the
      // destination Team's own Workflow — the Church default fallback chain
      // is gone.
      const sourceTeamId = yield* firstTeamId(authenticated, church.id!);
      const sourceWorkflow = workflowForTeam(defaults, sourceTeamId);
      const sourceDoing = statusForTeam(defaults, sourceTeamId, "in_progress");
      const destinationWorkflow = workflowForTeam(defaults, team.id!);
      const destinationDoing = statusForTeam(defaults, team.id!, "in_progress");
      const taskId = yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();

          return yield* Effect.promise(() =>
            ctx.db.insert("tasks", {
              churchId: church.id!,
              title: "Own Workflow Remapped Task",
              teamId: sourceTeamId,
              // Test fixture bypassing createTasks; a fixed number is fine here.
              number: 9999,
              previousIdentifiers: [],
              assignedUserId: null,
              cycleId: "cycle-remap-own-workflow",
              dueDate: "2026-06-03",
              parentTaskId: null,
              workflowId: sourceWorkflow.id,
              workflowStatusId: sourceDoing.id,
              taskState: "in_progress",
              boardOrder: "a0",
              finishedAt: null,
              sourceTemplateId: null,
              sourceTemplateTaskId: null,
              sourceTemplateCycleId: null,
              sourceTemplateSyncEnabled: false,
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

  it.effect("Activity registry rejects invalid actor invariants before insert", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-invalid-activity-actor-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Invalid Activity Actor Church",
        slug: `invalid-activity-actor-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const userActorTaskId = `task-${crypto.randomUUID()}`;
      const systemActorTaskId = `task-${crypto.randomUUID()}`;
      const betterAuthActorTaskId = `task-${crypto.randomUUID()}`;

      const missingUserActor = yield* authenticated.mutation(
        refs.public.activities.recordForChurch,
        {
          churchId: church.id!,
          entityType: "task",
          entityId: userActorTaskId,
          eventType: "task.created",
          actorType: "user",
          actorId: null,
          occurredAt: "2026-05-31T12:00:00.000Z",
          cycleId: null,
          metadata: { parentTaskId: null },
        },
      );
      const systemWithActor = yield* authenticated.mutation(
        refs.public.activities.recordForChurch,
        {
          churchId: church.id!,
          entityType: "task",
          entityId: systemActorTaskId,
          eventType: "task.created",
          actorType: "system",
          actorId: signUpBody.user!.id!,
          occurredAt: "2026-05-31T12:00:00.000Z",
          cycleId: null,
          metadata: { parentTaskId: null },
        },
      );
      const betterAuthMissingActor = yield* authenticated.mutation(
        refs.public.activities.recordForChurch,
        {
          churchId: church.id!,
          entityType: "task",
          entityId: betterAuthActorTaskId,
          eventType: "task.created",
          actorType: "better_auth",
          actorId: null,
          occurredAt: "2026-05-31T12:00:00.000Z",
          cycleId: null,
          metadata: { parentTaskId: null },
        },
      );
      const missingUserActorActivities = yield* authenticated.query(
        refs.public.activities.listForEntity,
        {
          churchId: church.id!,
          entityType: "task",
          entityId: userActorTaskId,
        },
      );
      const systemActorActivities = yield* authenticated.query(
        refs.public.activities.listForEntity,
        {
          churchId: church.id!,
          entityType: "task",
          entityId: systemActorTaskId,
        },
      );
      const betterAuthActorActivities = yield* authenticated.query(
        refs.public.activities.listForEntity,
        {
          churchId: church.id!,
          entityType: "task",
          entityId: betterAuthActorTaskId,
        },
      );

      expect(missingUserActor).toEqual({
        ok: false,
        operation: "recordActivity",
        error: {
          code: "invalid_activity_metadata",
          message: "Activity metadata does not match the registered event schema.",
        },
      });
      expect(systemWithActor).toEqual({
        ok: false,
        operation: "recordActivity",
        error: {
          code: "invalid_activity_metadata",
          message: "Activity metadata does not match the registered event schema.",
        },
      });
      expect(betterAuthMissingActor).toEqual({
        ok: false,
        operation: "recordActivity",
        error: {
          code: "invalid_activity_metadata",
          message: "Activity metadata does not match the registered event schema.",
        },
      });
      expect(missingUserActorActivities.data.activities).toEqual([]);
      expect(systemActorActivities.data.activities).toEqual([]);
      expect(betterAuthActorActivities.data.activities).toEqual([]);
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
        metadata: { parentTaskId: null },
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
        metadata: { parentTaskId: null },
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

  it.effect("coreWork batch contracts exercise reads, writes, and safe per-operation errors", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-core-work-batch-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Core Work Batch Church",
        slug: `core-work-batch-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      const unauthenticatedRead = yield* c.query(refs.public.coreWork.batchRead, {
        operations: [
          {
            id: "unauthenticated-tasks",
            operation: "listTasks",
            input: { churchId: church.id! },
          },
        ],
      });
      const defaultsRead = yield* authenticated.query(refs.public.coreWork.batchRead, {
        operations: [
          {
            id: "defaults",
            operation: "readWorkDefaults",
            input: { churchId: church.id! },
          },
          {
            id: "key-dates",
            operation: "listKeyDates",
            input: { churchId: church.id! },
          },
          {
            id: "team-memberships",
            operation: "listTeamMemberships",
            input: { churchId: church.id! },
          },
          {
            id: "church-settings",
            operation: "readChurchSettings",
            input: { churchId: church.id! },
          },
        ],
      });
      const defaults = defaultsRead.results.find((result) => result.id === "defaults")!.result;
      const todoStatus =
        defaults.ok && defaults.operation === "readWorkDefaults"
          ? defaults.data.workflowStatuses.find((status) => status.taskState === "todo")!
          : null;

      const taskTeamId = yield* firstTeamId(authenticated, church.id!);
      const write = yield* authenticated.mutation(refs.public.coreWork.batchWrite, {
        operations: [
          {
            id: "create-task",
            operation: "createTasks",
            input: {
              churchId: church.id!,
              tasks: [
                {
                  title: "Batch-created task",
                  teamId: taskTeamId,
                  workflowStatusId: todoStatus!.id,
                  dueDate: "2026-06-01",
                  parentTaskId: null,
                },
              ],
            },
          },
          {
            id: "create-team",
            operation: "createTeam",
            input: { churchId: church.id!, name: "Care" },
          },
          {
            id: "update-time-zone",
            operation: "updateChurchTimeZone",
            input: { churchId: church.id!, churchTimeZone: "America/Chicago" },
          },
        ],
      });
      const tasksRead = yield* authenticated.query(refs.public.coreWork.batchRead, {
        operations: [
          {
            id: "tasks",
            operation: "listTasks",
            input: { churchId: church.id! },
          },
        ],
      });

      expect(unauthenticatedRead.results[0]!.result).toMatchObject({
        ok: false,
        operation: "listTasks",
        error: { code: "not_authenticated" },
      });
      expect(defaultsRead).toMatchObject({ ok: true, operation: "coreWorkBatchRead" });
      expect(defaultsRead.results.map((result) => result.id)).toEqual([
        "defaults",
        "key-dates",
        "team-memberships",
        "church-settings",
      ]);
      expect(
        defaultsRead.results.find((result) => result.id === "team-memberships")!.result,
      ).toMatchObject({ ok: true, operation: "listTeamMemberships" });
      expect(
        defaultsRead.results.find((result) => result.id === "church-settings")!.result,
      ).toMatchObject({
        ok: true,
        operation: "readChurchSettings",
        data: { church: { id: church.id!, churchTimeZone: "America/New_York" } },
      });
      expect(write.results[0]!.result).toMatchObject({ ok: true, operation: "createTasks" });
      const createTeamResult = write.results.find((result) => result.id === "create-team")!.result;
      expect(createTeamResult).toMatchObject({ ok: true, operation: "createTeam" });
      expect(
        createTeamResult.ok && createTeamResult.operation === "createTeam"
          ? createTeamResult.data.teams.map((team) => team.name)
          : [],
      ).toContain("Care");
      expect(
        write.results.find((result) => result.id === "update-time-zone")!.result,
      ).toMatchObject({
        ok: true,
        operation: "updateChurchTimeZone",
        data: { church: { id: church.id!, churchTimeZone: "America/Chicago" } },
      });
      expect(tasksRead.results[0]!.result).toMatchObject({
        ok: true,
        operation: "listTasks",
        data: { tasks: [{ title: "Batch-created task" }] },
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

describe("Task numbering and Task Identifiers", () => {
  it.effect("creation draws dense per-Team numbers and computes Task Identifiers", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const ownerResponse = yield* signUpWithEmail(
        c,
        `task-numbering-owner-${crypto.randomUUID()}@example.com`,
      );
      const owner = (yield* Effect.promise(() => ownerResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: owner.token!,
        name: "Task Numbering Church",
        slug: `task-numbering-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: owner.user!.id!,
        sessionToken: owner.token!,
      });
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const teams = yield* authenticated.query(refs.public.teams.listForChurch, {
        churchId: church.id!,
      });
      const teamA = teams.data.teams[0]!;
      const teamB = teams.data.teams[1]!;
      // Every Team owns its Workflow (ADR 0013): each Team's Tasks use its
      // own Workflow's To Do status.
      const todoStatusA = statusForTeam(defaults, teamA.id, "todo");
      const todoStatusB = statusForTeam(defaults, teamB.id, "todo");

      const firstBatch = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Numbered A1",
            teamId: teamA.id,
            workflowStatusId: todoStatusA.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
          {
            title: "Numbered A2",
            teamId: teamA.id,
            workflowStatusId: todoStatusA.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
        ],
      });
      const secondBatch = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Numbered A3",
            teamId: teamA.id,
            workflowStatusId: todoStatusA.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
          {
            title: "Numbered B1",
            teamId: teamB.id,
            workflowStatusId: todoStatusB.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
        ],
      });

      const byTitle = (title: string) =>
        [...firstBatch.data.tasks, ...secondBatch.data.tasks].find((task) => task.title === title)!;

      // Numbers are dense within each Team (ADR 0013): Team A draws 1, 2, 3
      // across batches while Team B independently draws 1.
      expect(byTitle("Numbered A1")).toMatchObject({
        number: 1,
        identifier: `${teamA.identifier}-1`,
      });
      expect(byTitle("Numbered A2")).toMatchObject({
        number: 2,
        identifier: `${teamA.identifier}-2`,
      });
      expect(byTitle("Numbered A3")).toMatchObject({
        number: 3,
        identifier: `${teamA.identifier}-3`,
      });
      expect(byTitle("Numbered B1")).toMatchObject({
        number: 1,
        identifier: `${teamB.identifier}-1`,
      });

      // Read-side payloads carry the computed identifier too.
      const listed = yield* authenticated.query(refs.public.tasks.listForChurch, {
        churchId: church.id!,
      });
      const listedA1 = listed.data.tasks.find((task) => task.title === "Numbered A1")!;
      expect(listedA1.identifier).toBe(`${teamA.identifier}-1`);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("concurrent creation draws unique, dense numbers within a Team", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const ownerResponse = yield* signUpWithEmail(
        c,
        `task-numbering-concurrent-${crypto.randomUUID()}@example.com`,
      );
      const owner = (yield* Effect.promise(() => ownerResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: owner.token!,
        name: "Task Numbering Concurrent Church",
        slug: `task-numbering-concurrent-${crypto.randomUUID()}`,
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
      const teamId = yield* firstTeamId(authenticated, church.id!);

      const createOne = (title: string) =>
        authenticated.mutation(refs.public.tasks.createBatch, {
          churchId: church.id!,
          tasks: [
            {
              title,
              teamId,
              workflowStatusId: todoStatus.id,
              dueDate: "2026-06-03",
              parentTaskId: null,
            },
          ],
        });

      yield* Effect.all(
        [createOne("Concurrent 1"), createOne("Concurrent 2"), createOne("Concurrent 3")],
        { concurrency: "unbounded" },
      );

      const listed = yield* authenticated.query(refs.public.tasks.listForChurch, {
        churchId: church.id!,
      });
      const numbers = listed.data.tasks
        .filter((task) => task.teamId === teamId)
        .map((task) => task.number)
        .sort((left, right) => left - right);

      // Concurrent draws never duplicate or skip: the per-Team sequence stays
      // dense (Convex serializable transactions).
      expect(numbers).toEqual([1, 2, 3]);
    }).pipe(Effect.provide(TestConfect.layer())),
  );
});

describe("Task Identifier resolution", () => {
  // Identifier resolution (ADR 0013): church + identifier string in, Task
  // out — case-insensitive, current-first, alias fallback.
  const setupResolutionChurch = function* (label: string) {
    const c = yield* TestConfect.TestConfect;
    const ownerResponse = yield* signUpWithEmail(c, `${label}-${crypto.randomUUID()}@example.com`);
    const owner = (yield* Effect.promise(() => ownerResponse.json())) as {
      user?: { id?: string };
      token?: string;
    };
    const churchResponse = yield* createChurch(c, {
      token: owner.token!,
      name: `${label} Church`,
      slug: `${label}-${crypto.randomUUID()}`,
    });
    const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
    const authenticated = yield* authenticatedConfect(c, {
      userId: owner.user!.id!,
      sessionToken: owner.token!,
    });
    const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
      churchId: church.id!,
    });
    const teams = yield* authenticated.query(refs.public.teams.listForChurch, {
      churchId: church.id!,
    });

    const createTask = (title: string, teamId: string) =>
      Effect.gen(function* () {
        // Every Team owns its Workflow (ADR 0013): each Task draws the To Do
        // status from its own Team's Workflow.
        const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
          churchId: church.id!,
          tasks: [
            {
              title,
              teamId,
              workflowStatusId: statusForTeam(defaults, teamId, "todo").id,
              dueDate: "2026-06-03",
              parentTaskId: null,
            },
          ],
        });
        // createBatch returns the whole Task model, not only created Tasks.
        return created.data.tasks.find((candidate) => candidate.title === title)!;
      });

    return {
      c,
      owner,
      authenticated,
      churchId: church.id!,
      teams: teams.data.teams,
      createTask,
    };
  };

  it.effect("resolves a current Task Identifier case-insensitively", () =>
    Effect.gen(function* () {
      const setup = yield* setupResolutionChurch("resolve-current");
      const team = setup.teams[0]!;
      const task = yield* setup.createTask("Resolvable Task", team.id);

      const exact = yield* setup.authenticated.query(refs.public.tasks.resolveByIdentifier, {
        churchId: setup.churchId,
        identifier: task.identifier,
      });
      expect(exact.data.tasks[0]).toMatchObject({ id: task.id, identifier: task.identifier });

      // Case-insensitive matching, uppercase canonical form (ADR 0013):
      // "prd-48" resolves and the payload carries the canonical identifier.
      const lowercase = yield* setup.authenticated.query(refs.public.tasks.resolveByIdentifier, {
        churchId: setup.churchId,
        identifier: task.identifier.toLowerCase(),
      });
      expect(lowercase.data.tasks[0]).toMatchObject({ id: task.id, identifier: task.identifier });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("falls back to a Team's previous identifier after an identifier change", () =>
    Effect.gen(function* () {
      const setup = yield* setupResolutionChurch("resolve-team-alias");
      const team = setup.teams[0]!;
      const task = yield* setup.createTask("Aliased Team Task", team.id);
      const retiredIdentifier = team.identifier;

      yield* setup.authenticated.mutation(refs.public.teams.setIdentifierForChurch, {
        churchId: setup.churchId,
        teamId: team.id,
        identifier: "ZZZZZ",
      });

      // The old link keeps resolving; the payload carries the new canonical
      // identifier so the URL can normalize.
      const resolved = yield* setup.authenticated.query(refs.public.tasks.resolveByIdentifier, {
        churchId: setup.churchId,
        identifier: `${retiredIdentifier}-${task.number}`,
      });
      expect(resolved.data.tasks[0]).toMatchObject({
        id: task.id,
        identifier: `ZZZZZ-${task.number}`,
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("a current identifier beats a retired alias on collision", () =>
    Effect.gen(function* () {
      const setup = yield* setupResolutionChurch("resolve-collision");
      const teamA = setup.teams[0]!;
      const teamB = setup.teams[1]!;

      yield* setup.authenticated.mutation(refs.public.teams.setIdentifierForChurch, {
        churchId: setup.churchId,
        teamId: teamA.id,
        identifier: "COL",
      });
      const taskA = yield* setup.createTask("Original COL Task", teamA.id);

      // Team A retires "COL"; Team B claims it (retired identifiers are not
      // reserved, ADR 0013).
      yield* setup.authenticated.mutation(refs.public.teams.setIdentifierForChurch, {
        churchId: setup.churchId,
        teamId: teamA.id,
        identifier: "MOV",
      });
      yield* setup.authenticated.mutation(refs.public.teams.setIdentifierForChurch, {
        churchId: setup.churchId,
        teamId: teamB.id,
        identifier: "COL",
      });
      const taskB = yield* setup.createTask("New COL Task", teamB.id);
      expect(taskA.number).toBe(taskB.number);

      // Current always wins: "COL-1" now belongs to Team B's task.
      const collided = yield* setup.authenticated.query(refs.public.tasks.resolveByIdentifier, {
        churchId: setup.churchId,
        identifier: `COL-${taskB.number}`,
      });
      expect(collided.data.tasks[0]).toMatchObject({ id: taskB.id });

      // Team A's task is still reachable through its current identifier.
      const moved = yield* setup.authenticated.query(refs.public.tasks.resolveByIdentifier, {
        churchId: setup.churchId,
        identifier: `MOV-${taskA.number}`,
      });
      expect(moved.data.tasks[0]).toMatchObject({ id: taskA.id });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("falls back to a Task's previous identifiers", () =>
    Effect.gen(function* () {
      const setup = yield* setupResolutionChurch("resolve-task-alias");
      const team = setup.teams[0]!;
      const task = yield* setup.createTask("Renumbered Task", team.id);

      // Simulate the renumber-and-remember bookkeeping a team move performs:
      // the old Task Identifier is appended to the task's
      // previous-identifiers list (ADR 0013).
      yield* setup.c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();

          yield* Effect.promise(() =>
            ctx.db.patch(task.id as Id<"tasks">, { previousIdentifiers: ["OLDTM-7"] }),
          );
          return null;
        }),
        Schema.Null,
      );

      const resolved = yield* setup.authenticated.query(refs.public.tasks.resolveByIdentifier, {
        churchId: setup.churchId,
        identifier: "oldtm-7",
      });
      expect(resolved.data.tasks[0]).toMatchObject({ id: task.id, identifier: task.identifier });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("scopes resolution to the Church", () =>
    Effect.gen(function* () {
      const setup = yield* setupResolutionChurch("resolve-scoping");
      const team = setup.teams[0]!;
      const task = yield* setup.createTask("Scoped Task", team.id);

      const otherChurchResponse = yield* createChurch(setup.c, {
        token: setup.owner.token!,
        name: "Resolve Scoping Other Church",
        slug: `resolve-scoping-other-${crypto.randomUUID()}`,
      });
      const otherChurch = (yield* Effect.promise(() => otherChurchResponse.json())) as {
        id?: string;
      };

      const crossChurch = yield* setup.authenticated.query(refs.public.tasks.resolveByIdentifier, {
        churchId: otherChurch.id!,
        identifier: task.identifier,
      });
      expect(crossChurch).toMatchObject({
        ok: false,
        operation: "resolveTask",
        error: { code: "task_not_found" },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("unknown and malformed identifiers return task_not_found", () =>
    Effect.gen(function* () {
      const setup = yield* setupResolutionChurch("resolve-unknown");
      const team = setup.teams[0]!;
      yield* setup.createTask("Only Task", team.id);

      const unknownNumber = yield* setup.authenticated.query(
        refs.public.tasks.resolveByIdentifier,
        { churchId: setup.churchId, identifier: `${team.identifier}-999` },
      );
      expect(unknownNumber).toMatchObject({
        ok: false,
        operation: "resolveTask",
        error: { code: "task_not_found" },
      });

      const malformed = yield* setup.authenticated.query(refs.public.tasks.resolveByIdentifier, {
        churchId: setup.churchId,
        identifier: "not an identifier",
      });
      expect(malformed).toMatchObject({
        ok: false,
        operation: "resolveTask",
        error: { code: "task_not_found" },
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );
});
