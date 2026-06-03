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
    expect(usersRouteSource).toContain("<MainContainer>");
    expect(usersRouteSource).toContain('<UsersCollection _tag="global" />');
    expect(orgsRouteSource).not.toContain("AppAdminChurchesPanel");
    expect(usersRouteSource).not.toContain("AppAdminUsersPanel");
  });

  it("keeps Church Task admin collections free of excluded PreachX product surfaces", () => {
    const collectionsSource = readFileSync(
      "apps/web/src/features/admin/admin-collections.tsx",
      "utf8",
    );

    expect(collectionsSource).toContain("export function OrgsCollection");
    expect(collectionsSource).toContain("export function UsersCollection");
    expect(collectionsSource).toContain("placeholder={filterPlaceholder}");
    expect(collectionsSource).toContain("<Table>");
    expect(collectionsSource).not.toMatch(/preacher|sermon|video|channel|agreement|royalty/i);
  });
});
