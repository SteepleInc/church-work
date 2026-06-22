import { useRef } from "react";

import { useAppForm } from "@/components/form/ts-form";
import { Input } from "@/components/ui/input";

type InlineNameFormInputProps = {
  readonly defaultValue: string;
  readonly onSubmit: (name: string) => void;
  readonly onCancel: () => void;
  readonly placeholder: string;
  readonly autoFocus?: boolean;
  readonly onValueChange?: (value: string) => void;
};

/** A small text field that commits on Enter/blur and cancels on Escape. */
export function InlineNameFormInput({
  defaultValue,
  onSubmit,
  onCancel,
  placeholder,
  autoFocus = true,
  onValueChange,
}: InlineNameFormInputProps) {
  const committed = useRef(false);

  const form = useAppForm({
    defaultValues: { name: defaultValue },
    onSubmit: ({ value }) => {
      const trimmed = value.name.trim();
      if (trimmed) onSubmit(trimmed);
      else onCancel();
    },
  });

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    void form.handleSubmit();
  };

  return (
    <form.Field name="name">
      {(field) => (
        <Input
          // biome-ignore lint/a11y/noAutofocus: inline edit affordance
          autoFocus={autoFocus}
          className="h-8 w-56"
          onBlur={() => {
            field.handleBlur();
            commit();
          }}
          onChange={(event) => {
            const next = event.currentTarget.value;
            field.handleChange(next);
            onValueChange?.(next);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              committed.current = true;
              onCancel();
            }
          }}
          placeholder={placeholder}
          value={field.state.value}
        />
      )}
    </form.Field>
  );
}
