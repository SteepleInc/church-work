import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_org/settings/team")({
  component: RouteComponent,
});

function RouteComponent() {
  return <Navigate params={{ teamTab: "members" }} replace to="/settings/team/$teamTab" />;
}
