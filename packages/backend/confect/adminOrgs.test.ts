/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, components } from "../convex/_generated/api";
import { buildAdminOrgCollectionItem, buildAdminOrgUpdate } from "../convex/admin";
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

async function signUpWithEmail(t: ReturnType<typeof convexTest>, email: string) {
  const response = await t.fetch("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:2101",
    },
    body: JSON.stringify({
      name: "Admin Test User",
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

describe("admin org queries", () => {
  it("rejects listAllOrgs without an App Administrator session", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.query(api.admin.listAllOrgs, {
        listArgs: {},
        paginationOpts: { cursor: null, numItems: 10 },
      }),
    ).rejects.toThrow("App Administrator access required.");
  });

  it("rejects getOrg without an App Administrator session", async () => {
    const t = convexTest(schema, modules);

    await expect(t.query(api.admin.getOrg, { orgId: "org_123" })).rejects.toThrow(
      "App Administrator access required.",
    );
  });

  it("rejects updateOrg without an App Administrator session", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.admin.updateOrg, {
        orgId: "org_123",
        name: "Updated Church",
        slug: "updated-church",
        churchTimeZone: "America/Chicago",
        completedOnboarding: true,
        url: "https://updated.example.com",
        street: "1 Main St",
        city: "Austin",
        state: "Texas",
        zip: "78701",
        countryCode: "US",
        size: "251-500",
      }),
    ).rejects.toThrow("App Administrator access required.");
  });

  it("updates editable Church fields for App Administrators", async () => {
    const t = createAdminTest();
    const email = `admin-update-org-${crypto.randomUUID()}@example.com`;
    const signUpBody = await signUpWithEmail(t, email);
    const churchBody = await createChurch(t, {
      token: signUpBody.token,
      name: "Original Church",
      slug: `original-${crypto.randomUUID()}`,
    });

    await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "user",
          where: [{ field: "_id", value: signUpBody.user.id }],
          update: { role: "admin" },
        },
      }),
    );

    const tokenPayload = await convexTokenForSession(t, signUpBody.token);
    const authenticated = t.withIdentity({
      subject: signUpBody.user.id,
      sessionId: tokenPayload.sessionId!,
    });

    await authenticated.mutation(api.admin.updateOrg, {
      orgId: churchBody.id,
      name: "Updated Church",
      slug: "updated-church",
      churchTimeZone: "America/Chicago",
      completedOnboarding: true,
      url: "https://updated.example.com",
      street: "1 Main St",
      city: "Austin",
      state: "Texas",
      zip: "78701",
      countryCode: "US",
      size: "251-500",
    });

    const updated = await authenticated.query(api.admin.getOrg, { orgId: churchBody.id });

    expect(updated).toMatchObject({
      id: churchBody.id,
      name: "Updated Church",
      slug: "updated-church",
      churchTimeZone: "America/Chicago",
      completedOnboarding: true,
      url: "https://updated.example.com",
      street: "1 Main St",
      city: "Austin",
      state: "Texas",
      zip: "78701",
      countryCode: "US",
      size: "251-500",
    });
  });

  it("projects full admin org collection fields and relation counts", () => {
    expect(
      buildAdminOrgCollectionItem(
        {
          _id: "org_123",
          name: "Grace Church",
          slug: "grace",
          logo: null,
          churchTimeZone: "America/New_York",
          completedOnboarding: true,
          url: "https://grace.example.com",
          street: "123 Main St",
          city: "Atlanta",
          state: "Georgia",
          zip: "30301",
          countryCode: "US",
          latitude: 33.749,
          longitude: -84.388,
          size: "250-500",
          createdAt: 1_767_312_000_000,
        },
        { membersCount: 12, teamsCount: 3 },
      ),
    ).toEqual({
      id: "org_123",
      name: "Grace Church",
      slug: "grace",
      logo: null,
      churchTimeZone: "America/New_York",
      completedOnboarding: true,
      url: "https://grace.example.com",
      street: "123 Main St",
      city: "Atlanta",
      state: "Georgia",
      zip: "30301",
      countryCode: "US",
      latitude: 33.749,
      longitude: -84.388,
      size: "250-500",
      membersCount: 12,
      teamsCount: 3,
      createdAt: 1_767_312_000_000,
    });
  });

  it("builds the Better Auth organization update payload", () => {
    expect(
      buildAdminOrgUpdate({
        name: "Grace Church",
        slug: null,
        churchTimeZone: "America/New_York",
        completedOnboarding: true,
        url: "https://grace.example.com",
        street: null,
        city: "Atlanta",
        state: "Georgia",
        zip: "30301",
        countryCode: "US",
        size: null,
      }),
    ).toEqual({
      name: "Grace Church",
      slug: null,
      churchTimeZone: "America/New_York",
      completedOnboarding: true,
      url: "https://grace.example.com",
      street: null,
      city: "Atlanta",
      state: "Georgia",
      zip: "30301",
      countryCode: "US",
      size: null,
    });
  });
});
