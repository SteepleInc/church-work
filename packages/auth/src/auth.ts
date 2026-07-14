import {
  adjustChurchCyclesForTimeZone,
  bootstrapChurchOnboarding,
  createDb,
} from "@church-work/db";
import {
  getAccountId,
  getApiKeyId,
  getChurchInvitationId,
  getOrgId,
  getOrgUserId,
  getSessionId,
  getSubscriptionId,
  getUserId,
  getVerificationId,
} from "@church-work/shared/get-ids";
import { apiKey } from "@better-auth/api-key";
import { stripe } from "@better-auth/stripe";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
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
  subscription,
  user,
  verification,
} from "@church-work/db/schema";
import { reactInvitationEmail, reactOTPEmail } from "@church-work/email";
import type { ChurchWorkDb } from "@church-work/db";
import { Resend } from "resend";
import Stripe from "stripe";

import {
  churchLifecycle,
  clearOrgForOnboarding,
  completeOnboarding,
  type ChurchSubscriptionCancellation,
} from "./plugins";
import { resolveStripeBillingConfig } from "./stripe-config";

const appName = "Church Work";
const defaultEmailFrom = "Church Work <auth@churchwork.ai>";

const getEmailFrom = () => {
  const configuredFrom = process.env.CHURCH_INVITATION_EMAIL_FROM;

  if (!configuredFrom) {
    return defaultEmailFrom;
  }

  return configuredFrom.includes("<") ? configuredFrom : `Church Work <${configuredFrom}>`;
};

const getSiteUrl = () =>
  process.env.SITE_URL ??
  process.env.BETTER_AUTH_URL ??
  process.env.E2E_SITE_URL ??
  (process.env.NODE_ENV === "production" ? "https://churchwork.ai" : "http://localhost:2001");

// Zero connects to zero.<site host>, and zero-cache forwards the auth cookie
// to the Zero query/mutate endpoints. Host-only cookies never reach that
// subdomain, so production cookies must be scoped to the parent domain.
// Local dev keeps host-only cookies and uses the same-origin /zero proxy.
//
// The production cookie prefix differs from the default so domain-scoped
// cookies get a fresh name: browsers keep pre-existing host-only cookies with
// the default name as separate cookies, send both, and the stale one shadows
// the new session on the server.
const getProductionCookieConfig = () => {
  const hostname = new URL(getSiteUrl()).hostname;
  const isLocalHostname = ["127.0.0.1", "localhost"].includes(hostname);

  return isLocalHostname
    ? {}
    : {
        cookiePrefix: "church-work",
        crossSubDomainCookies: { domain: hostname, enabled: true },
      };
};

const createResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;

  return apiKey ? new Resend(apiKey) : null;
};

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
  subscription: getSubscriptionId,
  user: getUserId,
  verification: getVerificationId,
} satisfies Record<string, () => string>;

const getTrustedOrigins = () =>
  [
    process.env.CORS_ORIGIN,
    process.env.SITE_URL,
    process.env.BETTER_AUTH_URL,
    process.env.E2E_SITE_URL,
    process.env.NODE_ENV === "production" ? undefined : "http://localhost:2001",
  ].filter((origin): origin is string => Boolean(origin));

type SessionCreateHookInput = typeof session.$inferInsert;

export const enrichNewSession = async (db: ChurchWorkDb, newSession: SessionCreateHookInput) => {
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
    .where(and(eq(member.userId, newSession.userId), isNull(organizationTable.deletedAt)))
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
  db: ChurchWorkDb,
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
      deletedAt: organizationTable.deletedAt,
    })
    .from(member)
    .leftJoin(organizationTable, eq(member.organizationId, organizationTable.id))
    .where(and(eq(member.userId, userId), eq(member.organizationId, activeOrganizationId)))
    .limit(1);

  if (!membership || membership.deletedAt) {
    return {
      ...updatedSession,
      activeOrganizationId: null,
      orgCompletedOnboarding: null,
      orgRole: null,
      orgType: null,
    };
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
  db: ChurchWorkDb,
  otpStore: LocalOtpStore = createLocalOtpStore(),
  cancellation?: ChurchSubscriptionCancellation,
) => {
  const stripeConfig = resolveStripeBillingConfig(process.env);
  const stripeClient = new Stripe(stripeConfig.secretKey);
  const subscriptionCancellation = cancellation ?? {
    scheduleAtPeriodEnd: async (stripeSubscriptionId: string) => {
      await stripeClient.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
    },
  };
  const keepDeletedChurchOutOfRenewal = async (updatedSubscription: {
    cancelAtPeriodEnd?: boolean | null;
    id: string;
    referenceId: string;
    status: string;
    stripeSubscriptionId?: string | null;
  }) => {
    if (
      updatedSubscription.cancelAtPeriodEnd ||
      !updatedSubscription.stripeSubscriptionId ||
      !["active", "trialing", "past_due"].includes(updatedSubscription.status)
    ) {
      return;
    }

    const [deletedChurch] = await db
      .select({ id: organizationTable.id })
      .from(organizationTable)
      .where(
        and(
          eq(organizationTable.id, updatedSubscription.referenceId),
          isNotNull(organizationTable.deletedAt),
        ),
      )
      .limit(1);

    if (!deletedChurch) return;

    await subscriptionCancellation.scheduleAtPeriodEnd(updatedSubscription.stripeSubscriptionId);
    await db
      .update(subscription)
      .set({ cancelAtPeriodEnd: true })
      .where(eq(subscription.id, updatedSubscription.id));
  };
  const options = {
    advanced: {
      ...getProductionCookieConfig(),
      database: {
        generateId: ({ model }) => modelIds[model as keyof typeof modelIds]?.() ?? false,
      },
    },
    appName,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        account,
        apikey,
        invitation,
        member,
        organization: organizationTable,
        session,
        subscription,
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
      churchLifecycle(db, subscriptionCancellation),
      emailOTP({
        expiresIn: 15 * 60,
        sendVerificationOTP: async (data) => {
          await otpStore.sendVerificationOTP(data);

          if (process.env.NODE_ENV !== "production") {
            return;
          }

          const resend = createResendClient();

          if (!resend) {
            throw new Error("RESEND_API_KEY is required to send Church Work OTP emails.");
          }

          await resend.emails.send({
            from: getEmailFrom(),
            react: reactOTPEmail({
              _tag: "sign-in",
              appName,
              otp: data.otp,
            }),
            subject: `Sign in to ${appName}`,
            to: data.email,
          });
        },
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
              deletedAt: { input: false, required: false, type: "date" },
              deletedBy: { input: false, required: false, type: "string" },
              latitude: { input: true, required: false, type: "number" },
              longitude: { input: true, required: false, type: "number" },
              rollingMaterializationWindowCycles: {
                defaultValue: 3,
                input: true,
                required: false,
                type: "number",
              },
              size: { input: true, required: false, type: "string" },
              state: { input: true, required: false, type: "string" },
              street: { input: true, required: false, type: "string" },
              url: { input: true, required: false, type: "string" },
              zip: { input: true, required: false, type: "string" },
            },
            modelName: "organization",
          },
        },
        sendInvitationEmail: async (data) => {
          const resend = createResendClient();

          if (!resend) {
            if (process.env.NODE_ENV !== "production") {
              console.info(
                `[local-email] invitation for ${data.email}: ${getSiteUrl()}/accept-invitation/${data.id}`,
              );
              return;
            }

            throw new Error("RESEND_API_KEY is required to send Church Work invitation emails.");
          }

          await resend.emails.send({
            from: getEmailFrom(),
            react: reactInvitationEmail({
              appName,
              churchName: data.organization.name,
              invitedByEmail: data.inviter.user.email,
              invitedByUsername: data.inviter.user.name,
              inviteLink: `${getSiteUrl()}/accept-invitation/${data.id}`,
              username: data.email,
            }),
            subject: `You've been invited to join ${data.organization.name} on ${appName}`,
            to: data.email,
          });
        },
      }),
      stripe({
        organization: { enabled: true },
        stripeClient,
        stripeWebhookSecret: stripeConfig.webhookSecret,
        subscription: {
          authorizeReference: async ({ referenceId, user: requestingUser }) => {
            const [membership] = await db
              .select({ role: member.role })
              .from(member)
              .innerJoin(organizationTable, eq(member.organizationId, organizationTable.id))
              .where(
                and(
                  eq(member.organizationId, referenceId),
                  eq(member.userId, requestingUser.id),
                  isNull(organizationTable.deletedAt),
                ),
              )
              .limit(1);

            return membership?.role === "owner" || membership?.role === "admin";
          },
          enabled: true,
          getCheckoutSessionParams: () => ({ params: { automatic_tax: { enabled: true } } }),
          onSubscriptionComplete: async ({ subscription: completedSubscription }) => {
            await keepDeletedChurchOutOfRenewal(completedSubscription);
          },
          onSubscriptionUpdate: async ({ event, subscription: updatedSubscription }) => {
            await keepDeletedChurchOutOfRenewal(updatedSubscription);
            const graceStartedAt =
              updatedSubscription.status === "past_due" ? new Date(event.created * 1000) : null;

            if (updatedSubscription.status === "past_due") {
              await db
                .update(subscription)
                .set({
                  graceStartedAt: sql`coalesce(${subscription.graceStartedAt}, ${graceStartedAt})`,
                })
                .where(eq(subscription.id, updatedSubscription.id));
            } else if (updatedSubscription.status === "active") {
              await db
                .update(subscription)
                .set({ graceStartedAt: null })
                .where(eq(subscription.id, updatedSubscription.id));
            }
          },
          plans: [
            {
              name: "paid",
              priceId: stripeConfig.paidWeeklyPriceId,
            },
          ],
        },
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

export type ChurchWorkAuth = ReturnType<typeof createAuth>["auth"];
