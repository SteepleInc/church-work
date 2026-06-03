import { ModeToggle } from "@/components/mode-toggle";
import { OnboardingOrgSwitcher } from "@/components/onboarding-org-switcher";
import { Button } from "@/components/ui/button";
import UserMenu from "@/components/user-menu";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { ArrowRight, Church } from "lucide-react";

export const Route = createFileRoute("/_onboarding")({
  component: OnboardingLayout,
});

function OnboardingLayout() {
  return (
    <>
      <Authenticated>
        <div className="flex h-[100dvh] w-full shrink-0 flex-col overflow-hidden bg-foreground text-background md:flex-row dark:bg-background dark:text-foreground">
          <aside className="flex shrink-0 flex-col md:w-[36%] md:max-w-[500px] lg:w-[40%]">
            <div className="relative flex h-full flex-col items-start overflow-hidden px-4 pt-4 text-background md:p-4 lg:p-8 dark:text-foreground">
              <div className="flex w-full items-center justify-between md:block">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-background text-foreground dark:bg-foreground dark:text-background">
                    <Church className="size-5" />
                  </span>
                  Church Task
                </div>
                <div className="flex flex-row items-center gap-2 md:hidden">
                  <ModeToggle />
                  <UserMenu />
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-4 pb-2 md:mt-24 md:pb-0">
                <p className="font-serif text-5xl font-bold tracking-tight">Welcome!</p>
                <p className="hidden max-w-sm text-sm text-background/70 leading-6 md:block dark:text-foreground/70">
                  Set up your Church profile so Church Task can build work around the right local
                  time, teams, and ministry context.
                </p>
              </div>

              <OnboardingOrgSwitcher className="mt-8" />

              <div className="mt-auto hidden w-full rounded-2xl border border-background/15 bg-background/10 p-4 text-sm text-background/80 md:block dark:border-foreground/15 dark:bg-foreground/10 dark:text-foreground/80">
                <p className="font-medium text-background dark:text-foreground">Next up</p>
                <p className="mt-1">Review your initial Teams before entering the app.</p>
              </div>
            </div>
          </aside>

          <main className="relative flex h-full flex-1 flex-col overflow-hidden bg-muted/30 p-4 text-foreground md:p-4 lg:p-8">
            <div className="absolute top-4 right-4 hidden flex-row items-center gap-2 md:flex lg:top-8 lg:right-8">
              <ModeToggle />
              <UserMenu />
            </div>
            <Outlet />
          </main>
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
