import { Outlet } from "@tanstack/react-router";

import { useAuthGuard } from "@/hooks/useAuthGuard";
import { PastDueBanner } from "@/features/billing/past-due-banner";
import { SettingsSidebar } from "@/features/settings/settings-sidebar";

/**
 * Full-screen settings takeover (Linear-style). Replaces the app shell with a
 * dedicated settings sidebar plus a content pane. Like the app shell it is an
 * Optimistic Shell (ADR 0010): chrome renders immediately and useAuthGuard
 * redirects after the fact when auth/onboarding are missing.
 */
export function SettingsShell() {
  useAuthGuard({ requireAuth: true, requireOnboarding: true });

  return (
    <div className="flex h-svh w-full overflow-hidden bg-sidebar">
      <SettingsSidebar />
      <main className="flex flex-1 flex-col overflow-hidden p-2 pl-0">
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          <PastDueBanner />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
