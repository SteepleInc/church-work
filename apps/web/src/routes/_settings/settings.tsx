import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_settings/settings")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/settings") {
      throw redirect({ replace: true, to: "/settings/account/profile" });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
