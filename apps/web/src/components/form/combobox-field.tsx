import { Array as EffectArray, Option, pipe } from "effect";
import type { ChangeEvent, ReactNode } from "react";

import { getFieldErrors } from "@/components/form/field-helpers";
import { InputWrapper } from "@/components/form/input-wrapper";
import { useFieldContext } from "@/components/form/ts-field";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  id: string;
  label: string;
  disabled?: boolean;
};

export type ComboboxFieldProps = {
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

export function ComboboxField({
  label,
  labelClassName,
  wrapperClassName,
  errorClassName,
  className,
  required = false,
  disabled = false,
  options,
}: ComboboxFieldProps) {
  const field = useFieldContext<Array<string>>();
  const value = pipe(
    field.state.value,
    Option.fromNullable,
    Option.getOrElse((): Array<string> => []),
  );
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
          "min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          className,
        )}
        disabled={disabled}
        id={field.name}
        multiple
        onBlur={field.handleBlur}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => {
          field.handleChange(
            globalThis.Array.from(event.target.selectedOptions, (option) => option.value),
          );
        }}
        value={value}
      >
        {pipe(
          options,
          EffectArray.map((option) => (
            <option disabled={option.disabled} key={option.id} value={option.id}>
              {option.label}
            </option>
          )),
        )}
      </select>
    </InputWrapper>
  );
}
