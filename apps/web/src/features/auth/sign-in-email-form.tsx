import { Form } from "@/components/form/form";
import { useAppForm } from "@/components/form/ts-form";
import { Button } from "@/components/ui/button";
import { SignInState, signInStateAtom } from "@/features/auth/sign-in-state";
import { authClient } from "@/lib/auth-client";
import { revalidateLogic } from "@tanstack/react-form";
import { Schema } from "effect";
import { useSetAtom } from "jotai";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";

const SignInSchema = Schema.Struct({
  email: Schema.String.pipe(
    Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
      message: () => "Invalid email address",
    }),
  ),
});

type SignInEmailFormProps = {
  readonly defaultEmail?: string;
  readonly autoSubmit?: boolean;
};

export function SignInEmailForm({ defaultEmail = "", autoSubmit = false }: SignInEmailFormProps) {
  const setSignInState = useSetAtom(signInStateAtom);
  const hasAutoSubmitted = useRef(false);

  const emailForm = useAppForm({
    defaultValues: {
      email: defaultEmail,
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    onSubmit: async ({ value }) => {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: value.email,
        type: "sign-in",
      });

      if (result.error) {
        return;
      }

      setSignInState(SignInState.otp({ email: value.email }));
    },
    validators: {
      onSubmit: Schema.standardSchemaV1(SignInSchema),
    },
  });

  useEffect(() => {
    if (autoSubmit && defaultEmail && !hasAutoSubmitted.current) {
      hasAutoSubmitted.current = true;
      emailForm.handleSubmit();
    }
  }, [autoSubmit, defaultEmail, emailForm]);

  return (
    <Form form={emailForm}>
      <emailForm.AppField name="email">
        {(field) => (
          <field.InputField
            autoCapitalize="none"
            autoComplete="email"
            data-1p-ignore="true"
            label="Email address"
            placeholder="you@example.com"
            required
            type="email"
          />
        )}
      </emailForm.AppField>

      <emailForm.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button
            className="w-full gap-2"
            loading={isSubmitting}
            onClick={() => {
              void emailForm.handleSubmit();
            }}
            type="button"
          >
            Continue
            <ArrowRight />
          </Button>
        )}
      </emailForm.Subscribe>
    </Form>
  );
}
