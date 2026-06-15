import { createFileRoute, retainSearchParams } from "@tanstack/react-router";

import { SettingsShell } from "@/features/settings/settings-shell";
import { validateDashboardSearch } from "@/routes/-dashboard-utils";
import { FilterKeys } from "@/shared/global-state";

export const Route = createFileRoute("/_settings")({
  component: SettingsShell,
  search: {
    middlewares: [retainSearchParams(["details-pane", FilterKeys.Orgs, FilterKeys.Users])],
  },
  validateSearch: validateDashboardSearch,
});
