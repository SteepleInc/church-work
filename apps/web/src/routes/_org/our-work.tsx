import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "@/routes/-dashboard";
import { validateDashboardSearch } from "@/routes/-dashboard-utils";

export const Route = createFileRoute("/_org/our-work")({
  validateSearch: validateDashboardSearch,
  component: RouteComponent,
});

function RouteComponent() {
  return <DashboardPage activePanel="our_work" />;
}
