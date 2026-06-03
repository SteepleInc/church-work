import SignInForm from "@/components/sign-in-form";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/sign-in")({
  component: SignInRoute,
});

function SignInRoute() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <SignInForm onSwitchToSignUp={() => undefined} />
    </main>
  );
}
