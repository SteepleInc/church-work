import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { MainContainer } from "@/components/pageComponents";
import { TeamTabs } from "@/features/users/team-tabs";

export const Route = createFileRoute("/_org/settings/team")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/settings/team") {
      throw redirect({
        params: { teamTab: "members" },
        replace: true,
        to: "/settings/team/$teamTab",
      });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <MainContainer>
      <TeamTabs basePath="/settings/team" />
      <Outlet />
    </MainContainer>
  );
}
