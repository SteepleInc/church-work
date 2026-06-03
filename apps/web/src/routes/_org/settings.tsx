import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_org/settings")({
  component: RouteComponent,
});

function RouteComponent() {
  return <Navigate replace to="/settings/profile" />;
}
