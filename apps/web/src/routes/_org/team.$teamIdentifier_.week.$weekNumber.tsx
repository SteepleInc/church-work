import { createFileRoute, retainSearchParams } from "@tanstack/react-router";
import { Schema } from "effect";

import { ChurchWorkSearchSchema } from "@/components/tasks/task-view-options";
import { DashboardPage } from "@/routes/-dashboard";

export const Route = createFileRoute("/_org/team/$teamIdentifier_/week/$weekNumber")({
  validateSearch: Schema.toStandardSchemaV1(ChurchWorkSearchSchema),
  search: {
    middlewares: [retainSearchParams(["tab", "view", "insights", "progress"])],
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { teamIdentifier, weekNumber } = Route.useParams();
  const parsedWeekNumber = Number.parseInt(weekNumber, 10);

  return (
    <DashboardPage
      activePanel={{
        kind: "team",
        teamIdentifier,
        weekNumber: Number.isNaN(parsedWeekNumber) ? null : parsedWeekNumber,
      }}
    />
  );
}
