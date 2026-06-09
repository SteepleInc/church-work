import { authComponent } from "../authCore";
import { assertAppAdministratorUser } from "../adminAccess";
import {
  listBetterAuthModel,
  listQueryArgsValidator,
  type FilterItem,
  type ListArgs,
} from "./listQueryHelpers";
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

type BetterAuthUser = {
  readonly _id: string;
  readonly name: string;
  readonly email: string;
  readonly image?: string | null;
  readonly createdAt: number;
};

type BetterAuthMember = {
  readonly _id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly role: string;
  readonly createdAt: number;
};

type BetterAuthCountable = {
  readonly _id: string;
  readonly organizationId: string;
};

type UserChurch = {
  readonly id: string;
  readonly name: string;
  readonly slug: string | null;
  readonly role: string;
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

type UpdateUserInput = {
  readonly name: string;
  readonly email: string;
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

async function countBetterAuthModelByOrganizations(
  ctx: Parameters<typeof listBetterAuthModel>[0],
  model: "member" | "team",
  organizationIds: readonly string[],
) {
  const counts = new Map(organizationIds.map((organizationId) => [organizationId, 0]));

  if (organizationIds.length === 0) {
    return counts;
  }

  let cursor: string | null = null;

  do {
    const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model,
      where: [{ field: "organizationId", operator: "in", value: [...organizationIds] }],
      paginationOpts: { cursor, numItems: 1000 },
      select: ["_id", "organizationId"],
    })) as {
      readonly page: ReadonlyArray<BetterAuthCountable>;
      readonly isDone: boolean;
      readonly continueCursor: string;
    };

    for (const item of result.page) {
      counts.set(item.organizationId, (counts.get(item.organizationId) ?? 0) + 1);
    }

    cursor = result.isDone ? null : result.continueCursor;
  } while (cursor !== null);

  return counts;
}

async function listBetterAuthMembersByUser(
  ctx: Parameters<typeof listBetterAuthModel>[0],
  userId: string,
) {
  const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: "member",
    where: [{ field: "userId", value: userId }],
    paginationOpts: { cursor: null, numItems: 1000 },
    select: ["_id", "organizationId", "userId", "role", "createdAt"],
  })) as { readonly page: ReadonlyArray<BetterAuthMember> };

  return result.page;
}

async function listBetterAuthMembersByUsers(
  ctx: Parameters<typeof listBetterAuthModel>[0],
  userIds: readonly string[],
) {
  if (userIds.length === 0) {
    return [];
  }

  let cursor: string | null = null;
  const members: BetterAuthMember[] = [];

  do {
    const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "member",
      where: [{ field: "userId", operator: "in", value: [...userIds] }],
      paginationOpts: { cursor, numItems: 1000 },
      select: ["_id", "organizationId", "userId", "role", "createdAt"],
    })) as {
      readonly page: ReadonlyArray<BetterAuthMember>;
      readonly isDone: boolean;
      readonly continueCursor: string;
    };

    members.push(...result.page);
    cursor = result.isDone ? null : result.continueCursor;
  } while (cursor !== null);

  return members;
}

async function listBetterAuthOrganizationsByIds(
  ctx: Parameters<typeof listBetterAuthModel>[0],
  organizationIds: readonly string[],
) {
  if (organizationIds.length === 0) {
    return new Map<string, Pick<BetterAuthOrganization, "_id" | "name" | "slug">>();
  }

  const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: "organization",
    where: [{ field: "_id", operator: "in", value: [...organizationIds] }],
    paginationOpts: { cursor: null, numItems: 1000 },
    select: ["_id", "name", "slug"],
  })) as {
    readonly page: ReadonlyArray<Pick<BetterAuthOrganization, "_id" | "name" | "slug">>;
  };

  return new Map(result.page.map((organization) => [organization._id, organization]));
}

async function listChurchesByUsers(
  ctx: Parameters<typeof listBetterAuthModel>[0],
  userIds: readonly string[],
) {
  const members = await listBetterAuthMembersByUsers(ctx, userIds);
  const organizationIds = Array.from(new Set(members.map((member) => member.organizationId)));
  const organizations = await listBetterAuthOrganizationsByIds(ctx, organizationIds);
  const churchesByUser = new Map<string, UserChurch[]>();

  for (const userId of userIds) {
    churchesByUser.set(userId, []);
  }

  for (const member of members) {
    const organization = organizations.get(member.organizationId);

    churchesByUser.get(member.userId)?.push({
      id: member.organizationId,
      name: organization?.name ?? member.organizationId,
      slug: organization?.slug ?? null,
      role: member.role,
    });
  }

  return churchesByUser;
}

async function listUserIdsForChurchFilter(
  ctx: Parameters<typeof listBetterAuthModel>[0],
  organizationIds: ReadonlyArray<string>,
) {
  if (organizationIds.length === 0) {
    return undefined;
  }

  const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: "member",
    where: [{ field: "organizationId", operator: "in", value: [...organizationIds] }],
    paginationOpts: { cursor: null, numItems: 1000 },
    select: ["userId"],
  })) as { readonly page: ReadonlyArray<Pick<BetterAuthMember, "userId">> };

  return Array.from(new Set(result.page.map((member) => member.userId)));
}

async function getUserChurches(
  ctx: Parameters<typeof listBetterAuthModel>[0],
  userId: string,
): Promise<readonly UserChurch[]> {
  const members = await listBetterAuthMembersByUser(ctx, userId);

  return await Promise.all(
    members.map(async (member) => {
      const orgResult = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: "organization",
        where: [{ field: "_id", value: member.organizationId }],
        paginationOpts: { cursor: null, numItems: 1 },
        select: ["_id", "name", "slug"],
      })) as {
        readonly page: ReadonlyArray<Pick<BetterAuthOrganization, "_id" | "name" | "slug">>;
      };
      const organization = orgResult.page[0];

      return {
        id: member.organizationId,
        name: organization?.name ?? member.organizationId,
        slug: organization?.slug ?? null,
        role: member.role,
      };
    }),
  );
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

export function buildAdminUserCollectionItem(
  user: BetterAuthUser,
  churches: readonly UserChurch[],
) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    createdAt: user.createdAt,
    churches,
  };
}

function splitUserChurchFilters(listArgs: ListArgs) {
  const churchesFilters = (listArgs.filters ?? []).filter(
    (filter): filter is Extract<FilterItem, { type: "multiOption" }> =>
      filter.type === "multiOption" && filter.columnId === "churches",
  );
  const passthroughFilters = (listArgs.filters ?? []).filter(
    (filter) => !(filter.type === "multiOption" && filter.columnId === "churches"),
  );
  const selectedChurchIds = churchesFilters.flatMap((filter) => [...filter.values]);

  return {
    selectedChurchIds,
    listArgs: { ...listArgs, filters: passthroughFilters },
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

export function buildAdminUserUpdate(input: UpdateUserInput) {
  return {
    name: input.name,
    email: input.email,
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

    const organizationIds = page.page.map((organization) => organization._id);
    const [membersCounts, teamsCounts] = await Promise.all([
      countBetterAuthModelByOrganizations(ctx, "member", organizationIds),
      countBetterAuthModelByOrganizations(ctx, "team", organizationIds),
    ]);

    return {
      ...page,
      page: page.page.map((organization) =>
        buildAdminOrgCollectionItem(organization, {
          membersCount: membersCounts.get(organization._id) ?? 0,
          teamsCount: teamsCounts.get(organization._id) ?? 0,
        }),
      ),
    };
  },
});

export const listAllOrgOptions = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);

    assertAppAdministratorUser(authUser);

    const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "organization",
      paginationOpts: { cursor: null, numItems: 1000 },
      select: ["_id", "name"],
      sortBy: { field: "name", direction: "asc" },
    })) as { readonly page: ReadonlyArray<Pick<BetterAuthOrganization, "_id" | "name">> };

    return result.page.map((organization) => ({
      label: organization.name,
      value: organization._id,
    }));
  },
});

export const getUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);

    assertAppAdministratorUser(authUser);

    const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "user",
      where: [{ field: "_id", value: args.userId }],
      paginationOpts: { cursor: null, numItems: 1 },
      select: ["_id", "name", "email", "image", "createdAt"],
    })) as { readonly page: ReadonlyArray<BetterAuthUser> };
    const user = result.page[0];

    if (!user) {
      return null;
    }

    return buildAdminUserCollectionItem(user, await getUserChurches(ctx, user._id));
  },
});

export const listAllUsers = query({
  args: listQueryArgsValidator,
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);

    assertAppAdministratorUser(authUser);

    const userListArgs = splitUserChurchFilters(args.listArgs);
    const filteredUserIds = await listUserIdsForChurchFilter(ctx, userListArgs.selectedChurchIds);
    const selectedIds = filteredUserIds
      ? userListArgs.listArgs.selectedIds
        ? userListArgs.listArgs.selectedIds.filter((userId) => filteredUserIds.includes(userId))
        : filteredUserIds
      : userListArgs.listArgs.selectedIds;
    const normalizedSelectedIds =
      selectedIds && selectedIds.length > 0
        ? selectedIds
        : filteredUserIds
          ? ["__no_users__"]
          : undefined;
    const page = await listBetterAuthModel<BetterAuthUser>(ctx, {
      model: "user",
      listArgs: {
        ...userListArgs.listArgs,
        selectedIds: normalizedSelectedIds,
      },
      paginationOpts: args.paginationOpts,
      select: ["_id", "name", "email", "image", "createdAt"],
    });

    const userIds = page.page.map((user) => user._id);
    const churchesByUser = await listChurchesByUsers(ctx, userIds);

    return {
      ...page,
      page: page.page.map((user) =>
        buildAdminUserCollectionItem(user, churchesByUser.get(user._id) ?? []),
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

export const updateUser = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);

    assertAppAdministratorUser(authUser);

    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "user",
        where: [{ field: "_id", value: args.userId }],
        update: buildAdminUserUpdate(args),
      },
    });

    return { ok: true };
  },
});
