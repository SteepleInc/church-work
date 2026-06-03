import type { ComponentProps, ReactNode } from "react";

import { getFieldErrors } from "@/components/form/field-helpers";
import { InputLabel, InputWrapper } from "@/components/form/input-wrapper";
import { useFieldContext } from "@/components/form/ts-field";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type SwitchFieldProps = {
  label?: ReactNode;
  labelClassName?: string;
  wrapperClassName?: string;
  errorClassName?: string;
  subWrapperClassName?: string;
  required?: boolean;
} & Omit<ComponentProps<typeof Switch>, "onChange" | "checked">;

export function SwitchField({
  label,
  wrapperClassName,
  labelClassName,
  errorClassName,
  required = false,
  subWrapperClassName,
  ...domProps
}: SwitchFieldProps) {
  const field = useFieldContext<boolean>();
  const { processedError } = getFieldErrors(field.state.meta.errors);

  return (
    <InputWrapper
      className={wrapperClassName}
      errorClassName={errorClassName}
      labelClassName={labelClassName}
      name={field.name}
      processedError={processedError}
      required={required}
    >
      <label
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-2 py-2",
          subWrapperClassName,
        )}
        htmlFor={field.name}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            field.handleChange(!field.state.value);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <InputLabel
          label={label}
          labelClassName={cn(labelClassName, "cursor-pointer select-none")}
          name={field.name}
          processedError={processedError}
          required={required}
        />
        <Switch
          checked={field.state.value}
          id={field.name}
          onBlur={field.handleBlur}
          onCheckedChange={field.handleChange}
          {...domProps}
        />
      </label>
    </InputWrapper>
  );
}
