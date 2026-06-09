import { Array, Option, pipe } from "effect";
import type { ReactNode } from "react";

import { UserAvatar } from "@/components/avatars/userAvatar";
import { type ComboboxOption } from "@/components/form/combobox-field";
import { getFieldErrors } from "@/components/form/field-helpers";
import { InputWrapper } from "@/components/form/input-wrapper";
import { useFieldContext } from "@/components/form/ts-field";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxValue,
} from "@/components/ui/combobox";

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

const optionToLabel = (option: ComboboxOption): string => option.label;

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

  const selectedOption = pipe(
    options,
    Array.findFirst((option) => option.id === field.state.value),
    Option.getOrNull,
  );
  const selectedValue = selectedOption ? [selectedOption] : [];

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
      <Combobox<ComboboxOption, true>
        disabled={disabled}
        items={options as Array<ComboboxOption>}
        itemToStringLabel={optionToLabel}
        multiple
        onValueChange={(next) => {
          const picked = Array.last(next);
          field.handleChange(
            pipe(
              picked,
              Option.map((option) => option.id),
              Option.getOrNull,
            ),
          );
          field.handleBlur();
        }}
        value={selectedValue}
      >
        <ComboboxChips
          aria-invalid={Boolean(processedError)}
          className={className}
          data-disabled={disabled || undefined}
        >
          <ComboboxValue>
            {(value: ReadonlyArray<ComboboxOption>) => (
              <>
                {pipe(
                  value,
                  Array.map((option) => (
                    <ComboboxChip aria-label={option.label} key={option.id}>
                      <span className="flex items-center gap-1.5">
                        <UserAvatar name={option.label} size={20} userId={option.id} />
                        <span className="truncate">{option.label}</span>
                      </span>
                    </ComboboxChip>
                  )),
                )}
                <ComboboxChipsInput
                  disabled={disabled}
                  id={field.name}
                  placeholder={value.length > 0 ? undefined : placeholder}
                />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxPopup>
          <ComboboxEmpty>No results.</ComboboxEmpty>
          <ComboboxList>
            {pipe(
              options,
              Array.map((option) => (
                <ComboboxItem disabled={option.disabled} key={option.id} value={option}>
                  <span className="flex items-center gap-2">
                    <UserAvatar name={option.label} size={20} userId={option.id} />
                    <span className="truncate">{option.label}</span>
                  </span>
                </ComboboxItem>
              )),
            )}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>
    </InputWrapper>
  );
}
