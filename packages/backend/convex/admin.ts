import { authComponent } from "../authCore";
import { assertAppAdministratorUser } from "../adminAccess";
import { listBetterAuthModel, listQueryArgsValidator } from "./listQueryHelpers";
import { query } from "./_generated/server";

type BetterAuthOrganization = {
  readonly _id: string;
  readonly name: string;
  readonly slug?: string | null;
  readonly logo?: string | null;
  readonly churchTimeZone?: string | null;
  readonly completedOnboarding?: boolean | null;
  readonly createdAt: number;
};

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
      select: ["_id", "name", "slug", "logo", "churchTimeZone", "completedOnboarding", "createdAt"],
    });

    return {
      ...page,
      page: page.page.map((organization) => ({
        id: organization._id,
        name: organization.name,
        slug: organization.slug ?? null,
        logo: organization.logo ?? null,
        churchTimeZone: organization.churchTimeZone ?? null,
        completedOnboarding: organization.completedOnboarding ?? false,
        createdAt: organization.createdAt,
      })),
    };
  },
});
