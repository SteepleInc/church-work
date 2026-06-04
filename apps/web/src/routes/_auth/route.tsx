import { Button } from "@/components/ui/button";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
  component: AuthLayoutComponent,
});

function AuthLayoutComponent() {
  return (
    <main className="relative flex h-screen w-full flex-row">
      <Button
        className="absolute top-4 right-4"
        render={<Link preload="intent" to="/" />}
        variant="ghost"
      >
        Home
      </Button>

      <div className="m-auto flex flex-col items-start">
        <Link className="mb-8 text-3xl font-semibold tracking-tight" preload="intent" to="/">
          Church Task
        </Link>

        <Outlet />
      </div>
    </main>
  );
}
