import {
  adjustChurchCyclesForTimeZone,
  bootstrapChurchOnboarding,
  createDb,
} from "@church-task/db";
import {
  getAccountId,
  getApiKeyId,
  getChurchInvitationId,
  getOrgId,
  getOrgUserId,
  getSessionId,
  getUserId,
  getVerificationId,
} from "@church-task/shared/get-ids";
import { apiKey } from "@better-auth/api-key";
import { and, eq } from "drizzle-orm";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, bearer, customSession, emailOTP, organization } from "better-auth/plugins";
import {
  account,
  apikey,
  invitation,
  member,
  organization as organizationTable,
  session,
  user,
  verification,
} from "@church-task/db/schema";
import type { ChurchTaskDb } from "@church-task/db";

import { clearOrgForOnboarding, completeOnboarding } from "./plugins";

export type CapturedOtp = {
  readonly email: string;
  readonly otp: string;
  readonly type: string;
};

export type LocalOtpStore = {
  readonly getLatestOtp: (email: string, type?: string) => CapturedOtp | undefined;
  readonly sendVerificationOTP: (data: CapturedOtp) => Promise<void>;
};

type LocalOtpStoreOptions = {
  readonly logOtps?: boolean;
};

const shouldLogLocalOtps = () =>
  process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";

export const createLocalOtpStore = (options: LocalOtpStoreOptions = {}): LocalOtpStore => {
  const capturedOtps: CapturedOtp[] = [];
  const logOtps = options.logOtps ?? shouldLogLocalOtps();

  return {
    getLatestOtp: (email, type) =>
      capturedOtps.findLast((otp) => otp.email === email && (!type || otp.type === type)),
    sendVerificationOTP: async (data) => {
      capturedOtps.push(data);

      if (logOtps) {
        console.info(`[local-otp] ${data.type} code for ${data.email}: ${data.otp}`);
      }
    },
  };
};

const modelIds = {
  account: getAccountId,
  apikey: getApiKeyId,
  invitation: getChurchInvitationId,
  member: getOrgUserId,
  organization: getOrgId,
  session: getSessionId,
  user: getUserId,
  verification: getVerificationId,
} satisfies Record<string, () => string>;

const getTrustedOrigins = () =>
  [process.env.CORS_ORIGIN, process.env.SITE_URL, process.env.E2E_SITE_URL].filter(
    (origin): origin is string => Boolean(origin),
  );

type SessionCreateHookInput = typeof session.$inferInsert;

export const enrichNewSession = async (db: ChurchTaskDb, newSession: SessionCreateHookInput) => {
  const [userRow] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, newSession.userId))
    .limit(1);

  const [membership] = await db
    .select({
      completedOnboarding: organizationTable.completedOnboarding,
      organizationId: member.organizationId,
      organizationRole: member.role,
    })
    .from(member)
    .leftJoin(organizationTable, eq(member.organizationId, organizationTable.id))
    .where(eq(member.userId, newSession.userId))
    .limit(1);

  return {
    ...newSession,
    activeOrganizationId: membership?.organizationId,
    orgCompletedOnboarding: membership?.completedOnboarding ?? false,
    orgRole: membership?.organizationRole,
    orgType: "church",
    userRole: userRow?.role,
  };
};

export const enrichActiveOrganizationSession = async (
  db: ChurchTaskDb,
  updatedSession: Partial<typeof session.$inferInsert>,
  userId: string | null | undefined,
) => {
  if (!("activeOrganizationId" in updatedSession) || "orgCompletedOnboarding" in updatedSession) {
    return updatedSession;
  }

  const activeOrganizationId = updatedSession.activeOrganizationId;

  if (!activeOrganizationId || !userId) {
    return updatedSession;
  }

  const [membership] = await db
    .select({
      completedOnboarding: organizationTable.completedOnboarding,
      organizationRole: member.role,
    })
    .from(member)
    .leftJoin(organizationTable, eq(member.organizationId, organizationTable.id))
    .where(and(eq(member.userId, userId), eq(member.organizationId, activeOrganizationId)))
    .limit(1);

  if (!membership) {
    return updatedSession;
  }

  return {
    ...updatedSession,
    orgCompletedOnboarding: membership.completedOnboarding ?? false,
    orgRole: membership.organizationRole,
    orgType: "church",
    skipOrgFallback: false,
  };
};

export const createAuthOptions = (
  db: ChurchTaskDb,
  otpStore: LocalOtpStore = createLocalOtpStore(),
) => {
  const options = {
    advanced: {
      database: {
        generateId: ({ model }) => modelIds[model as keyof typeof modelIds]?.() ?? false,
      },
    },
    appName: "Church Task",
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        account,
        apikey,
        invitation,
        member,
        organization: organizationTable,
        session,
        user,
        verification,
      },
    }),
    databaseHooks: {
      session: {
        create: {
          before: async (newSession) => ({ data: await enrichNewSession(db, newSession) }),
        },
        update: {
          before: async (updatedSession, ctx) => ({
            data: await enrichActiveOrganizationSession(
              db,
              updatedSession,
              ctx?.context.session?.user.id,
            ),
          }),
        },
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      completeOnboarding(),
      clearOrgForOnboarding(),
      emailOTP({
        expiresIn: 15 * 60,
        sendVerificationOTP: otpStore.sendVerificationOTP,
      }),
      organization({
        organizationHooks: {
          afterCreateOrganization: async ({
            member: creatorMember,
            organization: createdOrg,
            user,
          }) => {
            await bootstrapChurchOnboarding(db, {
              church_id: createdOrg.id,
              user_id: creatorMember?.userId ?? user.id,
            });
          },
          afterUpdateOrganization: async ({ organization: updatedOrg, user }) => {
            if (!updatedOrg) return;
            if (!updatedOrg.churchTimeZone) return;

            await adjustChurchCyclesForTimeZone(db, {
              church_id: updatedOrg.id,
              newChurchTimeZone: updatedOrg.churchTimeZone,
              updatedByUserId: user.id,
            });
          },
        },
        organizationCreation: { disabled: false },
        schema: {
          invitation: { modelName: "invitation" },
          member: { modelName: "member" },
          organization: {
            additionalFields: {
              churchTimeZone: { input: true, required: true, type: "string" },
              city: { input: true, required: false, type: "string" },
              completedOnboarding: {
                defaultValue: false,
                input: true,
                required: false,
                type: "boolean",
              },
              countryCode: { input: true, required: false, type: "string" },
              latitude: { input: true, required: false, type: "number" },
              longitude: { input: true, required: false, type: "number" },
              size: { input: true, required: false, type: "string" },
              state: { input: true, required: false, type: "string" },
              street: { input: true, required: false, type: "string" },
              url: { input: true, required: false, type: "string" },
              zip: { input: true, required: false, type: "string" },
            },
            modelName: "organization",
          },
        },
        sendInvitationEmail: async () => {},
      }),
      admin(),
      apiKey({
        apiKeyHeaders: "authorization",
        customAPIKeyGetter: (ctx) => {
          const authorization = ctx.headers?.get("authorization");
          const token = authorization?.startsWith("Bearer ")
            ? authorization.slice("Bearer ".length)
            : null;

          return token?.startsWith("ctcli_") ? token : null;
        },
        defaultPrefix: "ctcli_",
        enableSessionForAPIKeys: true,
        maximumNameLength: 80,
        rateLimit: { enabled: false },
        requireName: true,
      }),
      bearer(),
      customSession(async ({ session: authSession, user: sessionUser }) => {
        const sessionWithChurch = authSession as typeof authSession & {
          readonly activeOrganizationId?: string | null;
        };

        return {
          session: {
            ...authSession,
            activeOrganizationId: sessionWithChurch.activeOrganizationId ?? null,
          },
          user: sessionUser,
        };
      }, undefined),
    ],
    session: {
      additionalFields: {
        orgCompletedOnboarding: { required: false, type: "boolean" },
        orgRole: { required: false, type: "string" },
        orgType: { required: false, type: "string" },
        skipOrgFallback: { defaultValue: false, input: true, required: false, type: "boolean" },
        userRole: { required: false, type: "string" },
      },
    },
    trustedOrigins: getTrustedOrigins(),
  } satisfies BetterAuthOptions;

  return options;
};

export const createAuth = (databaseUrl: string, otpStore?: LocalOtpStore) => {
  const { db, pool } = createDb(databaseUrl);

  const auth = betterAuth(createAuthOptions(db, otpStore));

  return { auth, db, pool };
};

export type ChurchTaskAuth = ReturnType<typeof createAuth>["auth"];
