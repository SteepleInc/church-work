import { Toolbar as ToolbarPrimitive } from "@base-ui/react/toolbar";
import type * as React from "react";

import { cn } from "@/lib/utils";

export function Toolbar({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.Root>) {
  return (
    <ToolbarPrimitive.Root
      className={cn("relative flex select-none items-center", className)}
      {...props}
    />
  );
}

export function ToolbarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.Separator>) {
  return (
    <ToolbarPrimitive.Separator
      className={cn("mx-2 my-1 w-px shrink-0 bg-border", className)}
      {...props}
    />
  );
}
