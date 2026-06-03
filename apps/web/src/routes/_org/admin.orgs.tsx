import { createFileRoute } from "@tanstack/react-router";

import { MainContainer } from "@/components/pageComponents";
import { OrgsCollection } from "@/features/admin/admin-collections";

export const Route = createFileRoute("/_org/admin/orgs")({
  component: AdminOrgsPage,
});

function AdminOrgsPage() {
  return (
    <MainContainer>
      <OrgsCollection _tag="global" />
    </MainContainer>
  );
}
