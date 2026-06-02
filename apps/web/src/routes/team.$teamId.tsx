import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage, validateDashboardSearch } from "@/routes/-dashboard";

export const Route = createFileRoute("/team/$teamId")({
  validateSearch: validateDashboardSearch,
  component: RouteComponent,
});

function RouteComponent() {
  const { teamId } = Route.useParams();

  return <DashboardPage activePanel={{ kind: "team", teamId }} />;
}
