import { Button } from "@/components/ui/button";
import { Form } from "@/components/form/form";
import { useAppForm } from "@/components/form/ts-form";
import { authClient } from "@/lib/auth-client";
import { usePasteDetect } from "@/shared/hooks/use-paste-detect";
import { revalidateLogic } from "@tanstack/react-form";
import { Schema, String as EffectString, pipe } from "effect";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { ArrowRight } from "lucide-react";
import { useEffect } from "react";

const OTPSchema = Schema.Struct({
  otp: Schema.String.pipe(Schema.minLength(6, { message: () => "Enter the 6-digit code" })),
});

type OtpFormProps = {
  email: string;
  submitLabel?: string;
  autoSubmit?: boolean;
  onSuccess?: () => void | Promise<void>;
};

export function OtpForm({
  email,
  submitLabel = "Sign In",
  autoSubmit = true,
  onSuccess = () => undefined,
}: OtpFormProps) {
  const { pastedContent, resetPasteContent } = usePasteDetect();

  const form = useAppForm({
    defaultValues: {
      otp: "",
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onDynamic: Schema.standardSchemaV1(OTPSchema),
      onSubmitAsync: async ({ value }) => {
        const result = await authClient.signIn.emailOtp({
          email,
          otp: value.otp,
        });

        if (result.error) {
          return {
            fields: {
              otp: result.error.message || "Invalid verification code",
            },
          };
        }

        await onSuccess();
      },
    },
  });

  useEffect(() => {
    if (typeof pastedContent === "string") {
      const trimmedContent = pipe(pastedContent, EffectString.trim);
      if (trimmedContent.match(REGEXP_ONLY_DIGITS) !== null) {
        form.reset();
        form.setFieldValue("otp", trimmedContent);
      }
    }
    resetPasteContent();
  }, [pastedContent, form, resetPasteContent]);

  return (
    <Form form={form}>
      <form.AppField
        listeners={{
          onChange: ({ value }) => {
            if (autoSubmit && value.length === 6 && value.match(REGEXP_ONLY_DIGITS)) {
              form.handleSubmit();
            }
          },
        }}
        name="otp"
      >
        {(field) => <field.OTPField autoFocus label="Verification Code" required />}
      </form.AppField>

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button className="w-full gap-2" loading={isSubmitting} type="submit">
            {submitLabel}
            <ArrowRight />
          </Button>
        )}
      </form.Subscribe>
    </Form>
  );
}
