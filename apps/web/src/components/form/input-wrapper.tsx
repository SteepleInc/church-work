import { Option, pipe, String as EffectString } from "effect";
import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type InputWrapperProps = {
  children: ReactNode;
  labelClassName?: string;
  errorClassName?: string;
  processedError?: string;
  required?: boolean;
  label?: ReactNode;
  name?: string | number | symbol;
  className?: string;
};

export function InputWrapper({
  children,
  errorClassName,
  processedError,
  labelClassName,
  required = false,
  label,
  name,
  className,
}: InputWrapperProps) {
  return (
    <div className={cn("grid w-full gap-1.5", className)}>
      <InputLabel
        label={label}
        labelClassName={labelClassName}
        name={name}
        processedError={processedError}
        required={required}
      />
      {children}
      {pipe(
        processedError,
        Option.fromNullable,
        Option.filter(EffectString.isNonEmpty),
        Option.match({
          onNone: () => null,
          onSome: (error) => (
            <p className={cn("text-sm text-destructive", errorClassName)}>{error}</p>
          ),
        }),
      )}
    </div>
  );
}

type InputLabelProps = {
  label?: ReactNode;
  processedError?: string;
  required: boolean;
  labelClassName?: string;
  name?: string | number | symbol;
};

function InputLabel({ label, processedError, labelClassName, required, name }: InputLabelProps) {
  return pipe(
    label,
    Option.fromNullable,
    Option.filter((value) => value !== ""),
    Option.match({
      onNone: () => null,
      onSome: (value) => (
        <Label
          className={cn(processedError && "text-destructive", labelClassName)}
          htmlFor={String(name)}
        >
          {value}
          {required ? <span className="text-destructive">*</span> : null}
        </Label>
      ),
    }),
  );
}
