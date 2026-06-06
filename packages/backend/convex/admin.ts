import { authComponent } from "../authCore";
import { assertAppAdministratorUser } from "../adminAccess";
import { listBetterAuthModel, listQueryArgsValidator } from "./listQueryHelpers";
import { components } from "./_generated/api";
import { query } from "./_generated/server";

type BetterAuthOrganization = {
  readonly _id: string;
  readonly name: string;
  readonly slug?: string | null;
  readonly logo?: string | null;
  readonly churchTimeZone?: string | null;
  readonly completedOnboarding?: boolean | null;
  readonly url?: string | null;
  readonly city?: string | null;
  readonly state?: string | null;
  readonly countryCode?: string | null;
  readonly size?: string | null;
  readonly createdAt: number;
};

type BetterAuthCountable = {
  readonly _id: string;
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
    city: organization.city ?? null,
    state: organization.state ?? null,
    countryCode: organization.countryCode ?? null,
    size: organization.size ?? null,
    membersCount: counts.membersCount,
    teamsCount: counts.teamsCount,
    createdAt: organization.createdAt,
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
        "city",
        "state",
        "countryCode",
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
