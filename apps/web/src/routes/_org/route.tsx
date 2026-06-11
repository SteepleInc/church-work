import { AppShell } from "@/components/app-shell";
import { createFileRoute, retainSearchParams } from "@tanstack/react-router";
import { validateDashboardSearch } from "@/routes/-dashboard-utils";
import { FilterKeys } from "@/shared/global-state";

export const Route = createFileRoute("/_org")({
  component: AppShell,
  search: {
    middlewares: [retainSearchParams(["details-pane", FilterKeys.Orgs, FilterKeys.Users])],
  },
  validateSearch: validateDashboardSearch,
});
