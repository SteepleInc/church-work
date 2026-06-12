import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { ChurchWorkSearchSchema } from "@/components/tasks/task-view-options";
import { DashboardPage } from "@/routes/-dashboard";

export const Route = createFileRoute("/_org/our-work")({
  validateSearch: Schema.standardSchemaV1(ChurchWorkSearchSchema),
  component: RouteComponent,
});

function RouteComponent() {
  return <DashboardPage activePanel="our_work" />;
}
