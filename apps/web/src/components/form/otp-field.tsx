import { REGEXP_ONLY_DIGITS } from "input-otp";
import type { ComponentProps, ReactNode } from "react";

import { getFieldErrors } from "@/components/form/field-helpers";
import { InputWrapper } from "@/components/form/input-wrapper";
import { useFieldContext } from "@/components/form/ts-field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type OTPFieldProps = {
  label?: ReactNode;
  labelClassName?: string;
  wrapperClassName?: string;
  errorClassName?: string;
  required?: boolean;
} & Omit<
  ComponentProps<typeof InputOTP>,
  "onChange" | "value" | "maxLength" | "pattern" | "render"
>;

export function OTPField({
  label,
  wrapperClassName,
  labelClassName,
  errorClassName,
  required = false,
  ...domProps
}: OTPFieldProps) {
  const field = useFieldContext<string>();
  const { processedError } = getFieldErrors(field.state.meta.errors);

  return (
    <InputWrapper
      className={wrapperClassName}
      errorClassName={errorClassName}
      label={label}
      labelClassName={labelClassName}
      name={field.name}
      processedError={processedError}
      required={required}
    >
      <InputOTP
        aria-invalid={Boolean(processedError)}
        maxLength={6}
        onChange={(value) => field.handleChange(value)}
        pattern={REGEXP_ONLY_DIGITS}
        value={field.state.value}
        {...domProps}
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    </InputWrapper>
  );
}
