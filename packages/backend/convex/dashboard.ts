import { v } from "convex/values";

import { authComponent } from "../authCore";
import { components } from "./_generated/api";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";

type BetterAuthSession = {
  readonly activeOrganizationId?: string | null;
};

type BetterAuthOrganization = {
  readonly _id: string;
  readonly name: string;
  readonly slug?: string | null;
  readonly churchTimeZone?: string | null;
  readonly completedOnboarding?: boolean | null;
  readonly url?: string | null;
  readonly street?: string | null;
  readonly city?: string | null;
  readonly state?: string | null;
  readonly zip?: string | null;
  readonly countryCode?: string | null;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly size?: string | null;
};

type BetterAuthMember = {
  readonly _id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly role: string;
};

type BetterAuthUser = {
  readonly _id: string;
  readonly name?: string | null;
  readonly email?: string | null;
};

type BetterAuthInvitation = {
  readonly _id: string;
  readonly organizationId: string;
  readonly email: string;
  readonly role?: string | null;
  readonly status: string;
};

type BetterAuthWhere = {
  readonly field: string;
  readonly operator?: "eq" | "gt";
  readonly value: string | number | boolean | Array<string> | Array<number> | null;
};

async function findOne<T>(
  ctx: QueryCtx,
  args: {
    readonly model: "member" | "organization" | "session" | "user" | "invitation";
    readonly where: Array<BetterAuthWhere>;
  },
) {
  return (await ctx.runQuery(components.betterAuth.adapter.findOne, args)) as T | null;
}

async function findMany<T>(
  ctx: QueryCtx,
  args: {
    readonly model: "member" | "organization" | "session" | "user" | "invitation";
    readonly where: Array<BetterAuthWhere>;
  },
) {
  const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
    ...args,
    paginationOpts: { cursor: null, numItems: 100 },
  })) as { readonly page: ReadonlyArray<T> };

  return result.page;
}

async function getAuthUser(ctx: QueryCtx) {
  return await authComponent.safeGetAuthUser(ctx);
}

async function getActiveChurchId(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity?.sessionId) {
    return null;
  }

  const session = await findOne<BetterAuthSession>(ctx, {
    model: "session",
    where: [
      { field: "_id", value: String(identity.sessionId) },
      { field: "expiresAt", operator: "gt", value: Date.now() },
    ],
  });

  return session?.activeOrganizationId ?? null;
}

export const listUserInvitations = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await getAuthUser(ctx);

    if (!authUser?.email) {
      return [];
    }

    const invitations = await findMany<BetterAuthInvitation>(ctx, {
      model: "invitation",
      where: [
        { field: "email", value: authUser.email },
        { field: "status", value: "pending" },
      ],
    });

    return await Promise.all(
      invitations.map(async (invitation) => {
        const organization = await findOne<BetterAuthOrganization>(ctx, {
          model: "organization",
          where: [{ field: "_id", value: invitation.organizationId }],
        });

        return {
          id: invitation._id,
          email: invitation.email,
          role: invitation.role ?? "member",
          status: invitation.status,
          organizationName: organization?.name ?? "Unknown Church",
        };
      }),
    );
  },
});

export const listOrganizations = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await getAuthUser(ctx);

    if (!authUser) {
      return [];
    }

    const memberships = await findMany<BetterAuthMember>(ctx, {
      model: "member",
      where: [{ field: "userId", value: authUser._id }],
    });

    return await Promise.all(
      memberships.map(async (membership) => {
        const organization = await findOne<BetterAuthOrganization>(ctx, {
          model: "organization",
          where: [{ field: "_id", value: membership.organizationId }],
        });

        return organization
          ? {
              id: organization._id,
              name: organization.name,
              slug: organization.slug ?? null,
              churchTimeZone: organization.churchTimeZone ?? null,
              completedOnboarding: organization.completedOnboarding ?? true,
            }
          : null;
      }),
    ).then((organizations) => organizations.filter((organization) => organization !== null));
  },
});

export const getActiveOrganization = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await getAuthUser(ctx);
    const activeOrganizationId = await getActiveChurchId(ctx);

    if (!authUser || !activeOrganizationId) {
      return null;
    }

    const membership = await findOne<BetterAuthMember>(ctx, {
      model: "member",
      where: [
        { field: "organizationId", value: activeOrganizationId },
        { field: "userId", value: authUser._id },
      ],
    });

    if (!membership) {
      return null;
    }

    const organization = await findOne<BetterAuthOrganization>(ctx, {
      model: "organization",
      where: [{ field: "_id", value: activeOrganizationId }],
    });

    if (!organization) {
      return null;
    }

    const invitations = await findMany<BetterAuthInvitation>(ctx, {
      model: "invitation",
      where: [{ field: "organizationId", value: activeOrganizationId }],
    });

    return {
      id: organization._id,
      name: organization.name,
      slug: organization.slug ?? null,
      churchTimeZone: organization.churchTimeZone ?? null,
      completedOnboarding: organization.completedOnboarding ?? true,
      url: organization.url ?? null,
      street: organization.street ?? null,
      city: organization.city ?? null,
      state: organization.state ?? null,
      zip: organization.zip ?? null,
      countryCode: organization.countryCode ?? null,
      latitude: organization.latitude ?? null,
      longitude: organization.longitude ?? null,
      size: organization.size ?? null,
      role: membership.role,
      currentUserId: membership.userId,
      invitations: invitations.map((invitation) => ({
        id: invitation._id,
        email: invitation.email,
        role: invitation.role ?? "member",
        status: invitation.status,
      })),
    };
  },
});

export const listMembers = query({
  args: { organizationId: v.string() },
  handler: async (ctx, args) => {
    const authUser = await getAuthUser(ctx);

    if (!authUser) {
      return [];
    }

    const currentMembership = await findOne<BetterAuthMember>(ctx, {
      model: "member",
      where: [
        { field: "organizationId", value: args.organizationId },
        { field: "userId", value: authUser._id },
      ],
    });

    if (!currentMembership) {
      return [];
    }

    const members = await findMany<BetterAuthMember>(ctx, {
      model: "member",
      where: [{ field: "organizationId", value: args.organizationId }],
    });

    return await Promise.all(
      members.map(async (member) => {
        const user = await findOne<BetterAuthUser>(ctx, {
          model: "user",
          where: [{ field: "_id", value: member.userId }],
        });

        return {
          id: member._id,
          role: member.role,
          user: {
            id: member.userId,
            name: user?.name ?? null,
            email: user?.email ?? null,
          },
        };
      }),
    );
  },
});
