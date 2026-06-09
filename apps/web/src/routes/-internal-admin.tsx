import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { canAccessInternalNavigation } from "@/components/navigation/internal-navigation";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useUserOrgsCollection } from "@/data/orgs/orgsData.app";
import { useTeamsCollection } from "@/data/teams/teamsData.app";
import { useIsAdmin } from "@/data/users/adminData.app";
import { useChurchUsersCollection } from "@/data/users/usersData.app";
import { authClient } from "@/lib/auth-client";

export function InternalPageFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName="p-6">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="grid gap-2">
          <p className="font-medium text-muted-foreground text-sm">{eyebrow}</p>
          <h1 className="font-semibold text-3xl tracking-tight">{title}</h1>
          <p className="max-w-2xl text-muted-foreground">{description}</p>
        </header>
        {children}
      </main>
    </ScrollArea>
  );
}

export function DevSessionPanel() {
  return (
    <InternalAccessGate>
      <DevSessionContent />
    </InternalAccessGate>
  );
}

function DevSessionContent() {
  const session = authClient.useSession();
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();

  return (
    <InternalPageFrame
      description="Inspect the currently authenticated user and active Church context."
      eyebrow="Dev"
      title="Session"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <InternalDetailsCard
          details={[
            ["User Id", session.data?.user.id ?? "Loading..."],
            ["Email", session.data?.user.email ?? "Loading..."],
            ["Name", session.data?.user.name ?? "Not set"],
          ]}
          title="User"
        />
        <InternalDetailsCard
          details={[
            ["Church Id", activeChurch?.id ?? "Loading..."],
            ["Church", activeChurch?.name ?? "Loading..."],
            ["Role", activeChurch?.role ?? "Loading..."],
          ]}
          title="Active Church"
        />
      </div>
    </InternalPageFrame>
  );
}

export function DevDataPanel() {
  return (
    <InternalAccessGate>
      <DevDataContent />
    </InternalAccessGate>
  );
}

function DevDataContent() {
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const users = useChurchUsersCollection({ churchId: activeChurch?.id ?? null });
  const teams = useTeamsCollection({ churchId: activeChurch?.id ?? null });

  return (
    <InternalPageFrame
      description="Check Convex-backed adapter collections used by the copied UI scaffolding."
      eyebrow="Dev"
      title="Data Adapters"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <InternalMetricCard label="Active Church" value={activeChurch?.name ?? "Loading..."} />
        <InternalMetricCard
          label="Users"
          value={users.loading ? "Loading..." : String(users.usersCollection.length)}
        />
        <InternalMetricCard
          label="Teams"
          value={teams.loading ? "Loading..." : String(teams.teamsCollection.length)}
        />
      </div>
    </InternalPageFrame>
  );
}

export function AppAdminChurchesPanel() {
  return (
    <InternalAccessGate>
      <AppAdminChurchesContent />
    </InternalAccessGate>
  );
}

function AppAdminChurchesContent() {
  const orgs = useUserOrgsCollection();

  return (
    <InternalPageFrame
      description="Review Churches visible to the current app-admin context."
      eyebrow="App Admin"
      title="Churches"
    >
      <Card>
        <CardHeader>
          <CardTitle>Visible Churches</CardTitle>
          <CardDescription>
            Global administration starts with Church-level support context.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {orgs.loading ? (
            <p className="text-muted-foreground">Loading Churches...</p>
          ) : orgs.orgsCollection.length > 0 ? (
            orgs.orgsCollection.map((org) => (
              <div
                aria-label={`Admin Church ${org.name}`}
                className="rounded-lg border p-3"
                key={org.id}
              >
                <div className="font-medium">{org.name}</div>
                <div className="break-all text-muted-foreground text-xs">{org.id}</div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No Churches are visible.</p>
          )}
        </CardContent>
      </Card>
    </InternalPageFrame>
  );
}

export function AppAdminUsersPanel() {
  return (
    <InternalAccessGate>
      <AppAdminUsersContent />
    </InternalAccessGate>
  );
}

function AppAdminUsersContent() {
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const users = useChurchUsersCollection({ churchId: activeChurch?.id ?? null });

  return (
    <InternalPageFrame
      description="Review users in the active Church support context."
      eyebrow="App Admin"
      title="Users"
    >
      <Card>
        <CardHeader>
          <CardTitle>Active Church Users</CardTitle>
          <CardDescription>
            Church Task user administration without PreachX product surfaces.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {users.loading ? (
            <p className="text-muted-foreground">Loading Users...</p>
          ) : users.usersCollection.length > 0 ? (
            users.usersCollection.map((user) => (
              <div
                aria-label={`Admin User ${user.name ?? user.email}`}
                className="rounded-lg border p-3"
                key={user.id}
              >
                <div className="font-medium">{user.name ?? user.email}</div>
                <div className="text-muted-foreground text-xs">{user.email}</div>
                <div className="text-muted-foreground text-xs">Role: {user.role}</div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No Users are visible.</p>
          )}
        </CardContent>
      </Card>
    </InternalPageFrame>
  );
}

export function InternalAccessGate({ children }: { readonly children: ReactNode }) {
  const session = authClient.useSession();
  const isAppAdministrator = useIsAdmin();

  if (session.isPending) {
    return (
      <InternalPageFrame
        description="Checking your App Administrator role before showing internal tools."
        eyebrow="Internal"
        title="Loading Internal Access"
      >
        <p className="text-muted-foreground text-sm">Loading...</p>
      </InternalPageFrame>
    );
  }

  if (!canAccessInternalNavigation(isAppAdministrator)) {
    return (
      <InternalPageFrame
        description="Internal dev and app-admin tools are available only to App Administrators."
        eyebrow="Internal"
        title="Access Restricted"
      >
        <Card>
          <CardHeader>
            <CardTitle>App Administrator access required</CardTitle>
            <CardDescription>
              Ask an App Administrator to update your role if you need this support surface.
            </CardDescription>
          </CardHeader>
        </Card>
      </InternalPageFrame>
    );
  }

  return children;
}

function InternalMetricCard({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function InternalDetailsCard({
  title,
  details,
}: {
  readonly title: string;
  readonly details: readonly (readonly [label: string, value: string])[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {details.map(([label, value]) => (
          <div className="grid gap-1" key={label}>
            <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              {label}
            </div>
            <div className="break-all">{value}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
