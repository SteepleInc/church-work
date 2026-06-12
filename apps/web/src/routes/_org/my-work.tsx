import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { MyWorkSearchSchema } from "@/components/tasks/task-view-options";
import { DashboardPage } from "@/routes/-dashboard";

export const Route = createFileRoute("/_org/my-work")({
  validateSearch: Schema.standardSchemaV1(MyWorkSearchSchema),
  component: RouteComponent,
});

function RouteComponent() {
  return <DashboardPage activePanel="my_work" />;
}
