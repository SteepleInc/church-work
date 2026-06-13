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
      name: "Label Test User",
      email,
      password: "correct horse battery staple",
    }),
  });

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

const createTeam = (
  c: typeof TestConfect.TestConfect.Service,
  args: { readonly token: string; readonly name: string; readonly organizationId: string },
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

const setupChurch = function* (c: typeof TestConfect.TestConfect.Service) {
  const email = `labels-${crypto.randomUUID()}@example.com`;
  const signUpResponse = yield* signUpWithEmail(c, email);
  const signUpBody = (yield* Effect.promise(() => signUpResponse.json())) as {
    user?: { id?: string };
    token?: string;
  };
  const churchResponse = yield* createChurch(c, {
    token: signUpBody.token!,
    name: "Label Test Church",
    slug: `label-test-${crypto.randomUUID().slice(0, 8)}`,
  });
  const church = (yield* Effect.promise(() => churchResponse.json())) as { id?: string };

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

  return {
    authenticated,
    churchId: church.id!,
    sessionToken: signUpBody.token!,
  };
};

const STARTER_LABEL_NAMES = [
  "Admin",
  "Communications",
  "Events",
  "Facilities",
  "Kids & Youth",
  "Outreach",
  "Worship",
];

describe("labels", () => {
  it.effect("seeds Starter Labels at Church creation and lists them alphabetically", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;
      const { authenticated, churchId } = yield* setupChurch(c);

      const result = yield* authenticated.query(refs.public.labels.listForChurch, { churchId });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.labels.map((label) => label.name)).toEqual(STARTER_LABEL_NAMES);
      expect(result.data.labels.every((label) => label.teamId === null)).toBe(true);
    }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect(
    "creates, renames, and rejects duplicate Label names case-insensitively per scope",
    () =>
      Effect.gen(function* () {
        const c = yield* TestConfect.TestConfect;
        const { authenticated, churchId } = yield* setupChurch(c);

        const created = yield* authenticated.mutation(refs.public.labels.createForChurch, {
          churchId,
          name: "Sermon Series",
        });
        expect(created.ok).toBe(true);

        const duplicate = yield* authenticated.mutation(refs.public.labels.createForChurch, {
          churchId,
          name: "  sermon series ",
        });
        expect(duplicate).toMatchObject({
          ok: false,
          error: { code: "duplicate_label_name" },
        });

        if (!created.ok) return;
        const sermonSeries = created.data.labels.find((label) => label.name === "Sermon Series")!;
        const renamed = yield* authenticated.mutation(refs.public.labels.updateForChurch, {
          churchId,
          labelId: sermonSeries.id,
          name: "Easter Series",
          color: "teal",
        });
        expect(renamed.ok).toBe(true);
        if (!renamed.ok) return;
        const easterSeries = renamed.data.labels.find((label) => label.id === sermonSeries.id);
        expect(easterSeries).toMatchObject({ name: "Easter Series", color: "teal" });

        const renameCollision = yield* authenticated.mutation(refs.public.labels.updateForChurch, {
          churchId,
          labelId: sermonSeries.id,
          name: "worship",
        });
        expect(renameCollision).toMatchObject({
          ok: false,
          error: { code: "duplicate_label_name" },
        });
      }).pipe(Effect.provide(TestConfect.layer())),
  );

  it.effect(
    "persists Task labels, enforces Team Label scope, strips on Team change, and strips on delete",
    () =>
      Effect.gen(function* () {
        const c = yield* TestConfect.TestConfect;
        const { authenticated, churchId, sessionToken } = yield* setupChurch(c);

        // Two Teams: the Team Label belongs to the first; moving the Task to
        // the second must strip it (see CONTEXT.md "Team Label").
        const firstTeamResponse = yield* createTeam(c, {
          token: sessionToken,
          name: "Label Source Team",
          organizationId: churchId,
        });
        const firstTeam = (yield* Effect.promise(() => firstTeamResponse.json())) as {
          id?: string;
        };
        const secondTeamResponse = yield* createTeam(c, {
          token: sessionToken,
          name: "Label Destination Team",
          organizationId: churchId,
        });
        const secondTeam = (yield* Effect.promise(() => secondTeamResponse.json())) as {
          id?: string;
        };

        const teamLabelCreated = yield* authenticated.mutation(refs.public.labels.createForChurch, {
          churchId,
          name: "Stage Design",
          teamId: firstTeam.id!,
        });
        expect(teamLabelCreated.ok).toBe(true);
        if (!teamLabelCreated.ok) return;
        const teamLabel = teamLabelCreated.data.labels.find(
          (label) => label.name === "Stage Design",
        )!;
        const churchLabel = teamLabelCreated.data.labels.find((label) => label.name === "Worship")!;

        const workDefaults = yield* authenticated.query(refs.public.workDefaults.readForChurch, {
          churchId,
        });
        if (!workDefaults.ok) throw new Error("work defaults unavailable");
        const todoStatus = workDefaults.data.workflowStatuses.find(
          (status) => status.taskState === "todo",
        )!;

        // Team Label on a Task in another Team is rejected server-side.
        const wrongScope = yield* authenticated.mutation(refs.public.tasks.createBatch, {
          churchId,
          tasks: [
            {
              title: "Mismatched scope Task",
              teamId: secondTeam.id!,
              workflowStatusId: todoStatus.id,
              dueDate: null,
              parentTaskId: null,
              labelIds: [teamLabel.id],
            },
          ],
        });
        expect(wrongScope).toMatchObject({
          ok: false,
          error: { code: "label_not_in_team_scope" },
        });

        const created = yield* authenticated.mutation(refs.public.tasks.createBatch, {
          churchId,
          tasks: [
            {
              title: "Labeled Task",
              teamId: firstTeam.id!,
              workflowStatusId: todoStatus.id,
              dueDate: null,
              parentTaskId: null,
              labelIds: [teamLabel.id, churchLabel.id, teamLabel.id],
            },
          ],
        });
        expect(created.ok).toBe(true);
        if (!created.ok) return;
        const task = created.data.tasks.find((candidate) => candidate.title === "Labeled Task")!;
        // Duplicate ids collapse on write.
        expect([...task.labelIds].sort()).toEqual([teamLabel.id, churchLabel.id].sort());

        // Moving the Task to another Team strips the foreign Team Label but
        // keeps Church-scoped Labels.
        const moved = yield* authenticated.mutation(refs.public.tasks.updateBatch, {
          churchId,
          updates: [{ taskId: task.id, fields: { teamId: secondTeam.id! } }],
        });
        expect(moved.ok).toBe(true);
        if (!moved.ok) return;
        const movedTask = moved.data.tasks.find((candidate) => candidate.id === task.id)!;
        expect(movedTask.labelIds).toEqual([churchLabel.id]);

        // Hard delete strips the Label id from every Task (ADR 0013).
        const deleted = yield* authenticated.mutation(refs.public.labels.deleteForChurch, {
          churchId,
          labelId: churchLabel.id,
        });
        expect(deleted.ok).toBe(true);
        if (!deleted.ok) return;
        expect(deleted.data.labels.some((label) => label.id === churchLabel.id)).toBe(false);

        const afterDelete = yield* authenticated.query(refs.public.tasks.listForChurch, {
          churchId,
        });
        if (!afterDelete.ok) throw new Error("task list unavailable");
        const strippedTask = afterDelete.data.tasks.find((candidate) => candidate.id === task.id)!;
        expect(strippedTask.labelIds).toEqual([]);

        // Label changes are recorded in the Activity log with denormalized
        // names (ADR 0005).
        const activities = yield* authenticated.query(refs.public.activities.listForEntity, {
          churchId,
          entityType: "task",
          entityId: task.id,
        });
        if (!activities.ok) throw new Error("activities unavailable");
        const labelActivity = activities.data.activities.find(
          (activity) => activity.eventType === "task.labels_changed",
        );
        expect(labelActivity).toMatchObject({
          metadata: { removedLabelNames: ["Stage Design"] },
        });
      }).pipe(Effect.provide(TestConfect.layer())),
  );
});
