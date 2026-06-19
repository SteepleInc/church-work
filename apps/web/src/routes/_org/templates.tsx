import { createFileRoute } from "@tanstack/react-router";

import { TemplatesPage } from "@/features/templates/template-library";

export const Route = createFileRoute("/_org/templates")({
  component: RouteComponent,
});

function RouteComponent() {
  return <TemplatesPage tab="schedules" />;
}
