import { createFileRoute } from "@tanstack/react-router";

import { MainContainer } from "@/components/pageComponents";
import { UsersCollection } from "@/features/users/usersCollection";
import { InternalAccessGate } from "@/routes/-internal-admin";

export const Route = createFileRoute("/_org/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  return (
    <InternalAccessGate>
      <MainContainer>
        <UsersCollection _tag="global" />
      </MainContainer>
    </InternalAccessGate>
  );
}
