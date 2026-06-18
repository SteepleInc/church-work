import { createFileRoute, retainSearchParams } from "@tanstack/react-router";
import { Schema } from "effect";

import { ChurchWorkSearchSchema } from "@/components/tasks/task-view-options";
import { DashboardPage } from "@/routes/-dashboard";

export const Route = createFileRoute("/_org/team/$teamIdentifier_/weeks")({
  validateSearch: Schema.toStandardSchemaV1(ChurchWorkSearchSchema),
  search: {
    middlewares: [retainSearchParams(["tab", "view", "insights", "progress"])],
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { teamIdentifier } = Route.useParams();

  return <DashboardPage activePanel={{ kind: "team_weeks", teamIdentifier }} />;
}
