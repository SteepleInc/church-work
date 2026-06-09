import type { BetterAuthPlugin } from "better-auth";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { apiKey } from "@better-auth/api-key";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { admin, bearer, emailOTP, mcp, organization } from "better-auth/plugins";
import { z } from "zod";

import { components, internal } from "./convex/_generated/api";
import type { DataModel } from "./convex/_generated/dataModel";
import authConfig from "./convex/auth.config";
import authSchema from "./convex/betterAuth/schema";
import { sendChurchInvitationEmail } from "./churchInvitationEmail";
import { isValidChurchTimeZone } from "./churchTimeZone";

const siteUrl = process.env.SITE_URL!;
const otpEmailFrom = process.env.AUTH_EMAIL_FROM ?? "Church Task <auth@churchtask.local>";
const isLocalUrl = (url: string | undefined) => {
  if (!url) {
    return false;
  }

  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

export const shouldLogAuthEmails = () =>
  process.env.NODE_ENV === "development" ||
  process.env.CONVEX_DEPLOYMENT?.startsWith("dev:") ||
  isLocalUrl(process.env.SITE_URL);

const trustedOrigins = [
  siteUrl,
  process.env.E2E_SITE_URL,
  "http://127.0.0.1:2101",
  "http://localhost:2101",
].filter((origin): origin is string => Boolean(origin));

export const authComponent = createClient<DataModel, typeof authSchema>(components.betterAuth, {
  local: {
    schema: authSchema,
  },
});

const roleToString = (role: unknown) => (Array.isArray(role) ? role.join(",") : String(role));

const stringOrNull = (value: unknown) => (typeof value === "string" ? value : null);

const recordAuthHookActivity = async (
  ctx: GenericCtx<DataModel>,
  input: {
    readonly churchId: string;
    readonly entityType: "church" | "team";
    readonly entityId: string;
    readonly eventType:
      | "church.created"
      | "church.updated"
      | "church.deleted"
      | "church.member.added"
      | "church.member.removed"
      | "church.member.role_updated"
      | "church.invitation.created"
      | "church.invitation.accepted"
      | "church.invitation.rejected"
      | "church.invitation.canceled"
      | "team.created"
      | "team.member.added"
      | "team.member.removed";
    readonly actorId: string | null;
    readonly metadata: unknown;
  },
) => {
  if (!("runMutation" in ctx)) {
    return;
  }

  try {
    await ctx.runMutation(internal.activities.internalRecordAuthHookActivity, {
      ...input,
      occurredAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Better Auth Activity hook failed", {
      eventType: input.eventType,
      churchId: input.churchId,
      entityType: input.entityType,
      entityId: input.entityId,
      error,
    });
  }
};

const completeOnboarding = () =>
  ({
    endpoints: {
      completeOnboarding: createAuthEndpoint(
        "/complete-onboarding",
        {
          body: z.object({ orgId: z.string() }),
          method: "POST",
          use: [sessionMiddleware],
        },
        async (ctx) => {
          const session = ctx.context.session;
          const { orgId } = ctx.body;

          const membership = await ctx.context.adapter.findOne({
            model: "member",
            where: [
              { field: "organizationId", value: orgId },
              { field: "userId", value: session.user.id },
            ],
          });

          if (!membership) {
            throw ctx.error("FORBIDDEN", {
              message: "User is not a member of this Church.",
            });
          }

          await ctx.context.adapter.update({
            model: "organization",
            update: { completedOnboarding: true },
            where: [{ field: "id", value: orgId }],
          });

          const updatedSession = await ctx.context.internalAdapter.updateSession(
            session.session.token,
            {
              activeOrganizationId: orgId,
            },
          );

          if (!updatedSession) {
            throw ctx.error("INTERNAL_SERVER_ERROR", {
              message: "Failed to update session.",
            });
          }

          await setSessionCookie(ctx, {
            session: updatedSession,
            user: session.user,
          });

          return ctx.json({ status: true });
        },
      ),
    },
    id: "complete-onboarding",
  }) satisfies BetterAuthPlugin;

export const clearOrgForOnboarding = () =>
  ({
    endpoints: {
      clearOrgForOnboarding: createAuthEndpoint(
        "/clear-org-for-onboarding",
        {
          method: "POST",
          use: [sessionMiddleware],
        },
        async (ctx) => {
          const session = ctx.context.session;

          const updatedSession = await ctx.context.internalAdapter.updateSession(
            session.session.token,
            {
              activeOrganizationId: null,
              activeTeamId: null,
              skipOrgFallback: true,
            },
          );

          if (!updatedSession) {
            throw ctx.error("INTERNAL_SERVER_ERROR", {
              message: "Failed to update session.",
            });
          }

          await setSessionCookie(ctx, {
            session: updatedSession,
            user: session.user,
          });

          return ctx.json({ status: true });
        },
      ),
    },
    id: "clear-org-for-onboarding",
  }) satisfies BetterAuthPlugin;

export function createAuthOptions(ctx: GenericCtx<DataModel>) {
  return {
    baseURL: process.env.CONVEX_SITE_URL,
    trustedOrigins,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    session: {
      additionalFields: {
        skipOrgFallback: {
          defaultValue: false,
          input: true,
          required: false,
          type: "boolean",
        },
      },
    },
    plugins: [
      emailOTP({
        expiresIn: 15 * 60,
        async sendVerificationOTP({ email, otp }) {
          if (shouldLogAuthEmails()) {
            console.log("sendVerificationOTP", { email, otp });
            return;
          }

          if (process.env.NODE_ENV === "production") {
            const apiKey = process.env.RESEND_API_KEY;
            if (!apiKey) {
              throw new APIError("INTERNAL_SERVER_ERROR", {
                message: "Email delivery is not configured.",
              });
            }

            const response = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: otpEmailFrom,
                to: email,
                subject: "Sign in to Church Task",
                text: `Your Church Task sign-in code is ${otp}. It expires in 15 minutes.`,
              }),
            });

            if (!response.ok) {
              throw new APIError("INTERNAL_SERVER_ERROR", {
                message: "Could not send sign-in code.",
              });
            }
          }
        },
      }),
      completeOnboarding(),
      clearOrgForOnboarding(),
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
      mcp({ loginPage: "/" }),
      organization({
        requireEmailVerificationOnInvitation: false,
        schema: {
          organization: {
            additionalFields: {
              churchTimeZone: {
                type: "string",
                required: true,
              },
              completedOnboarding: {
                type: "boolean",
                required: false,
              },
              url: {
                type: "string",
                required: false,
              },
              street: {
                type: "string",
                required: false,
              },
              city: {
                type: "string",
                required: false,
              },
              state: {
                type: "string",
                required: false,
              },
              zip: {
                type: "string",
                required: false,
              },
              countryCode: {
                type: "string",
                required: false,
              },
              latitude: {
                type: "number",
                required: false,
              },
              longitude: {
                type: "number",
                required: false,
              },
              size: {
                type: "string",
                required: false,
              },
            },
          },
          team: {
            additionalFields: {
              archivedAt: {
                type: "string",
                required: false,
              },
              sortOrder: {
                type: "number",
                required: false,
              },
              defaultWorkflowId: {
                type: "string",
                required: false,
              },
            },
          },
        },
        organizationHooks: {
          beforeCreateOrganization: async ({ organization }) => {
            if (!isValidChurchTimeZone(organization.churchTimeZone)) {
              throw new APIError("BAD_REQUEST", {
                message: "Church Time Zone must be a valid IANA time zone.",
              });
            }
          },
          afterCreateOrganization: async ({ organization }) => {
            if ("runMutation" in ctx) {
              await ctx.runMutation(internal.workDefaults.internalSeedForChurch, {
                churchId: organization.id,
              });
            }

            await recordAuthHookActivity(ctx, {
              churchId: organization.id,
              entityType: "church",
              entityId: organization.id,
              eventType: "church.created",
              actorId: null,
              metadata: {
                name: organization.name,
                slug: stringOrNull(organization.slug),
                churchTimeZone: stringOrNull(organization.churchTimeZone),
              },
            });
          },
          afterUpdateOrganization: async ({ organization, user }) => {
            if (!organization) {
              return;
            }

            await recordAuthHookActivity(ctx, {
              churchId: organization.id,
              entityType: "church",
              entityId: organization.id,
              eventType: "church.updated",
              actorId: user.id,
              metadata: {
                name: stringOrNull(organization.name),
                slug: stringOrNull(organization.slug),
              },
            });
          },
          afterDeleteOrganization: async ({ organization, user }) => {
            await recordAuthHookActivity(ctx, {
              churchId: organization.id,
              entityType: "church",
              entityId: organization.id,
              eventType: "church.deleted",
              actorId: user.id,
              metadata: {
                name: organization.name,
                slug: stringOrNull(organization.slug),
              },
            });
          },
          afterAddMember: async ({ member, user, organization }) => {
            await recordAuthHookActivity(ctx, {
              churchId: organization.id,
              entityType: "church",
              entityId: organization.id,
              eventType: "church.member.added",
              actorId: user.id,
              metadata: {
                memberUserId: member.userId,
                role: roleToString(member.role),
              },
            });
          },
          afterRemoveMember: async ({ member, user, organization }) => {
            await recordAuthHookActivity(ctx, {
              churchId: organization.id,
              entityType: "church",
              entityId: organization.id,
              eventType: "church.member.removed",
              actorId: user.id,
              metadata: {
                memberUserId: member.userId,
                role: roleToString(member.role),
              },
            });
          },
          afterUpdateMemberRole: async ({ member, previousRole, user, organization }) => {
            await recordAuthHookActivity(ctx, {
              churchId: organization.id,
              entityType: "church",
              entityId: organization.id,
              eventType: "church.member.role_updated",
              actorId: user.id,
              metadata: {
                memberUserId: member.userId,
                previousRole,
                role: roleToString(member.role),
              },
            });
          },
          afterCreateInvitation: async ({ invitation, inviter, organization }) => {
            await recordAuthHookActivity(ctx, {
              churchId: organization.id,
              entityType: "church",
              entityId: organization.id,
              eventType: "church.invitation.created",
              actorId: inviter.id,
              metadata: {
                invitationId: invitation.id,
                email: invitation.email,
                role: roleToString(invitation.role),
                teamId: stringOrNull(invitation.teamId),
              },
            });
          },
          afterAcceptInvitation: async ({ invitation, member, user, organization }) => {
            await recordAuthHookActivity(ctx, {
              churchId: organization.id,
              entityType: "church",
              entityId: organization.id,
              eventType: "church.invitation.accepted",
              actorId: user.id,
              metadata: {
                invitationId: invitation.id,
                memberUserId: member.userId,
                role: roleToString(member.role),
              },
            });
          },
          afterRejectInvitation: async ({ invitation, user, organization }) => {
            await recordAuthHookActivity(ctx, {
              churchId: organization.id,
              entityType: "church",
              entityId: organization.id,
              eventType: "church.invitation.rejected",
              actorId: user.id,
              metadata: {
                invitationId: invitation.id,
                email: invitation.email,
                role: roleToString(invitation.role),
              },
            });
          },
          afterCancelInvitation: async ({ invitation, cancelledBy, organization }) => {
            await recordAuthHookActivity(ctx, {
              churchId: organization.id,
              entityType: "church",
              entityId: organization.id,
              eventType: "church.invitation.canceled",
              actorId: cancelledBy.id,
              metadata: {
                invitationId: invitation.id,
                email: invitation.email,
                role: roleToString(invitation.role),
              },
            });
          },
          afterCreateTeam: async ({ team, user, organization }) => {
            await recordAuthHookActivity(ctx, {
              churchId: organization.id,
              entityType: "team",
              entityId: team.id,
              eventType: "team.created",
              actorId: user?.id ?? null,
              metadata: {
                name: team.name,
              },
            });
          },
          afterAddTeamMember: async ({ teamMember, team, user, organization }) => {
            await recordAuthHookActivity(ctx, {
              churchId: organization.id,
              entityType: "team",
              entityId: team.id,
              eventType: "team.member.added",
              actorId: user.id,
              metadata: {
                memberUserId: teamMember.userId,
              },
            });
          },
          afterRemoveTeamMember: async ({ teamMember, team, user, organization }) => {
            await recordAuthHookActivity(ctx, {
              churchId: organization.id,
              entityType: "team",
              entityId: team.id,
              eventType: "team.member.removed",
              actorId: user.id,
              metadata: {
                memberUserId: teamMember.userId,
              },
            });
          },
        },
        sendInvitationEmail: (data) =>
          sendChurchInvitationEmail(data, {
            apiKey: process.env.RESEND_API_KEY,
            from: process.env.CHURCH_INVITATION_EMAIL_FROM,
            siteUrl,
            fetch,
          }),
        teams: { enabled: true, defaultTeam: { enabled: false } },
      }),
      crossDomain({ siteUrl }),
      convex({
        authConfig,
        jwksRotateOnTokenGenerationError: true,
      }),
    ],
  } satisfies BetterAuthOptions;
}

export function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth(createAuthOptions(ctx));
}
