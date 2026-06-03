import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { format } from "date-fns";
import type { ReactNode } from "react";

import { getFieldErrors } from "@/components/form/field-helpers";
import { InputWrapper } from "@/components/form/input-wrapper";
import { useFieldContext } from "@/components/form/ts-field";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DatePickerFieldProps = {
  label?: ReactNode;
  labelClassName?: string;
  wrapperClassName?: string;
  errorClassName?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
};

export function DatePickerField({
  label,
  wrapperClassName,
  labelClassName,
  errorClassName,
  placeholder = "Pick a date",
  className,
  required = false,
}: DatePickerFieldProps) {
  const field = useFieldContext<number | undefined>();
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
      <Popover>
        <PopoverTrigger render={<Button variant="outline" />}>
          <span
            className={cn(
              "inline-flex w-full items-center justify-start gap-2 text-left font-normal",
              !field.state.value && "text-muted-foreground",
              className,
            )}
          >
            <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-4" />
            {field.state.value ? format(new Date(field.state.value), "PPP") : placeholder}
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            onSelect={(date) => field.handleChange(date ? date.getTime() : undefined)}
            selected={field.state.value ? new Date(field.state.value) : undefined}
          />
        </PopoverContent>
      </Popover>
    </InputWrapper>
  );
}
