import { createFileRoute, retainSearchParams } from "@tanstack/react-router";
import { Schema } from "effect";

import { ChurchWorkSearchSchema } from "@/components/tasks/task-view-options";
import { DashboardPage } from "@/routes/-dashboard";

export const Route = createFileRoute("/_org/team/$teamId")({
  validateSearch: Schema.standardSchemaV1(ChurchWorkSearchSchema),
  search: {
    // View Tabs and View Options survive switching between Teams, but are not
    // carried across to the other task surfaces (see -dashboard-utils).
    middlewares: [retainSearchParams(["tab", "view"])],
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { teamId } = Route.useParams();

  return <DashboardPage activePanel={{ kind: "team", teamId }} />;
}
