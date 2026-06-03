import { Array, pipe } from "effect";
import type { ReactNode } from "react";

import { type ComboboxOption } from "@/components/form/combobox-field";
import { getFieldErrors } from "@/components/form/field-helpers";
import { InputWrapper } from "@/components/form/input-wrapper";
import { useFieldContext } from "@/components/form/ts-field";
import { cn } from "@/lib/utils";

export type SingleComboboxFieldProps = {
  label?: ReactNode;
  labelClassName?: string;
  wrapperClassName?: string;
  errorClassName?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  options: ReadonlyArray<ComboboxOption>;
};

export function SingleComboboxField({
  label,
  labelClassName,
  wrapperClassName,
  errorClassName,
  placeholder = "Select",
  className,
  required = false,
  disabled = false,
  options,
}: SingleComboboxFieldProps) {
  const field = useFieldContext<string | null>();
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
      <select
        aria-invalid={Boolean(processedError)}
        className={cn(
          "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          className,
        )}
        disabled={disabled}
        id={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value || null)}
        value={field.state.value ?? ""}
      >
        <option value="">{placeholder}</option>
        {pipe(
          options,
          Array.map((option) => (
            <option disabled={option.disabled} key={option.id} value={option.id}>
              {option.label}
            </option>
          )),
        )}
      </select>
    </InputWrapper>
  );
}
