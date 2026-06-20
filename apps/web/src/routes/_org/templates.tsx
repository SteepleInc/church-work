import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";

import { MainContainer, PageContainer } from "@/components/pageComponents";
import { TemplateAuthoring } from "@/features/templates/template-authoring";

export const Route = createFileRoute("/_org/templates")({
  component: RouteComponent,
});

function RouteComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname !== "/templates") return <Outlet />;

  return (
    <MainContainer>
      <PageContainer wrapperClassName="mx-auto w-full max-w-3xl pb-16">
        <TemplateAuthoring />
      </PageContainer>
    </MainContainer>
  );
}
