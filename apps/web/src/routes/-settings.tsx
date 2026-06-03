import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { authClient } from "@/lib/auth-client";
import {
  ChurchSettingsPanel,
  TeamInvitationsSettingsPanel,
  TeamMembersSettingsPanel,
} from "@/routes/-dashboard";

type SettingsSection = "profile" | "church" | "members" | "invites";

export const settingsSections: readonly {
  readonly id: SettingsSection;
  readonly label: string;
  readonly description: string;
  readonly to: "/settings/profile" | "/settings/org" | "/settings/team/$teamTab";
  readonly params?: { readonly teamTab: "members" | "invites" };
}[] = [
  {
    id: "profile",
    label: "Profile",
    description: "Your user account and support details.",
    to: "/settings/profile",
  },
  {
    id: "church",
    label: "Church",
    description: "Church profile and cycle configuration.",
    to: "/settings/org",
  },
  {
    id: "members",
    label: "Members",
    description: "Church members, Teams, and Team membership.",
    params: { teamTab: "members" },
    to: "/settings/team/$teamTab",
  },
  {
    id: "invites",
    label: "Invitations",
    description: "Invite members and review pending invitations.",
    params: { teamTab: "invites" },
    to: "/settings/team/$teamTab",
  },
];

export function getSettingsSectionIds() {
  return settingsSections.map((section) => section.id);
}

export function SettingsFrame({
  activeSection,
  children,
}: {
  readonly activeSection: SettingsSection;
  readonly children: ReactNode;
}) {
  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName="p-6">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="grid gap-2">
          <p className="font-medium text-muted-foreground text-sm">Settings</p>
          <h1 className="font-semibold text-3xl tracking-tight">Settings</h1>
          <p className="max-w-2xl text-muted-foreground">
            Manage your profile, Church setup, members, and invitations.
          </p>
        </header>

        <nav aria-label="Settings sections" className="grid gap-3 md:grid-cols-4">
          {settingsSections.map((section) => (
            <Link
              activeOptions={{ exact: true }}
              className={
                section.id === activeSection
                  ? "rounded-lg border bg-card p-4 text-card-foreground shadow-sm ring-2 ring-primary"
                  : "rounded-lg border bg-card/60 p-4 text-card-foreground transition-colors hover:bg-card"
              }
              key={section.id}
              params={section.params}
              to={section.to}
            >
              <span className="font-medium">{section.label}</span>
              <span className="mt-1 block text-muted-foreground text-sm">
                {section.description}
              </span>
            </Link>
          ))}
        </nav>

        {children}
      </main>
    </ScrollArea>
  );
}

export function SettingsProfilePanel() {
  const session = authClient.useSession();
  const user = session.data?.user;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your Church Task account details.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <SettingDetail label="Name" value={user?.name ?? "Not set"} />
          <SettingDetail label="Email" value={user?.email ?? "Not set"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Technical</CardTitle>
          <CardDescription>Details you may need when contacting support.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingDetail label="User Id" value={user?.id ?? "Loading..."} />
        </CardContent>
      </Card>
    </div>
  );
}

export function SettingsChurchPanel() {
  return <ChurchSettingsPanel />;
}

export function SettingsTeamTabPanel({ teamTab }: { readonly teamTab: string }) {
  if (teamTab === "invites") {
    return <TeamInvitationsSettingsPanel />;
  }

  return <TeamMembersSettingsPanel />;
}

function SettingDetail({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="grid gap-1">
      <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">{label}</div>
      <div className="break-all">{value}</div>
    </div>
  );
}
