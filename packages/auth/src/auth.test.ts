import { createDb } from "@church-task/db";
import {
  labels,
  member,
  organization,
  team_memberships,
  teams,
  user,
} from "@church-task/db/schema";
import { getOrgId, getOrgUserId, getSessionId, getUserId } from "@church-task/shared/get-ids";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";
import { parseSetCookieHeader } from "better-auth/cookies";
import { betterAuth } from "better-auth/minimal";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { describe, expect, test } from "vitest";

import {
  createAuthOptions,
  createLocalOtpStore,
  enrichActiveOrganizationSession,
  enrichNewSession,
} from "./auth";

describe("Better Auth Postgres foundation", () => {
  test("wires the Church Task auth plugin set and local OTP capture", async () => {
    const container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const { db, pool } = createDb(container.getConnectionUri());

    try {
      await migrate(db, {
        migrationsFolder: new URL("../../db/drizzle", import.meta.url).pathname,
      });

      const otpStore = createLocalOtpStore();
      const options = createAuthOptions(db, otpStore);

      expect(options.plugins?.map((plugin) => plugin.id)).toEqual([
        "complete-onboarding",
        "clear-org-for-onboarding",
        "email-otp",
        "organization",
        "admin",
        "custom-session",
      ]);

      await otpStore.sendVerificationOTP({
        email: "avery.member@church-task.test",
        otp: "123456",
        type: "sign-in",
      });

      expect(otpStore.getLatestOtp("avery.member@church-task.test", "sign-in")).toEqual({
        email: "avery.member@church-task.test",
        otp: "123456",
        type: "sign-in",
      });
    } finally {
      await pool.end();
      await container.stop();
    }
  }, 60_000);

  test("enriches session records with App Admin and active Church context", async () => {
    const container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const { db, pool } = createDb(container.getConnectionUri());

    try {
      await migrate(db, {
        migrationsFolder: new URL("../../db/drizzle", import.meta.url).pathname,
      });

      const userId = getUserId();
      const orgId = getOrgId();

      await db.insert(user).values({
        email: "ada.admin@church-task.test",
        emailVerified: true,
        id: userId,
        name: "Ada App Administrator",
        role: "admin",
      });

      await db.insert(organization).values({
        churchTimeZone: "America/Chicago",
        completedOnboarding: true,
        id: orgId,
        name: "Seed Church",
        slug: "seed-church",
      });

      await db.insert(member).values({
        id: getOrgUserId(),
        organizationId: orgId,
        role: "owner",
        userId,
      });

      const enriched = await enrichNewSession(db, {
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        id: getSessionId(),
        token: "session-token",
        userId,
      });

      expect(enriched).toMatchObject({
        activeOrganizationId: orgId,
        orgCompletedOnboarding: true,
        orgRole: "owner",
        orgType: "church",
        userRole: "admin",
      });

      const activeOrgUpdate = await enrichActiveOrganizationSession(
        db,
        { activeOrganizationId: orgId },
        userId,
      );

      expect(activeOrgUpdate).toMatchObject({
        activeOrganizationId: orgId,
        orgCompletedOnboarding: true,
        orgRole: "owner",
        orgType: "church",
        skipOrgFallback: false,
      });
    } finally {
      await pool.end();
      await container.stop();
    }
  }, 60_000);

  test("creates a Church organization, seeds onboarding data, and activates it", async () => {
    const container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const { db, pool } = createDb(container.getConnectionUri());

    try {
      await migrate(db, {
        migrationsFolder: new URL("../../db/drizzle", import.meta.url).pathname,
      });

      const auth = betterAuth(createAuthOptions(db));
      const cookieHeaders = new Headers();
      const authClient = createAuthClient({
        baseURL: "http://localhost:3000",
        fetchOptions: {
          customFetchImpl: async (input, init) => {
            const response = await auth.handler(new Request(input, init));
            return response;
          },
        },
        plugins: [
          organizationClient({
            schema: {
              organization: {
                additionalFields: {
                  churchTimeZone: { required: true, type: "string" },
                  completedOnboarding: { required: false, type: "boolean" },
                },
              },
            },
          }),
        ],
      });

      await authClient.signUp.email({
        email: "founder@church-task.test",
        fetchOptions: {
          onSuccess: (context) => {
            const cookies = parseSetCookieHeader(context.response.headers.get("set-cookie") ?? "");
            const sessionCookie = cookies.get("better-auth.session_token")?.value;
            if (sessionCookie) {
              cookieHeaders.set("cookie", `better-auth.session_token=${sessionCookie}`);
            }
          },
        },
        name: "Founder",
        password: "password-12345678",
      });

      const created = await authClient.organization.create({
        churchTimeZone: "America/Chicago",
        completedOnboarding: false,
        fetchOptions: { headers: cookieHeaders },
        name: "Regression Church",
        slug: "regression-church",
      });

      expect(created.error).toBeNull();
      expect(created.data?.id).toEqual(expect.stringMatching(/^org_/));

      const session = await authClient.getSession({ fetchOptions: { headers: cookieHeaders } });

      expect(session.data?.session.activeOrganizationId).toBe(created.data?.id);
      await expect(db.select().from(teams)).resolves.toHaveLength(3);
      await expect(db.select().from(team_memberships)).resolves.toHaveLength(3);
      await expect(db.select().from(labels)).resolves.toHaveLength(7);
    } finally {
      await pool.end();
      await container.stop();
    }
  }, 60_000);

  test("updates and removes Church members through the Better Auth organization API", async () => {
    const container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const { db, pool } = createDb(container.getConnectionUri());

    try {
      await migrate(db, {
        migrationsFolder: new URL("../../db/drizzle", import.meta.url).pathname,
      });

      const auth = betterAuth(createAuthOptions(db));
      const ownerCookieHeaders = new Headers();
      const authClient = createAuthClient({
        baseURL: "http://localhost:3000",
        fetchOptions: {
          customFetchImpl: async (input, init) => auth.handler(new Request(input, init)),
        },
        plugins: [
          organizationClient({
            schema: {
              organization: {
                additionalFields: {
                  churchTimeZone: { required: true, type: "string" },
                  completedOnboarding: { required: false, type: "boolean" },
                },
              },
            },
          }),
        ],
      });

      await authClient.signUp.email({
        email: "owner@church-task.test",
        fetchOptions: {
          onSuccess: (context) => {
            const cookies = parseSetCookieHeader(context.response.headers.get("set-cookie") ?? "");
            const sessionCookie = cookies.get("better-auth.session_token")?.value;
            if (sessionCookie) {
              ownerCookieHeaders.set("cookie", `better-auth.session_token=${sessionCookie}`);
            }
          },
        },
        name: "Owner",
        password: "password-12345678",
      });

      const created = await authClient.organization.create({
        churchTimeZone: "America/Chicago",
        completedOnboarding: true,
        fetchOptions: { headers: ownerCookieHeaders },
        name: "Membership Church",
        slug: "membership-church",
      });

      expect(created.error).toBeNull();
      const organizationId = created.data?.id;
      expect(organizationId).toEqual(expect.stringMatching(/^org_/));

      const memberUserId = getUserId();
      const memberId = getOrgUserId();
      await db.insert(user).values({
        email: "member@church-task.test",
        emailVerified: true,
        id: memberUserId,
        name: "Member",
      });
      await db.insert(member).values({
        id: memberId,
        organizationId: organizationId!,
        role: "member",
        userId: memberUserId,
      });

      const updated = await authClient.organization.updateMemberRole({
        fetchOptions: { headers: ownerCookieHeaders },
        memberId,
        organizationId: organizationId!,
        role: "admin",
      });

      expect(updated.error).toBeNull();
      await expect(db.select().from(member).where(eq(member.id, memberId))).resolves.toMatchObject([
        { id: memberId, role: "admin" },
      ]);

      const removed = await authClient.organization.removeMember({
        fetchOptions: { headers: ownerCookieHeaders },
        memberIdOrEmail: memberId,
        organizationId: organizationId!,
      });

      expect(removed.error).toBeNull();
      await expect(db.select().from(member).where(eq(member.id, memberId))).resolves.toEqual([]);
    } finally {
      await pool.end();
      await container.stop();
    }
  }, 60_000);
});
