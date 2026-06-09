import { ModeToggle } from "@/components/mode-toggle";
import { OnboardingOrgSwitcher } from "@/components/onboarding-org-switcher";
import { Button } from "@/components/ui/button";
import UserMenu from "@/components/user-menu";
import { QuickActions } from "@/features/quick-actions/quick-actions";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { ArrowRight, Church } from "lucide-react";

export const Route = createFileRoute("/_onboarding")({
  component: OnboardingLayout,
  head: () => ({
    links: [
      {
        as: "font",
        crossOrigin: "anonymous",
        href: "/fonts/pangaia/PPPangaia-Variable.woff2",
        rel: "preload",
        type: "font/woff2",
      },
    ],
  }),
});

function OnboardingLayout() {
  return (
    <>
      <Authenticated>
        <div className="flex h-[100dvh] w-full shrink-0 flex-col overflow-hidden bg-black md:flex-row dark:bg-cream">
          <aside className="flex shrink-0 flex-col md:w-[36%] md:max-w-[500px] lg:w-[40%]">
            <div className="relative flex h-full flex-col items-start overflow-hidden px-4 pt-4 text-white xs:px-6 xs:pt-6 md:p-4 lg:p-8 dark:text-black">
              <div className="flex w-full items-center justify-between md:block">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-cream text-black dark:bg-black dark:text-cream">
                    <Church className="size-5" />
                  </span>
                  Church Task
                </div>
                <div className="flex flex-row items-center gap-2 md:hidden">
                  <ModeToggle />
                  <UserMenu />
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-4 pb-2 md:mt-24 md:pb-0">
                <p className="font-serif text-5xl font-bold tracking-tight">Welcome!</p>
                <p className="hidden text-cream text-md md:block dark:text-black/70">
                  Set up your Church profile so Church Task can build work around the right local
                  time, teams, and ministry context.
                </p>
              </div>

              <div className="w-full md:hidden">
                <OnboardingOrgSwitcher className="mb-4" />
              </div>

              <div className="mt-auto hidden w-full flex-row items-center gap-2 md:flex">
                <OnboardingOrgSwitcher />
              </div>
            </div>
          </aside>

          <main className="relative flex h-full w-auto flex-col overflow-hidden bg-cream p-4 text-foreground xs:p-6 md:h-auto md:flex-1 md:p-4 lg:p-8 dark:bg-black">
            <div className="absolute top-4 right-4 hidden flex-row items-center gap-2 md:flex lg:top-8 lg:right-8">
              <ModeToggle />
              <UserMenu />
            </div>
            <Outlet />
          </main>

          <QuickActions />
        </div>
      </Authenticated>
      <Unauthenticated>
        <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
          <Button
            render={
              <a href="/sign-in">
                Sign in to continue
                <ArrowRight />
              </a>
            }
          >
            <span className="sr-only">Sign in to continue</span>
          </Button>
        </main>
      </Unauthenticated>
      <AuthLoading>
        <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
          Loading onboarding...
        </div>
      </AuthLoading>
    </>
  );
}
