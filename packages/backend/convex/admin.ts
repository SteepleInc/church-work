import { authComponent } from "../authCore";
import { assertAppAdministratorUser } from "../adminAccess";
import { listBetterAuthModel, listQueryArgsValidator } from "./listQueryHelpers";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

type BetterAuthOrganization = {
  readonly _id: string;
  readonly name: string;
  readonly slug?: string | null;
  readonly logo?: string | null;
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
  readonly createdAt: number;
};

type BetterAuthCountable = {
  readonly _id: string;
};

type UpdateOrgInput = {
  readonly name: string;
  readonly slug?: string | null;
  readonly churchTimeZone: string;
  readonly completedOnboarding: boolean;
  readonly url?: string | null;
  readonly street?: string | null;
  readonly city?: string | null;
  readonly state?: string | null;
  readonly zip?: string | null;
  readonly countryCode?: string | null;
  readonly size?: string | null;
};

async function countBetterAuthModelByOrganization(
  ctx: Parameters<typeof listBetterAuthModel>[0],
  model: "member" | "team",
  organizationId: string,
) {
  let cursor: string | null = null;
  let count = 0;

  do {
    const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model,
      where: [{ field: "organizationId", value: organizationId }],
      paginationOpts: { cursor, numItems: 1000 },
      select: ["_id"],
    })) as {
      readonly page: ReadonlyArray<BetterAuthCountable>;
      readonly isDone: boolean;
      readonly continueCursor: string;
    };

    count += result.page.length;
    cursor = result.isDone ? null : result.continueCursor;
  } while (cursor !== null);

  return count;
}

export function buildAdminOrgCollectionItem(
  organization: BetterAuthOrganization,
  counts: { readonly membersCount: number; readonly teamsCount: number },
) {
  return {
    id: organization._id,
    name: organization.name,
    slug: organization.slug ?? null,
    logo: organization.logo ?? null,
    churchTimeZone: organization.churchTimeZone ?? null,
    completedOnboarding: organization.completedOnboarding ?? false,
    url: organization.url ?? null,
    street: organization.street ?? null,
    city: organization.city ?? null,
    state: organization.state ?? null,
    zip: organization.zip ?? null,
    countryCode: organization.countryCode ?? null,
    latitude: organization.latitude ?? null,
    longitude: organization.longitude ?? null,
    size: organization.size ?? null,
    membersCount: counts.membersCount,
    teamsCount: counts.teamsCount,
    createdAt: organization.createdAt,
  };
}

export function buildAdminOrgUpdate(input: UpdateOrgInput) {
  return {
    name: input.name,
    slug: input.slug ?? null,
    churchTimeZone: input.churchTimeZone,
    completedOnboarding: input.completedOnboarding,
    url: input.url ?? null,
    street: input.street ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    zip: input.zip ?? null,
    countryCode: input.countryCode ?? null,
    size: input.size ?? null,
  };
}

export const assertAppAdministrator = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);

    assertAppAdministratorUser(authUser);

    return { ok: true };
  },
});

export const getOrg = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);

    assertAppAdministratorUser(authUser);

    const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "organization",
      where: [{ field: "_id", value: args.orgId }],
      paginationOpts: { cursor: null, numItems: 1 },
      select: [
        "_id",
        "name",
        "slug",
        "logo",
        "churchTimeZone",
        "completedOnboarding",
        "url",
        "street",
        "city",
        "state",
        "zip",
        "countryCode",
        "latitude",
        "longitude",
        "size",
        "createdAt",
      ],
    })) as { readonly page: ReadonlyArray<BetterAuthOrganization> };

    const organization = result.page[0];

    if (!organization) {
      return null;
    }

    return buildAdminOrgCollectionItem(organization, {
      membersCount: await countBetterAuthModelByOrganization(ctx, "member", organization._id),
      teamsCount: await countBetterAuthModelByOrganization(ctx, "team", organization._id),
    });
  },
});

export const listAllOrgs = query({
  args: listQueryArgsValidator,
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);

    assertAppAdministratorUser(authUser);

    const page = await listBetterAuthModel<BetterAuthOrganization>(ctx, {
      model: "organization",
      listArgs: args.listArgs,
      paginationOpts: args.paginationOpts,
      select: [
        "_id",
        "name",
        "slug",
        "logo",
        "churchTimeZone",
        "completedOnboarding",
        "url",
        "street",
        "city",
        "state",
        "zip",
        "countryCode",
        "latitude",
        "longitude",
        "size",
        "createdAt",
      ],
    });

    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (organization) =>
          buildAdminOrgCollectionItem(organization, {
            membersCount: await countBetterAuthModelByOrganization(ctx, "member", organization._id),
            teamsCount: await countBetterAuthModelByOrganization(ctx, "team", organization._id),
          }),
        ),
      ),
    };
  },
});

export const updateOrg = mutation({
  args: {
    orgId: v.string(),
    name: v.string(),
    slug: v.union(v.string(), v.null()),
    churchTimeZone: v.string(),
    completedOnboarding: v.boolean(),
    url: v.union(v.string(), v.null()),
    street: v.union(v.string(), v.null()),
    city: v.union(v.string(), v.null()),
    state: v.union(v.string(), v.null()),
    zip: v.union(v.string(), v.null()),
    countryCode: v.union(v.string(), v.null()),
    size: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);

    assertAppAdministratorUser(authUser);

    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "organization",
        where: [{ field: "_id", value: args.orgId }],
        update: buildAdminOrgUpdate(args),
      },
    });

    return { ok: true };
  },
});
