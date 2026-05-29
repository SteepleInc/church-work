import { Option, pipe } from "effect";
import type { ComponentProps, ReactNode } from "react";

import { getFieldErrors } from "@/components/form/field-helpers";
import { InputWrapper } from "@/components/form/input-wrapper";
import { useFieldContext } from "@/components/form/ts-field";
import { Input } from "@/components/ui/input";

type InputFieldProps = {
  label?: ReactNode;
  labelClassName?: string;
  wrapperClassName?: string;
  errorClassName?: string;
  required?: boolean;
} & Omit<ComponentProps<typeof Input>, "onChange" | "value">;

export function InputField({
  label,
  wrapperClassName,
  labelClassName,
  errorClassName,
  required = false,
  ...domProps
}: InputFieldProps) {
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
      <Input
        aria-invalid={Boolean(processedError)}
        id={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        value={pipe(
          field.state.value,
          Option.fromNullable,
          Option.getOrElse(() => ""),
        )}
        {...domProps}
      />
    </InputWrapper>
  );
}
