/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, components } from "../convex/_generated/api";
import { buildAdminUserCollectionItem, buildAdminUserUpdate } from "../convex/admin";
import betterAuthSchema from "../convex/betterAuth/schema";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/!(*.*.*)*.*s");
const betterAuthModules = import.meta.glob("../convex/betterAuth/**/*.ts");

process.env.SITE_URL ??= "http://localhost:2101";
process.env.CONVEX_SITE_URL ??= "http://127.0.0.1:3210";

const decodeJwtPayload = (token: string) =>
  JSON.parse(atob(token.split(".")[1]!.replaceAll("-", "+").replaceAll("_", "/"))) as {
    sessionId?: string;
  };

function createAdminTest() {
  const t = convexTest(schema, modules);
  t.registerComponent("betterAuth", betterAuthSchema, betterAuthModules);

  return t;
}

async function signUpWithEmail(
  t: ReturnType<typeof convexTest>,
  email: string,
  name = "Test User",
) {
  const response = await t.fetch("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:2101",
    },
    body: JSON.stringify({
      name,
      email,
      password: "correct horse battery staple",
    }),
  });

  expect(response.status).toBe(200);

  return (await response.json()) as {
    readonly token: string;
    readonly user: { readonly id: string };
  };
}

async function createChurch(
  t: ReturnType<typeof convexTest>,
  args: { readonly token: string; readonly name: string; readonly slug: string },
) {
  const response = await t.fetch("/api/auth/organization/create", {
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

  expect(response.status).toBe(200);

  return (await response.json()) as { readonly id: string };
}

async function convexTokenForSession(t: ReturnType<typeof convexTest>, sessionToken: string) {
  const tokenResponse = await t.fetch("/api/auth/convex/token", {
    method: "GET",
    headers: { authorization: `Bearer ${sessionToken}` },
  });
  const tokenBody = (await tokenResponse.json()) as { readonly token: string };

  expect(tokenResponse.status).toBe(200);

  return decodeJwtPayload(tokenBody.token);
}

describe("admin user queries", () => {
  it("rejects listAllUsers without an App Administrator session", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.query(api.admin.listAllUsers, {
        listArgs: {},
        paginationOpts: { cursor: null, numItems: 10 },
      }),
    ).rejects.toThrow("App Administrator access required.");
  });

  it("rejects getUser without an App Administrator session", async () => {
    const t = convexTest(schema, modules);

    await expect(t.query(api.admin.getUser, { userId: "user_123" })).rejects.toThrow(
      "App Administrator access required.",
    );
  });

  it("rejects updateUser without an App Administrator session", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.admin.updateUser, {
        userId: "user_123",
        name: "Updated User",
        email: "updated@example.com",
      }),
    ).rejects.toThrow("App Administrator access required.");
  });

  it("rejects impersonation without an App Administrator session", async () => {
    const t = createAdminTest();
    const member = await signUpWithEmail(
      t,
      `member-impersonate-${crypto.randomUUID()}@example.com`,
      "Member Impersonator",
    );
    const target = await signUpWithEmail(
      t,
      `target-impersonate-${crypto.randomUUID()}@example.com`,
      "Target User",
    );

    const response = await t.fetch("/api/auth/admin/impersonate-user", {
      method: "POST",
      headers: {
        authorization: `Bearer ${member.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: target.user.id }),
    });

    expect(response.status).toBe(403);
  });

  it("updates editable User fields for App Administrators", async () => {
    const t = createAdminTest();
    const admin = await signUpWithEmail(
      t,
      `admin-update-user-${crypto.randomUUID()}@example.com`,
      "Admin User",
    );
    const target = await signUpWithEmail(
      t,
      `target-update-user-${crypto.randomUUID()}@example.com`,
      "Original User",
    );

    await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "user",
          where: [{ field: "_id", value: admin.user.id }],
          update: { role: "admin" },
        },
      }),
    );

    const tokenPayload = await convexTokenForSession(t, admin.token);
    const authenticated = t.withIdentity({
      subject: admin.user.id,
      sessionId: tokenPayload.sessionId!,
    });

    await authenticated.mutation(api.admin.updateUser, {
      userId: target.user.id,
      name: "Updated User",
      email: "updated-user@example.com",
    });

    const updated = await authenticated.query(api.admin.getUser, { userId: target.user.id });

    expect(updated).toMatchObject({
      id: target.user.id,
      name: "Updated User",
      email: "updated-user@example.com",
    });
  });

  it("projects users with church memberships and supports server-side church filtering", async () => {
    const t = createAdminTest();
    const admin = await signUpWithEmail(
      t,
      `admin-users-${crypto.randomUUID()}@example.com`,
      "Admin User",
    );
    const member = await signUpWithEmail(
      t,
      `member-users-${crypto.randomUUID()}@example.com`,
      "Member User",
    );
    const church = await createChurch(t, {
      token: admin.token,
      name: "Users Test Church",
      slug: `users-test-${crypto.randomUUID()}`,
    });

    await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "user",
          where: [{ field: "_id", value: admin.user.id }],
          update: { role: "admin" },
        },
      }),
    );
    await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: "member",
          data: {
            organizationId: church.id,
            userId: member.user.id,
            role: "member",
            createdAt: Date.now(),
          },
        },
      }),
    );

    const tokenPayload = await convexTokenForSession(t, admin.token);
    const authenticated = t.withIdentity({
      subject: admin.user.id,
      sessionId: tokenPayload.sessionId!,
    });

    const result = await authenticated.query(api.admin.listAllUsers, {
      listArgs: {
        filters: [
          {
            columnId: "churches",
            operator: "include any of",
            type: "multiOption",
            values: [church.id],
          },
        ],
        orderBy: "name",
        orderDirection: "asc",
      },
      paginationOpts: { cursor: null, numItems: 10 },
    });

    expect(result.page.map((user) => user.id)).toContain(member.user.id);
    expect(result.page.find((user) => user.id === member.user.id)?.churches).toEqual([
      { id: church.id, name: "Users Test Church", role: "member", slug: expect.any(String) },
    ]);
  });

  it("projects admin user collection fields", () => {
    expect(
      buildAdminUserCollectionItem(
        {
          _id: "user_123",
          name: "Ada Lovelace",
          email: "ada@example.com",
          image: null,
          createdAt: 1_767_312_000_000,
        },
        [{ id: "org_123", name: "Grace Church", role: "owner", slug: "grace" }],
      ),
    ).toEqual({
      id: "user_123",
      name: "Ada Lovelace",
      email: "ada@example.com",
      image: null,
      createdAt: 1_767_312_000_000,
      churches: [{ id: "org_123", name: "Grace Church", role: "owner", slug: "grace" }],
    });
  });

  it("builds the Better Auth user update payload", () => {
    expect(buildAdminUserUpdate({ name: "Ada Lovelace", email: "ada@example.com" })).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
    });
  });
});
