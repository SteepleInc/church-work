import type { BetterAuthPlugin, DBAdapter } from "better-auth";
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

const isLocalSiteUrl = (url: string | undefined) => {
  if (!url) return false;

  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

const shouldCaptureOtpWithoutEmail = () =>
  process.env.OTP_CAPTURE_ENABLED === "1" && isLocalSiteUrl(process.env.SITE_URL);

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

          const teams = await ctx.context.adapter.findMany<{
            readonly archivedAt?: string | null;
          }>({
            model: "team",
            where: [
              { field: "organizationId", value: orgId },
              { field: "archivedAt", value: null },
            ],
            limit: 1,
          });

          if (teams.length === 0) {
            throw ctx.error("BAD_REQUEST", {
              code: "team_required",
              message: "A Church must have at least one Team before onboarding can be completed.",
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
              orgCompletedOnboarding: true,
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
              orgCompletedOnboarding: null,
              orgRole: null,
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

/**
 * Picks the Active Church for a brand-new session (login).
 * See docs/adr/0009-active-church-restoration-at-login.md.
 */
const resolveActiveChurchForNewSession = async (
  adapter: DBAdapter,
  userId: string,
): Promise<string | null> => {
  const isMemberOf = async (organizationId: string) => {
    const membership = await adapter.findOne({
      model: "member",
      where: [
        { field: "userId", value: userId },
        { field: "organizationId", value: organizationId },
      ],
    });

    return Boolean(membership);
  };

  // 1. Restore the most recent previous session's Active Church.
  const previousSessions = await adapter.findMany<{ activeOrganizationId?: string | null }>({
    limit: 10,
    model: "session",
    sortBy: { direction: "desc", field: "createdAt" },
    where: [{ field: "userId", value: userId }],
  });

  for (const previousSession of previousSessions) {
    const previousActiveChurchId = previousSession.activeOrganizationId;
    if (previousActiveChurchId && (await isMemberOf(previousActiveChurchId))) {
      return previousActiveChurchId;
    }
  }

  // 2. Fall back to the most recently joined Church.
  const memberships = await adapter.findMany<{ organizationId?: string | null }>({
    limit: 1,
    model: "member",
    sortBy: { direction: "desc", field: "createdAt" },
    where: [{ field: "userId", value: userId }],
  });

  return memberships[0]?.organizationId ?? null;
};

const resolveSessionUserRole = async (adapter: DBAdapter, userId: string) => {
  const user = await adapter.findOne<{ role?: string | null }>({
    model: "user",
    where: [{ field: "id", value: userId }],
  });

  return user?.role ?? null;
};

const resolveActiveChurchSessionFields = async (
  adapter: DBAdapter,
  input: { readonly activeOrganizationId: string | null; readonly userId: string },
) => {
  if (!input.activeOrganizationId) {
    return {
      orgCompletedOnboarding: null,
      orgRole: null,
    };
  }

  const [organization, membership] = await Promise.all([
    adapter.findOne<{ completedOnboarding?: boolean | null }>({
      model: "organization",
      where: [{ field: "id", value: input.activeOrganizationId }],
    }),
    adapter.findOne<{ role?: string | null }>({
      model: "member",
      where: [
        { field: "userId", value: input.userId },
        { field: "organizationId", value: input.activeOrganizationId },
      ],
    }),
  ]);

  return {
    orgCompletedOnboarding: organization?.completedOnboarding ?? false,
    orgRole: membership?.role ?? null,
  };
};

export function createAuthOptions(ctx: GenericCtx<DataModel>) {
  return {
    baseURL: process.env.CONVEX_SITE_URL,
    trustedOrigins,
    database: authComponent.adapter(ctx),
    databaseHooks: {
      session: {
        create: {
          before: async (session, hookCtx) => {
            const adapter = hookCtx?.context.adapter;
            if (!adapter) {
              return;
            }

            const userRole = await resolveSessionUserRole(adapter, session.userId);
            const sessionInput = session as typeof session & {
              activeOrganizationId?: string | null;
            };
            const activeOrganizationId =
              sessionInput.activeOrganizationId ??
              (await resolveActiveChurchForNewSession(adapter, session.userId));
            const activeChurchSessionFields = await resolveActiveChurchSessionFields(adapter, {
              activeOrganizationId,
              userId: session.userId,
            });

            return {
              data: { ...session, activeOrganizationId, userRole, ...activeChurchSessionFields },
            };
          },
        },
        update: {
          before: async (session, hookCtx) => {
            if (!hookCtx?.context.adapter) {
              return { data: session };
            }

            const hasActiveChurchUpdate = "activeOrganizationId" in session;
            const hasKnownOnboardingState = "orgCompletedOnboarding" in session;
            if (!hasActiveChurchUpdate || hasKnownOnboardingState) {
              return { data: session };
            }

            const currentSession = hookCtx.context.session;
            const userId = currentSession?.user.id;
            if (!userId) {
              return { data: session };
            }

            const activeOrganizationId = (session as { activeOrganizationId?: string | null })
              .activeOrganizationId;
            const activeChurchSessionFields = await resolveActiveChurchSessionFields(
              hookCtx.context.adapter,
              {
                activeOrganizationId: activeOrganizationId ?? null,
                userId,
              },
            );

            return { data: { ...session, ...activeChurchSessionFields, skipOrgFallback: false } };
          },
        },
      },
    },
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
        orgCompletedOnboarding: {
          required: false,
          type: "boolean",
        },
        orgRole: {
          required: false,
          type: "string",
        },
        userRole: {
          required: false,
          type: "string",
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

          if (shouldCaptureOtpWithoutEmail()) {
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
              color: {
                type: "string",
                required: false,
              },
              identifier: {
                type: "string",
                required: false,
              },
              previousIdentifiers: {
                type: "string[]",
                required: false,
              },
              nextTaskNumber: {
                type: "number",
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
          afterCreateOrganization: async ({ organization, user }) => {
            if ("runMutation" in ctx) {
              await ctx.runMutation(internal.workDefaults.internalSeedForChurch, {
                churchId: organization.id,
                creatorUserId: user.id,
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
            // Every Team owns its Workflow (ADR 0013): seed it even for teams
            // created through the raw Better Auth create-team endpoint.
            if ("runMutation" in ctx) {
              await ctx.runMutation(internal.workDefaults.internalSeedTeamWorkflow, {
                churchId: organization.id,
                teamId: team.id,
                name: team.name,
              });
              if (user) {
                await ctx.runMutation(internal.workDefaults.internalSeedTeamCreatorMembership, {
                  teamId: team.id,
                  userId: user.id,
                });
              }
            }

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
