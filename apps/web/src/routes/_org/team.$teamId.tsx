import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "@/routes/-dashboard";
import { validateDashboardSearch } from "@/routes/-dashboard-utils";

export const Route = createFileRoute("/_org/team/$teamId")({
  validateSearch: validateDashboardSearch,
  component: RouteComponent,
});

function RouteComponent() {
  const { teamId } = Route.useParams();

  return <DashboardPage activePanel={{ kind: "team", teamId }} />;
}
