import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";

import { TemplatesPage } from "@/features/templates/template-library";

export const Route = createFileRoute("/_org/templates")({
  component: RouteComponent,
});

function RouteComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname !== "/templates") return <Outlet />;

  return <TemplatesPage tab="schedules" />;
}
