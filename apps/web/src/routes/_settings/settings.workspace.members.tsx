import { createFileRoute } from "@tanstack/react-router";

import {
  SettingsPage,
  SettingsPageHeader,
  SettingsSection,
} from "@/features/settings/settings-page";
import { TeamInvitationsSettingsPanel, TeamMembersSettingsPanel } from "@/routes/-dashboard";

export const Route = createFileRoute("/_settings/settings/workspace/members")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <SettingsPage>
      <SettingsPageHeader
        description="Manage Church members, Teams, and invitations."
        title="Members"
      />
      <SettingsSection>
        <TeamMembersSettingsPanel />
      </SettingsSection>
      <SettingsSection title="Invitations">
        <TeamInvitationsSettingsPanel />
      </SettingsSection>
    </SettingsPage>
  );
}
