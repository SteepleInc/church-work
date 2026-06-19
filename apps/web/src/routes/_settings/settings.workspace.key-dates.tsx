import { createFileRoute } from "@tanstack/react-router";

import { SettingsKeyDatesPanel } from "@/features/settings/key-date-settings";
import { SettingsPage } from "@/features/settings/settings-page";

export const Route = createFileRoute("/_settings/settings/workspace/key-dates")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <SettingsPage contentClassName="mx-0 max-w-none">
      <SettingsKeyDatesPanel />
    </SettingsPage>
  );
}
