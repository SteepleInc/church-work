import { useState } from "react";

import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useUserOrgsCollection } from "@/data/orgs/orgsData.app";
import { useChurchUsersCollection } from "@/data/users/usersData.app";

export function OrgsCollection({ _tag }: { readonly _tag: "global" }) {
  if (_tag !== "global") {
    return null;
  }

  return <GlobalOrgsCollection />;
}

export function UsersCollection({ _tag }: { readonly _tag: "global" }) {
  if (_tag !== "global") {
    return null;
  }

  return <GlobalUsersCollection />;
}

function GlobalOrgsCollection() {
  const { loading, orgsCollection } = useUserOrgsCollection();
  const [query, setQuery] = useState("");
  const filteredOrgs = orgsCollection.filter((org) =>
    [org.name, org.slug, org.churchTimeZone ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <AdminCollectionFrame
      filterPlaceholder="Search organizations"
      loading={loading}
      onQueryChange={setQuery}
      query={query}
    >
      {filteredOrgs.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Time Zone</TableHead>
              <TableHead>Onboarding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrgs.map((org) => (
              <TableRow aria-label={`Admin Church ${org.name}`} key={org.id}>
                <TableCell className="font-medium">{org.name}</TableCell>
                <TableCell className="text-muted-foreground">{org.slug}</TableCell>
                <TableCell className="text-muted-foreground">
                  {org.churchTimeZone ?? "Not set"}
                </TableCell>
                <TableCell>{org.completedOnboarding ? "Complete" : "Incomplete"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <AdminEmptyState title="No Churches found" />
      )}
    </AdminCollectionFrame>
  );
}

function GlobalUsersCollection() {
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const { loading, usersCollection } = useChurchUsersCollection({
    churchId: activeChurch?.id ?? null,
  });
  const [query, setQuery] = useState("");
  const filteredUsers = usersCollection.filter((user) =>
    [user.name ?? "", user.email ?? "", user.role]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <AdminCollectionFrame
      filterPlaceholder="Filter Members"
      loading={loading}
      onQueryChange={setQuery}
      query={query}
    >
      {filteredUsers.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow aria-label={`Admin User ${user.name ?? user.email}`} key={user.memberId}>
                <TableCell className="font-medium">{user.name ?? "Unnamed user"}</TableCell>
                <TableCell className="text-muted-foreground">{user.email ?? "No email"}</TableCell>
                <TableCell>{user.role}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <AdminEmptyState title="No Users found" />
      )}
    </AdminCollectionFrame>
  );
}

function AdminCollectionFrame({
  children,
  filterPlaceholder,
  loading,
  onQueryChange,
  query,
}: {
  readonly children: React.ReactNode;
  readonly filterPlaceholder: string;
  readonly loading: boolean;
  readonly onQueryChange: (query: string) => void;
  readonly query: string;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="-mt-1 mb-2 flex items-center gap-2 pt-1 md:mr-4 md:mb-4">
        <Input
          className="h-9 max-w-sm"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={filterPlaceholder}
          value={query}
        />
      </div>

      {loading ? (
        <Card className="flex min-h-48 items-center justify-center text-muted-foreground text-sm">
          Loading...
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">{children}</Card>
      )}
    </div>
  );
}

function AdminEmptyState({ title }: { readonly title: string }) {
  return (
    <Empty className="min-h-48 border-0">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>Try a different search or switch Church context.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
