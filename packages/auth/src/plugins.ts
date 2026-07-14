import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { member, organization, subscription } from "@church-work/db/schema";
import type { ChurchWorkDb } from "@church-work/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

export type ChurchSubscriptionCancellation = {
  readonly scheduleAtPeriodEnd: (stripeSubscriptionId: string) => Promise<void>;
};

export const churchLifecycle = (db: ChurchWorkDb, cancellation: ChurchSubscriptionCancellation) =>
  ({
    endpoints: {
      deleteChurch: createAuthEndpoint(
        "/church/delete",
        { body: z.object({ churchId: z.string() }), method: "POST", use: [sessionMiddleware] },
        async (ctx) => {
          const session = ctx.context.session;
          const { churchId } = ctx.body;
          const [ownership] = await db
            .select({ role: member.role })
            .from(member)
            .where(and(eq(member.organizationId, churchId), eq(member.userId, session.user.id)))
            .limit(1);

          if (ownership?.role !== "owner") {
            throw ctx.error("FORBIDDEN", { message: "Only a Church owner can delete this Church" });
          }

          const [church] = await db
            .select({ deletedAt: organization.deletedAt })
            .from(organization)
            .where(eq(organization.id, churchId))
            .limit(1);

          if (!church) throw ctx.error("NOT_FOUND", { message: "Church not found" });

          if (!church.deletedAt) {
            const activeSubscriptions = await db
              .select({
                cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                stripeSubscriptionId: subscription.stripeSubscriptionId,
              })
              .from(subscription)
              .where(
                and(
                  eq(subscription.referenceId, churchId),
                  inArray(subscription.status, ["active", "trialing", "past_due"]),
                ),
              );

            for (const current of activeSubscriptions) {
              if (current.stripeSubscriptionId && !current.cancelAtPeriodEnd) {
                await cancellation.scheduleAtPeriodEnd(current.stripeSubscriptionId);
              }
            }

            await db
              .update(organization)
              .set({ deletedAt: new Date(), deletedBy: session.user.id })
              .where(and(eq(organization.id, churchId), isNull(organization.deletedAt)));
          }

          if (session.session.activeOrganizationId === churchId) {
            const updatedSession = await ctx.context.internalAdapter.updateSession(
              session.session.token,
              { activeOrganizationId: null, orgCompletedOnboarding: null, orgRole: null },
            );
            if (updatedSession)
              await setSessionCookie(ctx, { session: updatedSession, user: session.user });
          }

          return ctx.json({ status: true });
        },
      ),
      restoreChurch: createAuthEndpoint(
        "/church/restore",
        { body: z.object({ churchId: z.string() }), method: "POST", use: [sessionMiddleware] },
        async (ctx) => {
          const session = ctx.context.session;
          const { churchId } = ctx.body;
          const [ownership] = await db
            .select({ role: member.role })
            .from(member)
            .where(and(eq(member.organizationId, churchId), eq(member.userId, session.user.id)))
            .limit(1);
          if (ownership?.role !== "owner") {
            throw ctx.error("FORBIDDEN", {
              message: "Only a Church owner can restore this Church",
            });
          }

          await db
            .update(organization)
            .set({ deletedAt: null, deletedBy: null })
            .where(eq(organization.id, churchId));
          return ctx.json({ status: true });
        },
      ),
    },
    id: "church-lifecycle",
  }) satisfies BetterAuthPlugin;

export const completeOnboarding = () =>
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

          if (session.session.activeOrganizationId !== orgId) {
            throw ctx.error("BAD_REQUEST", { message: "Church ID does not match active Church" });
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
            throw ctx.error("INTERNAL_SERVER_ERROR", { message: "Failed to update session" });
          }

          await setSessionCookie(ctx, { session: updatedSession, user: session.user });

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
              orgCompletedOnboarding: null,
              orgRole: null,
              orgType: null,
              skipOrgFallback: true,
            },
          );

          if (!updatedSession) {
            throw ctx.error("INTERNAL_SERVER_ERROR", { message: "Failed to update session" });
          }

          await setSessionCookie(ctx, { session: updatedSession, user: session.user });

          return ctx.json({ status: true });
        },
      ),
    },
    id: "clear-org-for-onboarding",
  }) satisfies BetterAuthPlugin;
