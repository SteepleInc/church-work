import { createFileRoute } from "@tanstack/react-router";

import { TemplatesPage } from "@/features/templates/template-library";

export const Route = createFileRoute("/_org/templates/key-dates")({
  component: RouteComponent,
});

function RouteComponent() {
  return <TemplatesPage tab="key-dates" />;
}
