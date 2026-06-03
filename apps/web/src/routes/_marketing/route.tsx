import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_marketing")({
  component: MarketingLayoutComponent,
});

function MarketingLayoutComponent() {
  return (
    <main className="min-h-svh bg-background">
      <Outlet />
    </main>
  );
}
