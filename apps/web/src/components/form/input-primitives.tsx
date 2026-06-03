import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type InputErrorsProps = HTMLAttributes<HTMLParagraphElement>;

export function InputErrors({ children, className, ...props }: InputErrorsProps) {
  return (
    <p className={cn("text-sm text-destructive", className)} {...props}>
      {children}
    </p>
  );
}
