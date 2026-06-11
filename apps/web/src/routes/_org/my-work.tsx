import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "@/routes/-dashboard";
import { validateDashboardSearch } from "@/routes/-dashboard-utils";

export const Route = createFileRoute("/_org/my-work")({
  validateSearch: validateDashboardSearch,
  component: RouteComponent,
});

function RouteComponent() {
  return <DashboardPage activePanel="my_work" />;
}
