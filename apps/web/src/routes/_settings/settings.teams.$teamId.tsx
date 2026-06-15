import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_settings/settings/teams/$teamId")({
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
