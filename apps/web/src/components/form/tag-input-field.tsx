import type { ComponentProps, ReactNode } from "react";

import { getFieldErrors } from "@/components/form/field-helpers";
import { useFieldContext } from "@/components/form/ts-field";
import { InputWrapper } from "@/components/form/input-wrapper";
import { TagInput } from "@/components/ui/tag-input";

type TagInputFieldProps = {
  label?: ReactNode;
  labelClassName?: string;
  wrapperClassName?: string;
  errorClassName?: string;
  required?: boolean;
} & Omit<ComponentProps<typeof TagInput>, "onChange" | "value">;

export function TagInputField({
  label,
  wrapperClassName,
  labelClassName,
  errorClassName,
  required = false,
  ...domProps
}: TagInputFieldProps) {
  const field = useFieldContext<readonly string[]>();
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
      <TagInput
        onBlur={field.handleBlur}
        onChange={field.handleChange}
        value={field.state.value}
        {...domProps}
      />
    </InputWrapper>
  );
}
