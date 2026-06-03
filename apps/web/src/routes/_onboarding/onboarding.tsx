import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_onboarding/onboarding")({
  component: OnboardingRoute,
});

function OnboardingRoute() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <section className="w-full max-w-xl rounded-xl border bg-background p-6 shadow-xs">
        <p className="text-sm font-medium text-muted-foreground">Church Task</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Onboarding</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The copied onboarding flow lands in this route group and will be filled in by the
          onboarding slice.
        </p>
      </section>
    </main>
  );
}
