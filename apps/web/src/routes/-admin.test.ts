import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("admin route fidelity", () => {
  it("keeps the copied PreachX admin parent route with redirect and gated outlet", () => {
    const adminRouteSource = readFileSync(new URL("./_org/admin.tsx", import.meta.url), "utf8");

    expect(adminRouteSource).toContain('createFileRoute("/_org/admin")');
    expect(adminRouteSource).toContain('location.pathname === "/admin"');
    expect(adminRouteSource).toContain('to: "/admin/users"');
    expect(adminRouteSource).toContain("<Outlet />");
    expect(adminRouteSource).toContain("<InternalAccessGate>");
  });

  it("uses PreachX MainContainer collection pages for admin Churches and Users", () => {
    const orgsRouteSource = readFileSync(new URL("./_org/admin.orgs.tsx", import.meta.url), "utf8");
    const usersRouteSource = readFileSync(
      new URL("./_org/admin.users.tsx", import.meta.url),
      "utf8",
    );

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
    const adminNavSource = readFileSync(
      new URL("../components/navigation/adminNav.tsx", import.meta.url),
      "utf8",
    );
    const appNavigationSource = readFileSync(
      new URL("../components/navigation/app-navigation.tsx", import.meta.url),
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

  it("keeps Church Work admin collections in copied feature paths and free of excluded PreachX product surfaces", () => {
    const collectionSource = readFileSync(
      new URL("../components/collections/collection.tsx", import.meta.url),
      "utf8",
    );
    const orgsCollectionSource = readFileSync(
      new URL("../features/orgs/orgsCollection.tsx", import.meta.url),
      "utf8",
    );
    const usersCollectionSource = readFileSync(
      new URL("../features/users/usersCollection.tsx", import.meta.url),
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

  it("wires App Administration Collections to Zero-backed admin query shapes", () => {
    const orgsDataSource = readFileSync(
      new URL("../data/orgs/orgsData.app.ts", import.meta.url),
      "utf8",
    );
    const usersDataSource = readFileSync(
      new URL("../data/users/usersData.app.tsx", import.meta.url),
      "utf8",
    );

    expect(orgsDataSource).toContain("queries.organization.admin_list({ list_args: listArgs })");
    expect(orgsDataSource).toContain("queries.member.admin_all()");
    expect(orgsDataSource).toContain("queries.teams_admin.admin_all()");
    expect(usersDataSource).toContain("queries.user.admin_list({ list_args: listArgs })");
    expect(usersDataSource).toContain("queries.member.admin_all()");
    expect(usersDataSource).toContain(
      "queries.organization.admin_list({ list_args: { limit: 500 } })",
    );
    expect(`${orgsDataSource}\n${usersDataSource}`).not.toContain("listAllOrgs");
    expect(`${orgsDataSource}\n${usersDataSource}`).not.toContain("listAllUsers");
  });
});
