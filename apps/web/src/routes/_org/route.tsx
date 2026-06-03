import { AppShell } from "@/components/app-shell";
import { createFileRoute, retainSearchParams } from "@tanstack/react-router";
import { validateDashboardSearch } from "@/routes/-dashboard";

export const Route = createFileRoute("/_org")({
  component: AppShell,
  search: {
    middlewares: [retainSearchParams(["details-pane"])],
  },
  validateSearch: validateDashboardSearch,
});
