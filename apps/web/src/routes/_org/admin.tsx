import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { InternalAccessGate } from "@/routes/-internal-admin";

export const Route = createFileRoute("/_org/admin")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/admin") {
      throw redirect({ replace: true, to: "/admin/users" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <InternalAccessGate>
      <Outlet />
    </InternalAccessGate>
  );
}
