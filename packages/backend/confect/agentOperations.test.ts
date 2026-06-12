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

      yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Preserve existing cycle boundary",
            teamId: null,
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

  it.effect(
    "Church creation seeds editable starter Teams that use the default Workflow fallback",
    () =>
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
        expect(teams.data.teams.every((team) => team.defaultWorkflowId === null)).toBe(true);
        expect(defaults.data.workflows).toMatchObject([
          { key: "church-default", name: "Default Workflow", isDefault: true },
        ]);

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

      expect(result.data.workflows).toHaveLength(1);
      expect(result.data.workflowStatuses).toHaveLength(3);
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

      const created = yield* authenticated.mutation(refs.public.templates.createForChurch, {
        churchId: church.id!,
        templates: [
          {
            key: "easter-prep",
            name: "Easter Prep",
            recurrence: "yearly",
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
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-03-28" },
              },
              {
                key: "window-start",
                title: "Focus window work",
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

      const created = yield* authenticated.mutation(refs.public.templates.createForChurch, {
        churchId: church.id!,
        templates: ["none", "weekly", "monthly", "quarterly", "yearly"].map((recurrence) => ({
          key: `template-${recurrence}`,
          name: `Template ${recurrence}`,
          recurrence,
          focusWindows: [],
          templateTasks: [
            {
              key: "task",
              title: `Task ${recurrence}`,
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
      const cycleSeed = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Seed cycle",
            teamId: null,
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
            focusWindows: [],
            templateTasks: [
              {
                key: "parent",
                title: "Prepare worship plan",
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-03" },
              },
              {
                key: "child",
                title: "Confirm musicians",
                parentTemplateTaskKey: "parent",
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-03" },
              },
              {
                key: "skip-me",
                title: "Print handouts",
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

        const created = yield* authenticated.mutation(refs.public.templates.createForChurch, {
          churchId: church.id!,
          templates: [
            {
              key: "weekly-service",
              name: "Weekly Service",
              recurrence: "weekly",
              focusWindows: [],
              templateTasks: [
                {
                  key: "parent",
                  title: "Prepare service plan",
                  parentTemplateTaskKey: null,
                  schedulingRule: { kind: "fixedDate", localDate: "2026-06-03" },
                },
                {
                  key: "child-next-week",
                  title: "Prepare follow-up email",
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

      const cycleSeed = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Seed future adjustment cycle",
            teamId: null,
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
            focusWindows: [],
            templateTasks: [
              {
                key: "past",
                title: "Past projected work",
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-03" },
              },
              {
                key: "current",
                title: "Current projected work",
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-10" },
              },
              {
                key: "future",
                title: "Future projected work",
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-17" },
              },
              {
                key: "adjusted",
                title: "Adjusted projected work",
                parentTemplateTaskKey: null,
                schedulingRule: { kind: "fixedDate", localDate: "2026-06-17" },
              },
              {
                key: "rolled",
                title: "Rolled projected work",
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

      const seededTasks = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Carry sermon outline",
            teamId: null,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
          {
            title: "Completed slides",
            teamId: null,
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
            focusWindows: [],
            templateTasks: [
              {
                key: "prepare-next-week",
                title: "Prepare next week service plan",
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

      const createdParent = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Prepare Sunday slides",
            teamId: null,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
          {
            title: "Plan next month volunteers",
            teamId: null,
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
            teamId: null,
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

      const assigned = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Call assigned volunteer",
            teamId: null,
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
            teamId: null,
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

  it.effect("Task creation validates Team defaults and effective Workflow Statuses", () =>
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
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const defaultWorkflow = defaults.data.workflows.find((workflow) => workflow.isDefault)!;
      const defaultTodo = defaults.data.workflowStatuses.find(
        (status) => status.workflowId === defaultWorkflow.id && status.taskState === "todo",
      )!;
      const teamWorkflowResult = yield* authenticated.mutation(
        refs.public.workflows.createForChurch,
        {
          churchId: church.id!,
          key: "hospitality-flow",
          name: "Hospitality Flow",
          isDefault: false,
          sortOrder: 1,
          statuses: [
            { key: "todo", name: "Ready", taskState: "todo", sortOrder: 0 },
            { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 1 },
            { key: "done", name: "Done", taskState: "done", sortOrder: 2 },
          ],
        },
      );
      const teamWorkflow = teamWorkflowResult.data.workflows.find(
        (workflow) => workflow.key === "hospitality-flow",
      )!;
      const teamTodo = teamWorkflowResult.data.workflowStatuses.find(
        (status) => status.workflowId === teamWorkflow.id && status.taskState === "todo",
      )!;
      yield* authenticated.mutation(refs.public.teams.updateProductFields, {
        churchId: church.id!,
        updates: [
          { teamId: team.id!, fields: { defaultWorkflowId: teamWorkflow.id } },
          { teamId: archivedTeam.id!, fields: { archivedAt: "2026-06-01T00:00:00.000Z" } },
        ],
      });

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
            workflowStatusId: defaultTodo.id,
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
            workflowStatusId: defaultTodo.id,
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
      const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Assign through update",
            teamId: null,
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
        name: "Facilities",
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
      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const defaultWorkflow = defaults.data.workflows.find((workflow) => workflow.isDefault)!;
      const defaultTodo = defaults.data.workflowStatuses.find(
        (status) => status.workflowId === defaultWorkflow.id && status.taskState === "todo",
      )!;
      const teamWorkflowResult = yield* authenticated.mutation(
        refs.public.workflows.createForChurch,
        {
          churchId: church.id!,
          key: "care-flow",
          name: "Care Flow",
          isDefault: false,
          sortOrder: 1,
          statuses: [
            { key: "todo", name: "To Do", taskState: "todo", sortOrder: 0 },
            { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 1 },
            { key: "done", name: "Done", taskState: "done", sortOrder: 2 },
          ],
        },
      );
      const teamWorkflow = teamWorkflowResult.data.workflows.find(
        (workflow) => workflow.key === "care-flow",
      )!;
      const teamTodo = teamWorkflowResult.data.workflowStatuses.find(
        (status) => status.workflowId === teamWorkflow.id && status.taskState === "todo",
      )!;
      const secondTeamWorkflowResult = yield* authenticated.mutation(
        refs.public.workflows.createForChurch,
        {
          churchId: church.id!,
          key: "facilities-flow",
          name: "Facilities Flow",
          isDefault: false,
          sortOrder: 2,
          statuses: [
            { key: "todo", name: "To Do", taskState: "todo", sortOrder: 0 },
            { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 1 },
            { key: "done", name: "Done", taskState: "done", sortOrder: 2 },
          ],
        },
      );
      const secondTeamWorkflow = secondTeamWorkflowResult.data.workflows.find(
        (workflow) => workflow.key === "facilities-flow",
      )!;
      const secondTeamTodo = secondTeamWorkflowResult.data.workflowStatuses.find(
        (status) => status.workflowId === secondTeamWorkflow.id && status.taskState === "todo",
      )!;
      const invalidWorkflowResult = yield* authenticated.mutation(
        refs.public.workflows.createForChurch,
        {
          churchId: church.id!,
          key: "invalid-remap-flow",
          name: "Invalid Remap Flow",
          isDefault: false,
          sortOrder: 3,
          statuses: [
            { key: "todo", name: "To Do", taskState: "todo", sortOrder: 0 },
            { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 1 },
            { key: "done", name: "Done", taskState: "done", sortOrder: 2 },
          ],
        },
      );
      const invalidWorkflow = invalidWorkflowResult.data.workflows.find(
        (workflow) => workflow.key === "invalid-remap-flow",
      )!;
      const invalidTodo = invalidWorkflowResult.data.workflowStatuses.find(
        (status) => status.workflowId === invalidWorkflow.id && status.taskState === "todo",
      )!;
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
      yield* authenticated.mutation(refs.public.teams.updateProductFields, {
        churchId: church.id!,
        updates: [
          { teamId: team.id!, fields: { defaultWorkflowId: teamWorkflow.id } },
          { teamId: secondTeam.id!, fields: { defaultWorkflowId: secondTeamWorkflow.id } },
          { teamId: invalidTeam.id!, fields: { defaultWorkflowId: invalidWorkflow.id } },
        ],
      });
      const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Assign Team through update",
            teamId: null,
            workflowStatusId: defaultTodo.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
        ],
      });
      const task = created.data.tasks.find(
        (candidate) => candidate.title === "Assign Team through update",
      )!;

      const assigned = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: task.id, fields: { teamId: team.id! } }],
      });
      const changed = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: task.id, fields: { teamId: secondTeam.id! } }],
      });
      const unassigned = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
        churchId: church.id!,
        updates: [{ taskId: task.id, fields: { teamId: null } }],
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

      expect(assigned.data.tasks.find((candidate) => candidate.id === task.id)).toMatchObject({
        teamId: team.id,
        workflowId: teamWorkflow.id,
        workflowStatusId: teamTodo.id,
        taskState: "todo",
      });
      expect(changed.data.tasks.find((candidate) => candidate.id === task.id)).toMatchObject({
        teamId: secondTeam.id,
        workflowId: secondTeamWorkflow.id,
        workflowStatusId: secondTeamTodo.id,
        taskState: "todo",
      });
      expect(unassigned.data.tasks.find((candidate) => candidate.id === task.id)).toMatchObject({
        teamId: null,
        workflowId: defaultWorkflow.id,
        workflowStatusId: defaultTodo.id,
        taskState: "todo",
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
        "task.team_assigned",
        "task.team_changed",
        "task.team_unassigned",
      ]);
      expect(activities.data.activities.map((activity) => activity.actorId)).toEqual([
        owner.user!.id!,
        owner.user!.id!,
        owner.user!.id!,
        owner.user!.id!,
      ]);
      expect(activities.data.activities[1]!.metadata).toEqual({
        previousTeamId: null,
        teamId: team.id,
        previousWorkflowId: defaultWorkflow.id,
        workflowId: teamWorkflow.id,
        previousWorkflowStatusId: defaultTodo.id,
        workflowStatusId: teamTodo.id,
      });
      expect(activities.data.activities[2]!.metadata).toEqual({
        previousTeamId: team.id,
        teamId: secondTeam.id,
        previousWorkflowId: teamWorkflow.id,
        workflowId: secondTeamWorkflow.id,
        previousWorkflowStatusId: teamTodo.id,
        workflowStatusId: secondTeamTodo.id,
      });
      expect(activities.data.activities[3]!.metadata).toEqual({
        previousTeamId: secondTeam.id,
        previousWorkflowId: secondTeamWorkflow.id,
        workflowId: defaultWorkflow.id,
        previousWorkflowStatusId: secondTeamTodo.id,
        workflowStatusId: defaultTodo.id,
      });
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

      const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Move date and cycle",
            teamId: null,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
          {
            title: "Create next cycle",
            teamId: null,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-10",
            parentTaskId: null,
          },
          {
            title: "Create later cycle",
            teamId: null,
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

      const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Current assigned to me",
            teamId: null,
            assignedUserId: owner.user!.id!,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
          {
            title: "Current assigned to another member",
            teamId: null,
            assignedUserId: member.user!.id!,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
          {
            title: "Overdue assigned to me",
            teamId: null,
            assignedUserId: owner.user!.id!,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-05-29",
            parentTaskId: null,
          },
          {
            title: "Future assigned to me",
            teamId: null,
            assignedUserId: owner.user!.id!,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-10",
            parentTaskId: null,
          },
          {
            title: "Finished during cycle assigned to me",
            teamId: null,
            assignedUserId: owner.user!.id!,
            workflowStatusId: doneStatus.id,
            dueDate: "2026-06-02",
            parentTaskId: null,
          },
          {
            title: "Finished before cycle assigned to me",
            teamId: null,
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
      const defaultWorkflow = defaults.data.workflows.find((candidate) => candidate.isDefault)!;
      const todoStatus = defaults.data.workflowStatuses.find(
        (status) => status.workflowId === defaultWorkflow.id && status.taskState === "todo",
      )!;
      const doingStatus = defaults.data.workflowStatuses.find(
        (status) => status.workflowId === defaultWorkflow.id && status.taskState === "in_progress",
      )!;
      const doneStatus = defaults.data.workflowStatuses.find(
        (status) => status.workflowId === defaultWorkflow.id && status.taskState === "done",
      )!;
      const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Complete me",
            teamId: null,
            workflowStatusId: todoStatus.id,
            dueDate: "2026-06-03",
            parentTaskId: null,
          },
          {
            title: "Cancel me",
            teamId: null,
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
              teamId: null,
              assignedUserId: null,
              cycleId: cancelMe.cycleId,
              dueDate: "2026-06-03",
              parentTaskId: null,
              workflowId: defaultWorkflow.id,
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
      const doneStatus = defaults.data.workflowStatuses.find(
        (status) => status.workflowId === defaultWorkflow.id && status.taskState === "done",
      )!;
      const otherWorkflow = yield* authenticated.mutation(refs.public.workflows.createForChurch, {
        churchId: church.id!,
        key: "status-move-other-workflow",
        name: "Status Move Other Workflow",
        isDefault: false,
        sortOrder: 5,
        statuses: [
          { key: "todo", name: "To Do", taskState: "todo", sortOrder: 0 },
          { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 1 },
          { key: "done", name: "Done", taskState: "done", sortOrder: 2 },
        ],
      });
      const otherTodoStatus = otherWorkflow.data.workflowStatuses.find(
        (status) => status.key === "todo",
      )!;
      const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
        churchId: church.id!,
        tasks: [
          {
            title: "Move through board",
            teamId: null,
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
            teamId: null,
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

      expect(initialRead.ok).toBe(true);
      expect(initialRead.data.teams).toContainEqual({
        id: team.id,
        name: "Worship Team",
        churchId: church.id,
        archivedAt: null,
        sortOrder: 0,
        defaultWorkflowId: null,
      });

      const defaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
        churchId: church.id!,
      });
      const defaultWorkflow = defaults.data.workflows.find((workflow) => workflow.isDefault)!;

      const updated = yield* authenticated.mutation(refs.public.teams.updateProductFields, {
        churchId: church.id!,
        updates: [
          {
            teamId: team.id!,
            fields: {
              archivedAt: "2026-06-01T00:00:00.000Z",
              sortOrder: 7,
              defaultWorkflowId: defaultWorkflow.id,
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
        sortOrder: 7,
        defaultWorkflowId: defaultWorkflow.id,
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
      const todoStatus = defaults.data.workflowStatuses.find(
        (status) => status.taskState === "todo",
      )!;
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
      const todoStatus = defaults.data.workflowStatuses.find(
        (status) => status.taskState === "todo",
      )!;
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

  it.effect("owners can edit Workflows and assign the Church default Workflow", () =>
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

      const created = yield* authenticated.mutation(refs.public.workflows.createForChurch, {
        churchId: church.id!,
        key: "next-steps",
        name: "Next Steps",
        isDefault: false,
        sortOrder: 1,
        statuses: [
          { key: "todo", name: "To Do", taskState: "todo", sortOrder: 0 },
          { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 1 },
          { key: "done", name: "Done", taskState: "done", sortOrder: 2 },
        ],
      });
      const workflow = created.data.workflows.find((candidate) => candidate.key === "next-steps")!;
      const defaultWorkflow = created.data.workflows.find((candidate) => candidate.isDefault)!;

      const renamed = yield* authenticated.mutation(refs.public.workflows.renameForChurch, {
        churchId: church.id!,
        workflowId: workflow.id,
        name: "Next Steps Workflow",
      });
      const reordered = yield* authenticated.mutation(refs.public.workflows.reorderForChurch, {
        churchId: church.id!,
        workflowIds: [workflow.id, defaultWorkflow.id],
      });
      const defaulted = yield* authenticated.mutation(refs.public.workflows.setDefaultForChurch, {
        churchId: church.id!,
        workflowId: workflow.id,
      });
      const archived = yield* authenticated.mutation(refs.public.workflows.archiveForChurch, {
        churchId: church.id!,
        workflowId: defaultWorkflow.id,
      });
      const activities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "workflow",
        entityId: workflow.id,
      });

      expect(
        renamed.data.workflows.find((candidate) => candidate.id === workflow.id),
      ).toMatchObject({
        name: "Next Steps Workflow",
      });
      expect(
        reordered.data.workflows.map((candidate) => [candidate.id, candidate.sortOrder]),
      ).toEqual([
        [workflow.id, 0],
        [defaultWorkflow.id, 1],
      ]);
      expect(
        defaulted.data.workflows.find((candidate) => candidate.id === workflow.id),
      ).toMatchObject({
        isDefault: true,
      });
      expect(
        defaulted.data.workflows.find((candidate) => candidate.id === defaultWorkflow.id),
      ).toMatchObject({
        isDefault: false,
      });
      expect(
        archived.data.workflows.find((candidate) => candidate.id === defaultWorkflow.id),
      ).toMatchObject({ archivedAt: expect.any(String) });
      expect(activities.data.activities.map((activity) => activity.eventType)).toEqual(
        expect.arrayContaining([
          "workflow.created",
          "workflow.renamed",
          "workflow.reordered",
          "workflow.default_changed",
        ]),
      );
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Workflow archive is blocked while Teams or Tasks reference the Workflow", () =>
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
      const teamResponse = yield* createTeam(c, {
        token: signUpBody.token!,
        name: "Workflow Team",
        organizationId: church.id!,
      });
      const team = (yield* Effect.promise(() => teamResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });

      const teamWorkflowResult = yield* authenticated.mutation(
        refs.public.workflows.createForChurch,
        {
          churchId: church.id!,
          key: "team-workflow",
          name: "Team Workflow",
          isDefault: false,
          sortOrder: 1,
          statuses: [
            { key: "todo", name: "To Do", taskState: "todo", sortOrder: 0 },
            { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 1 },
            { key: "done", name: "Done", taskState: "done", sortOrder: 2 },
          ],
        },
      );
      const taskWorkflowResult = yield* authenticated.mutation(
        refs.public.workflows.createForChurch,
        {
          churchId: church.id!,
          key: "task-workflow",
          name: "Task Workflow",
          isDefault: false,
          sortOrder: 2,
          statuses: [
            { key: "todo", name: "To Do", taskState: "todo", sortOrder: 0 },
            { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 1 },
            { key: "done", name: "Done", taskState: "done", sortOrder: 2 },
          ],
        },
      );
      const teamWorkflow = teamWorkflowResult.data.workflows.find(
        (candidate) => candidate.key === "team-workflow",
      )!;
      const taskWorkflow = taskWorkflowResult.data.workflows.find(
        (candidate) => candidate.key === "task-workflow",
      )!;
      const taskStatus = taskWorkflowResult.data.workflowStatuses.find(
        (status) => status.workflowId === taskWorkflow.id && status.taskState === "todo",
      )!;

      yield* authenticated.mutation(refs.public.teams.updateProductFields, {
        churchId: church.id!,
        updates: [{ teamId: team.id!, fields: { defaultWorkflowId: teamWorkflow.id } }],
      });
      yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();
          yield* Effect.promise(() =>
            ctx.db.insert("tasks", {
              churchId: church.id!,
              title: "Workflow reference task",
              teamId: null,
              assignedUserId: null,
              cycleId: "cycle-workflow-in-use",
              dueDate: "2026-06-03",
              parentTaskId: null,
              workflowId: taskWorkflow.id,
              workflowStatusId: taskStatus.id,
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

      const teamReferencedArchive = yield* authenticated.mutation(
        refs.public.workflows.archiveForChurch,
        {
          churchId: church.id!,
          workflowId: teamWorkflow.id,
        },
      );
      const taskReferencedArchive = yield* authenticated.mutation(
        refs.public.workflows.archiveForChurch,
        {
          churchId: church.id!,
          workflowId: taskWorkflow.id,
        },
      );

      expect(teamReferencedArchive).toEqual({
        ok: false,
        operation: "archiveWorkflow",
        error: {
          code: "workflow_in_use",
          message:
            "Workflows referenced by the Church default, Teams, or Tasks cannot be archived before reassignment.",
        },
      });
      expect(taskReferencedArchive).toEqual(teamReferencedArchive);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("owners can assign and clear a Team default Workflow", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-team-default-workflow-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Team Default Workflow Church",
        slug: `team-default-workflow-${crypto.randomUUID()}`,
      });
      const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };
      const teamResponse = yield* createTeam(c, {
        token: signUpBody.token!,
        name: "Hospitality",
        organizationId: church.id!,
      });
      const team = (yield* Effect.promise(() => teamResponse.json())) as { id?: string };
      const authenticated = yield* authenticatedConfect(c, {
        userId: signUpBody.user!.id!,
        sessionToken: signUpBody.token!,
      });
      const createdWorkflow = yield* authenticated.mutation(refs.public.workflows.createForChurch, {
        churchId: church.id!,
        key: "hospitality-flow",
        name: "Hospitality Flow",
        isDefault: false,
        sortOrder: 1,
        statuses: [
          { key: "todo", name: "To Do", taskState: "todo", sortOrder: 0 },
          { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 1 },
          { key: "done", name: "Done", taskState: "done", sortOrder: 2 },
        ],
      });
      const workflow = createdWorkflow.data.workflows.find(
        (candidate) => candidate.key === "hospitality-flow",
      )!;

      const assigned = yield* authenticated.mutation(refs.public.teams.updateProductFields, {
        churchId: church.id!,
        updates: [{ teamId: team.id!, fields: { defaultWorkflowId: workflow.id } }],
      });
      const cleared = yield* authenticated.mutation(refs.public.teams.updateProductFields, {
        churchId: church.id!,
        updates: [{ teamId: team.id!, fields: { defaultWorkflowId: null } }],
      });
      const activities = yield* authenticated.query(refs.public.activities.listForEntity, {
        churchId: church.id!,
        entityType: "team",
        entityId: team.id!,
      });

      expect(assigned.data.teams.find((candidate) => candidate.id === team.id)).toMatchObject({
        defaultWorkflowId: workflow.id,
      });
      expect(cleared.data.teams.find((candidate) => candidate.id === team.id)).toMatchObject({
        defaultWorkflowId: null,
      });
      expect(
        activities.data.activities.filter(
          (activity) => activity.eventType === "team.default_workflow_changed",
        ),
      ).toEqual([
        expect.objectContaining({
          metadata: { previousWorkflowId: null, workflowId: workflow.id },
        }),
        expect.objectContaining({
          metadata: { previousWorkflowId: workflow.id, workflowId: null },
        }),
      ]);
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

      const created = yield* authenticated.mutation(refs.public.workflows.createForChurch, {
        churchId: church.id!,
        key: "status-edit-workflow",
        name: "Status Edit Workflow",
        isDefault: false,
        sortOrder: 1,
        statuses: [
          { key: "todo", name: "To Do", taskState: "todo", sortOrder: 0 },
          { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 1 },
          { key: "done", name: "Done", taskState: "done", sortOrder: 2 },
        ],
      });
      const workflow = created.data.workflows.find(
        (candidate) => candidate.key === "status-edit-workflow",
      )!;
      const doingStatus = created.data.workflowStatuses.find(
        (status) => status.workflowId === workflow.id && status.key === "doing",
      )!;
      const todoStatus = created.data.workflowStatuses.find(
        (status) => status.workflowId === workflow.id && status.key === "todo",
      )!;
      const doneStatus = created.data.workflowStatuses.find(
        (status) => status.workflowId === workflow.id && status.key === "done",
      )!;

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
        statusIds: [reviewStatus.id, doingStatus.id].concat(
          created.data.workflowStatuses
            .filter(
              (status) =>
                status.workflowId === workflow.id &&
                status.id !== reviewStatus.id &&
                status.id !== doingStatus.id,
            )
            .map((status) => status.id),
        ),
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

      yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();
          yield* Effect.promise(() =>
            ctx.db.insert("tasks", {
              churchId: church.id!,
              title: "Task using To Do",
              teamId: null,
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
      const created = yield* authenticated.mutation(refs.public.workflows.createForChurch, {
        churchId: church.id!,
        key: "canceled-history-workflow",
        name: "Canceled History Workflow",
        isDefault: false,
        sortOrder: 1,
        statuses: [
          { key: "todo", name: "To Do", taskState: "todo", sortOrder: 0 },
          { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 1 },
          { key: "ready", name: "Ready", taskState: "in_progress", sortOrder: 2 },
          { key: "done", name: "Done", taskState: "done", sortOrder: 3 },
        ],
      });
      const workflow = created.data.workflows.find(
        (candidate) => candidate.key === "canceled-history-workflow",
      )!;
      const readyStatus = created.data.workflowStatuses.find(
        (status) => status.workflowId === workflow.id && status.key === "ready",
      )!;

      yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();
          yield* Effect.promise(() =>
            ctx.db.insert("tasks", {
              churchId: church.id!,
              title: "Canceled task using Ready",
              teamId: null,
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
              teamId: null,
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

      expect(fallbackTask).toMatchObject({
        workflowId: destinationWorkflow.id,
        workflowStatusId: destinationReady.id,
        taskState: "in_progress",
      });
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect("Task Team changes fall back to the Church default Workflow", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const email = `agent-task-team-default-fallback-${crypto.randomUUID()}@example.com`;
      const signUpResponse = yield* signUpWithEmail(c, email);
      const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
        user?: { id?: string };
        token?: string;
      };
      const churchResponse = yield* createChurch(c, {
        token: signUpBody.token!,
        name: "Task Remap Default Fallback Church",
        slug: `task-remap-default-fallback-${crypto.randomUUID()}`,
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
      const defaultWorkflow = defaults.data.workflows.find((workflow) => workflow.isDefault)!;
      const defaultDoing = defaults.data.workflowStatuses.find(
        (status) => status.workflowId === defaultWorkflow.id && status.taskState === "in_progress",
      )!;
      const source = yield* authenticated.mutation(refs.public.workflows.createForChurch, {
        churchId: church.id!,
        key: "source-fallback-workflow",
        name: "Source Fallback Workflow",
        isDefault: false,
        sortOrder: 1,
        statuses: [
          { key: "todo", name: "To Do", taskState: "todo", sortOrder: 0 },
          { key: "doing", name: "Doing", taskState: "in_progress", sortOrder: 1 },
          { key: "done", name: "Done", taskState: "done", sortOrder: 2 },
        ],
      });
      const sourceWorkflow = source.data.workflows.find(
        (workflow) => workflow.key === "source-fallback-workflow",
      )!;
      const sourceDoing = source.data.workflowStatuses.find(
        (status) => status.workflowId === sourceWorkflow.id && status.key === "doing",
      )!;
      const taskId = yield* c.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx.MutationCtx<DataModel>();

          return yield* Effect.promise(() =>
            ctx.db.insert("tasks", {
              churchId: church.id!,
              title: "Default Fallback Remapped Task",
              teamId: null,
              assignedUserId: null,
              cycleId: "cycle-remap-default-fallback",
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
        workflowId: defaultWorkflow.id,
        workflowStatusId: defaultDoing.id,
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
                  teamId: null,
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
