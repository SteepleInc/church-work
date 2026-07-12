import { ModeToggle } from "@/components/mode-toggle";
import { ChurchWorkLogoMark, ChurchWorkWordmark } from "@/components/church-work-logo";
import { Button } from "@/components/ui/button";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
  component: AuthLayoutComponent,
});

function AuthLayoutComponent() {
  return (
    <main className="relative flex h-screen w-full flex-row">
      <div className="absolute top-4 left-4">
        <Button nativeButton={false} render={<Link preload="intent" to="/" />} variant="ghost">
          Home
        </Button>
      </div>

      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      <div className="m-auto flex flex-col items-start">
        <Link
          aria-label="Church Work"
          className="mb-8 flex items-center gap-2.5"
          preload="intent"
          to="/"
        >
          <ChurchWorkLogoMark className="size-10 shrink-0" />
          <ChurchWorkWordmark className="text-3xl [&>span:first-child]:text-foreground" />
        </Link>

        <Outlet />
      </div>
    </main>
  );
}
