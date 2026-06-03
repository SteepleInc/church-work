import { Option, pipe } from "effect";
import type { ComponentProps, ReactNode } from "react";

import { getFieldErrors } from "@/components/form/field-helpers";
import { InputWrapper } from "@/components/form/input-wrapper";
import { useFieldContext } from "@/components/form/ts-field";
import { Textarea } from "@/components/ui/textarea";

type TextareaFieldProps = {
  label?: ReactNode;
  labelClassName?: string;
  wrapperClassName?: string;
  errorClassName?: string;
  required?: boolean;
} & Omit<ComponentProps<typeof Textarea>, "onChange" | "value">;

export function TextareaField({
  label,
  wrapperClassName,
  labelClassName,
  errorClassName,
  required = false,
  ...domProps
}: TextareaFieldProps) {
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
      <Textarea
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
