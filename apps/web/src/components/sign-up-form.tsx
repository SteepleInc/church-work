import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppForm } from "@/components/form/ts-form";
import { revalidateLogic } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Schema } from "effect";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

const SignUpSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.minLength(2, { message: () => "Name must be at least 2 characters" }),
  ),
  email: Schema.String.pipe(
    Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
      message: () => "Invalid email address",
    }),
  ),
  password: Schema.String.pipe(
    Schema.minLength(8, { message: () => "Password must be at least 8 characters" }),
  ),
});

export default function SignUpForm({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const navigate = useNavigate({
    from: "/",
  });

  const form = useAppForm({
    defaultValues: {
      email: "",
      password: "",
      name: "",
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
        },
        {
          onSuccess: () => {
            navigate({
              to: "/my-work",
            });
            toast.success("Sign up successful");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: Schema.standardSchemaV1(SignUpSchema),
    },
  });

  return (
    <div className="mx-auto w-full mt-10 max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-3xl">Create Account</CardTitle>
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
            <form.AppField name="name">
              {(field) => <field.InputField label="Name" required />}
            </form.AppField>

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
                  {isSubmitting ? "Submitting..." : "Sign Up"}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <Button
            variant="link"
            onClick={onSwitchToSignIn}
            className="text-indigo-600 hover:text-indigo-800"
          >
            Already have an account? Sign In
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
