import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("admin route fidelity", () => {
  it("keeps the copied PreachX admin parent route with redirect and gated outlet", () => {
    const adminRouteSource = readFileSync("apps/web/src/routes/_org/admin.tsx", "utf8");

    expect(adminRouteSource).toContain('createFileRoute("/_org/admin")');
    expect(adminRouteSource).toContain('location.pathname === "/admin"');
    expect(adminRouteSource).toContain('to: "/admin/users"');
    expect(adminRouteSource).toContain("<Outlet />");
    expect(adminRouteSource).toContain("<InternalAccessGate>");
  });

  it("uses PreachX MainContainer collection pages for admin Churches and Users", () => {
    const orgsRouteSource = readFileSync("apps/web/src/routes/_org/admin.orgs.tsx", "utf8");
    const usersRouteSource = readFileSync("apps/web/src/routes/_org/admin.users.tsx", "utf8");

    expect(orgsRouteSource).toContain("<MainContainer>");
    expect(orgsRouteSource).toContain('<OrgsCollection _tag="global" />');
    expect(orgsRouteSource).toContain('from "@/features/orgs/orgsCollection"');
    expect(usersRouteSource).toContain("<MainContainer>");
    expect(usersRouteSource).toContain('<UsersCollection _tag="global" />');
    expect(usersRouteSource).toContain('from "@/features/users/usersCollection"');
    expect(orgsRouteSource).not.toContain("AppAdminChurchesPanel");
    expect(usersRouteSource).not.toContain("AppAdminUsersPanel");
  });

  it("uses copied PreachX AdminNav instead of inline app navigation admin markup", () => {
    const adminNavSource = readFileSync("apps/web/src/components/navigation/adminNav.tsx", "utf8");
    const appNavigationSource = readFileSync(
      "apps/web/src/components/navigation/app-navigation.tsx",
      "utf8",
    );

    expect(adminNavSource).toContain("export function AdminNav");
    expect(adminNavSource).toContain(
      '<SidebarGroupLabel className="gap-2">Admin</SidebarGroupLabel>',
    );
    expect(adminNavSource).toContain("adminNavItems.map");
    expect(appNavigationSource).toContain("<AdminNav />");
    expect(appNavigationSource).not.toContain("<SidebarGroupLabel>App Admin</SidebarGroupLabel>");
  });

  it("keeps Church Task admin collections in copied feature paths and free of excluded PreachX product surfaces", () => {
    const collectionSource = readFileSync(
      "apps/web/src/components/collections/collection.tsx",
      "utf8",
    );
    const orgsCollectionSource = readFileSync(
      "apps/web/src/features/orgs/orgsCollection.tsx",
      "utf8",
    );
    const usersCollectionSource = readFileSync(
      "apps/web/src/features/users/usersCollection.tsx",
      "utf8",
    );
    const combinedSource = [collectionSource, orgsCollectionSource, usersCollectionSource].join(
      "\n",
    );

    expect(orgsCollectionSource).toContain("export function OrgsCollection");
    expect(orgsCollectionSource).toContain("<Collection<OrgCollectionItem>");
    expect(usersCollectionSource).toContain("export function UsersCollection");
    expect(usersCollectionSource).toContain("<Collection<UserCollectionItem>");
    expect(collectionSource).toContain("filterPlaceHolder={filterPlaceHolder}");
    expect(collectionSource).toContain("<CollectionTableView");
    expect(combinedSource).not.toMatch(/preacher|sermon|video|channel|agreement|royalty/i);
  });
});
