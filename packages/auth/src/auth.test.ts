import { createDb } from "@church-work/db";
import {
  labels,
  member,
  organization,
  subscription,
  team_memberships,
  teams,
  user,
} from "@church-work/db/schema";
import {
  hasPaidEntitlements,
  resolveChurchSubscription,
  STARTER_LABELS,
  STARTER_TEAM_NAMES,
} from "@church-work/domain";
import { getOrgId, getOrgUserId, getSessionId, getUserId } from "@church-work/shared/get-ids";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";
import { parseSetCookieHeader } from "better-auth/cookies";
import { betterAuth } from "better-auth/minimal";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { describe, expect, test, vi } from "vitest";

import {
  createAuthOptions,
  createLocalOtpStore,
  enrichActiveOrganizationSession,
  enrichNewSession,
} from "./auth";

describe("Better Auth Postgres foundation", () => {
  test("logs captured OTPs when local OTP logging is enabled", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    try {
      const otpStore = createLocalOtpStore({ logOtps: true });

      await otpStore.sendVerificationOTP({
        email: "local-dev@church-work.test",
        otp: "654321",
        type: "sign-in",
      });

      expect(info).toHaveBeenCalledWith(
        "[local-otp] sign-in code for local-dev@church-work.test: 654321",
      );
    } finally {
      info.mockRestore();
    }
  });

  test("wires the Church Work auth plugin set and local OTP capture", async () => {
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
        "church-lifecycle",
        "email-otp",
        "organization",
        "stripe",
        "admin",
        "api-key",
        "bearer",
        "custom-session",
      ]);

      await otpStore.sendVerificationOTP({
        email: "avery.member@church-work.test",
        otp: "123456",
        type: "sign-in",
      });

      expect(otpStore.getLatestOtp("avery.member@church-work.test", "sign-in")).toEqual({
        email: "avery.member@church-work.test",
        otp: "123456",
        type: "sign-in",
      });
    } finally {
      await pool.end();
      await container.stop();
    }
  }, 60_000);

  test("soft deletes a paid Church, schedules period-end cancellation once, and restores it", async () => {
    const container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const { db, pool } = createDb(container.getConnectionUri());
    const scheduleAtPeriodEnd = vi.fn(async () => {});

    try {
      await migrate(db, {
        migrationsFolder: new URL("../../db/drizzle", import.meta.url).pathname,
      });
      const auth = betterAuth(
        createAuthOptions(db, createLocalOtpStore(), { scheduleAtPeriodEnd }),
      );
      const signUp = await auth.handler(
        new Request("http://localhost:3000/api/auth/sign-up/email", {
          body: JSON.stringify({
            email: "lifecycle-owner@church-work.test",
            name: "Lifecycle Owner",
            password: "password-12345678",
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );
      const cookies = parseSetCookieHeader(signUp.headers.get("set-cookie") ?? "");
      const sessionCookie = cookies.get("better-auth.session_token")?.value;
      const [owner] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, "lifecycle-owner@church-work.test"));
      const churchId = getOrgId();
      await db.insert(organization).values({ id: churchId, name: "Lifecycle Church" });
      await db.insert(member).values({
        id: getOrgUserId(),
        organizationId: churchId,
        role: "owner",
        userId: owner!.id,
      });
      await db.insert(subscription).values({
        cancelAtPeriodEnd: false,
        id: "subscription_lifecycle",
        periodEnd: new Date("2030-01-08T00:00:00.000Z"),
        plan: "paid",
        referenceId: churchId,
        status: "active",
        stripeSubscriptionId: "sub_lifecycle",
      });

      const lifecycleRequest = (path: string) =>
        auth.handler(
          new Request(`http://localhost:3000/api/auth${path}`, {
            body: JSON.stringify({ churchId }),
            headers: {
              "content-type": "application/json",
              cookie: `better-auth.session_token=${sessionCookie}`,
            },
            method: "POST",
          }),
        );

      expect((await lifecycleRequest("/church/delete")).status).toBe(200);
      expect((await lifecycleRequest("/church/delete")).status).toBe(200);
      expect(scheduleAtPeriodEnd).toHaveBeenCalledOnce();
      expect(scheduleAtPeriodEnd).toHaveBeenCalledWith("sub_lifecycle");
      await expect(
        db.select().from(subscription).where(eq(subscription.referenceId, churchId)),
      ).resolves.toHaveLength(1);
      await expect(
        db.select().from(member).where(eq(member.organizationId, churchId)),
      ).resolves.toHaveLength(1);

      expect((await lifecycleRequest("/church/restore")).status).toBe(200);
      expect((await lifecycleRequest("/church/restore")).status).toBe(200);
      await expect(
        db
          .select({ deletedAt: organization.deletedAt, deletedBy: organization.deletedBy })
          .from(organization)
          .where(eq(organization.id, churchId)),
      ).resolves.toEqual([{ deletedAt: null, deletedBy: null }]);

      const paidRows = await db
        .select()
        .from(subscription)
        .where(eq(subscription.referenceId, churchId));
      expect(hasPaidEntitlements(resolveChurchSubscription(paidRows))).toBe(true);

      await db
        .update(subscription)
        .set({ endedAt: new Date(), status: "canceled" })
        .where(eq(subscription.id, "subscription_lifecycle"));
      expect((await lifecycleRequest("/church/delete")).status).toBe(200);
      expect((await lifecycleRequest("/church/restore")).status).toBe(200);
      const endedRows = await db
        .select()
        .from(subscription)
        .where(eq(subscription.referenceId, churchId));
      expect(hasPaidEntitlements(resolveChurchSubscription(endedRows))).toBe(false);
      expect(scheduleAtPeriodEnd).toHaveBeenCalledOnce();
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
        email: "ada.admin@church-work.test",
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
        email: "founder@church-work.test",
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
      if (!created.data) {
        throw new Error("Expected organization creation to return data");
      }

      await expect(
        db.select().from(subscription).where(eq(subscription.referenceId, created.data.id)),
      ).resolves.toHaveLength(0);
      await expect(
        db
          .select({ stripeCustomerId: organization.stripeCustomerId })
          .from(organization)
          .where(eq(organization.id, created.data.id)),
      ).resolves.toEqual([{ stripeCustomerId: null }]);

      const session = await authClient.getSession({ fetchOptions: { headers: cookieHeaders } });

      expect(session.data?.session.activeOrganizationId).toBe(created.data?.id);
      await expect(
        db.select().from(teams).where(eq(teams.church_id, created.data!.id)),
      ).resolves.toHaveLength(STARTER_TEAM_NAMES.length);
      await expect(
        db.select().from(team_memberships).where(eq(team_memberships.church_id, created.data!.id)),
      ).resolves.toHaveLength(STARTER_TEAM_NAMES.length);
      await expect(
        db.select().from(labels).where(eq(labels.church_id, created.data!.id)),
      ).resolves.toHaveLength(STARTER_LABELS.length);
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
        email: "owner@church-work.test",
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
        email: "member@church-work.test",
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
