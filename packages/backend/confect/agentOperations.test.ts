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
  args: { readonly token: string; readonly name: string; readonly slug: string },
) =>
  c.fetch("/api/auth/organization/create", {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ name: args.name, slug: args.slug }),
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
            },
            membership: { role: "owner" },
          },
        });
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
