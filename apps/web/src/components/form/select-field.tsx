import { Array, Option, pipe, String } from "effect";
import type { ComponentProps, ReactNode } from "react";

import { getFieldErrors } from "@/components/form/field-helpers";
import { InputWrapper } from "@/components/form/input-wrapper";
import { useFieldContext } from "@/components/form/ts-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type SelectFieldProps = {
  defaultValue?: string;
  label?: ReactNode;
  labelClassName?: string;
  wrapperClassName?: string;
  errorClassName?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  options: ReadonlyArray<{ label: string; value: string; disabled?: boolean }>;
} & Omit<ComponentProps<typeof Select>, "onValueChange" | "value">;

export function SelectField({
  label,
  wrapperClassName,
  labelClassName,
  errorClassName,
  required = false,
  defaultValue,
  disabled = false,
  className,
  placeholder,
  options,
  ...domProps
}: SelectFieldProps) {
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
      <Select
        defaultValue={defaultValue}
        disabled={disabled}
        // Base UI's SelectValue renders the raw value unless the root knows
        // the items; with this it renders the selected option's label.
        items={pipe(
          options,
          Array.map(({ label, value }) => ({ label, value })),
        )}
        onValueChange={(value) => {
          field.handleChange(value as string);
          field.handleBlur();
        }}
        value={field.state.value}
        {...domProps}
      >
        <SelectTrigger
          aria-invalid={Boolean(processedError)}
          className={cn("w-full", className)}
          disabled={disabled}
          // Associates the InputWrapper label (htmlFor={field.name}) with the
          // trigger for accessibility and label-based queries.
          id={field.name}
          data-has-value={pipe(
            field.state.value,
            Option.fromNullable,
            Option.match({
              onNone: () => false,
              onSome: String.isNonEmpty,
            }),
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {pipe(
            options,
            Array.map((option) => (
              <SelectItem disabled={option.disabled} key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            )),
          )}
        </SelectContent>
      </Select>
    </InputWrapper>
  );
}
