import { OtpForm } from "@/components/otp-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInEmailForm } from "@/features/auth/sign-in-email-form";
import { signInStateAtom } from "@/features/auth/sign-in-state";
import { authClient } from "@/lib/auth-client";
import { COMPLETED_APP_LANDING_PATH } from "@/data/org-routing";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Match } from "effect";
import { useAtom } from "jotai";
import { useEffect } from "react";
import { toast } from "sonner";

type SignInProps = {
  readonly defaultEmail?: string;
  readonly invitationId?: string;
  readonly redirect?: string;
};

export function SignIn({ defaultEmail, invitationId: passedInvitationId, redirect }: SignInProps) {
  const { data: session, refetch } = authClient.useSession();
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const invitationId = passedInvitationId ?? search["invitation-id"];
  const passedOtpEmail = defaultEmail ?? search.email;
  const [signInState] = useAtom(signInStateAtom);

  useEffect(() => {
    if (!session?.user) {
      return;
    }

    if (invitationId) {
      void navigate({ params: { id: invitationId }, to: "/accept-invitation/$id" });
      return;
    }

    void navigate({ to: redirect ?? COMPLETED_APP_LANDING_PATH });
  }, [invitationId, navigate, redirect, session]);

  return (
    <Card className="w-96 max-w-[calc(100vw-2.5rem)]">
      <CardHeader>
        <CardTitle className="font-medium text-4xl">
          {Match.value(signInState).pipe(
            Match.tag("email", () => "Sign in to Church Task"),
            Match.tag("otp", () => "Check your email"),
            Match.exhaustive,
          )}
        </CardTitle>
        <CardDescription className="font-normal text-sm">
          {Match.value(signInState).pipe(
            Match.tag("email", () => "Please sign in to continue"),
            Match.tag("otp", () => "Use the verification code sent to your email"),
            Match.exhaustive,
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {Match.value(signInState).pipe(
          Match.tag("email", () => (
            <SignInEmailForm autoSubmit={!!passedOtpEmail} defaultEmail={passedOtpEmail} />
          )),
          Match.tag("otp", ({ email }) => (
            <OtpForm
              autoSubmit
              email={email}
              onSuccess={async () => {
                await refetch();
                toast.success("Sign in successful");
              }}
              submitLabel="Sign In"
            />
          )),
          Match.exhaustive,
        )}
      </CardContent>
    </Card>
  );
}
