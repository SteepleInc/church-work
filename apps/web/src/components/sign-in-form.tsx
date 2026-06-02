import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppForm } from "@/components/form/ts-form";
import { revalidateLogic } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Schema } from "effect";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

const SignInSchema = Schema.Struct({
  email: Schema.String.pipe(
    Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
      message: () => "Invalid email address",
    }),
  ),
  password: Schema.String.pipe(
    Schema.minLength(8, { message: () => "Password must be at least 8 characters" }),
  ),
});

export default function SignInForm({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
  const navigate = useNavigate({
    from: "/",
  });

  const form = useAppForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onSuccess: () => {
            navigate({
              to: "/my-work",
            });
            toast.success("Sign in successful");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: Schema.standardSchemaV1(SignInSchema),
    },
  });

  return (
    <div className="mx-auto w-full mt-10 max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-3xl">Welcome Back</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <form.AppField name="email">
              {(field) => <field.InputField label="Email" required type="email" />}
            </form.AppField>

            <form.AppField name="password">
              {(field) => <field.InputField label="Password" required type="password" />}
            </form.AppField>

            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Sign In"}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <Button
            variant="link"
            onClick={onSwitchToSignUp}
            className="text-indigo-600 hover:text-indigo-800"
          >
            Need an account? Sign Up
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
