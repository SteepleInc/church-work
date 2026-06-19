import { createFileRoute } from "@tanstack/react-router";

import { TemplateDetailPage } from "@/features/templates/template-library";

export const Route = createFileRoute("/_org/templates/$templateId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { templateId } = Route.useParams();
  return <TemplateDetailPage templateId={templateId} />;
}
