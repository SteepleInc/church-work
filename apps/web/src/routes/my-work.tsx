import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage, validateDashboardSearch } from "@/routes/-dashboard";

export const Route = createFileRoute("/my-work")({
  validateSearch: validateDashboardSearch,
  component: RouteComponent,
});

function RouteComponent() {
  return <DashboardPage activePanel="my_work" />;
}
