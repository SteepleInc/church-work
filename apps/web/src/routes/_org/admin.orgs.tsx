import { createFileRoute } from "@tanstack/react-router";

import { MainContainer } from "@/components/pageComponents";
import { OrgsCollection } from "@/features/orgs/orgsCollection";
import { InternalAccessGate } from "@/routes/-internal-admin";

export const Route = createFileRoute("/_org/admin/orgs")({
  component: AdminOrgsPage,
});

function AdminOrgsPage() {
  return (
    <InternalAccessGate>
      <MainContainer>
        <OrgsCollection _tag="global" />
      </MainContainer>
    </InternalAccessGate>
  );
}
