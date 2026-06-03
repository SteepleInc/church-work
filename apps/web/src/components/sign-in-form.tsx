import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/form/form";
import { useAppForm } from "@/components/form/ts-form";
import { OtpForm } from "@/components/otp-form";
import { SignInState, signInStateAtom } from "@/features/auth/sign-in-state";
import { revalidateLogic } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Match, Schema } from "effect";
import { useAtom } from "jotai";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

const SignInSchema = Schema.Struct({
  email: Schema.String.pipe(
    Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
      message: () => "Invalid email address",
    }),
  ),
});

export default function SignInForm() {
  const [signInState, setSignInState] = useAtom(signInStateAtom);
  const navigate = useNavigate({
    from: "/",
  });

  const form = useAppForm({
    defaultValues: {
      email: "",
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onDynamic: Schema.standardSchemaV1(SignInSchema),
      onSubmitAsync: async ({ value }) => {
        const result = await authClient.emailOtp.sendVerificationOtp({
          email: value.email,
          type: "sign-in",
        });

        if (result.error) {
          return {
            form: result.error.message || "Failed to send verification code",
          };
        }

        setSignInState(SignInState.otp({ email: value.email }));
      },
    },
  });

  return (
    <Card className="w-96 max-w-[calc(100vw-2.5rem)]">
      <CardHeader>
        <CardTitle className="text-4xl font-medium">
          {Match.value(signInState).pipe(
            Match.tag("email", () => "Sign in to Church Task"),
            Match.tag("otp", () => "Check your email"),
            Match.exhaustive,
          )}
        </CardTitle>
        <CardDescription>
          {Match.value(signInState).pipe(
            Match.tag("email", () => "Enter your email to receive a sign-in code."),
            Match.tag("otp", ({ email }) => `Use the 6-digit code sent to ${email}.`),
            Match.exhaustive,
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {Match.value(signInState).pipe(
          Match.tag("email", () => (
            <Form form={form}>
              <form.AppField name="email">
                {(field) => (
                  <field.InputField
                    autoCapitalize="none"
                    autoComplete="email"
                    label="Email address"
                    placeholder="you@example.com"
                    required
                    type="email"
                  />
                )}
              </form.AppField>

              <form.Subscribe
                selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {({ canSubmit, isSubmitting }) => (
                  <Button
                    className="w-full gap-2"
                    disabled={!canSubmit}
                    loading={isSubmitting}
                    type="submit"
                  >
                    Continue
                    <ArrowRight />
                  </Button>
                )}
              </form.Subscribe>
            </Form>
          )),
          Match.tag("otp", ({ email }) => (
            <OtpForm
              autoSubmit
              email={email}
              onSuccess={async () => {
                await navigate({ to: "/my-work" });
                toast.success("Sign in successful");
              }}
            />
          )),
          Match.exhaustive,
        )}
      </CardContent>
    </Card>
  );
}
