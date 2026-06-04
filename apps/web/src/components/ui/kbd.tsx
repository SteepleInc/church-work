import type { ReactNode } from "react";

import { EnterIcon } from "@/components/icons/enterIcon";
import { PlusIcon } from "@/components/icons/plusIcon";
import { cn } from "@/lib/utils";
import { getShortcutKey } from "@/lib/utils";

function Kbd({ className, children, ...props }: React.ComponentProps<"kbd">) {
  const shortcutKey =
    typeof children === "string"
      ? children.split(" ").map((key): ReactNode => {
          const shortcut = getShortcutKey(key);

          if (shortcut.root === "enter") {
            return <EnterIcon key="enter" />;
          }

          if (key === "+") {
            return <PlusIcon className="-mx-0.5" key="plus" />;
          }

          return shortcut.symbol;
        })
      : children;

  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:text-background dark:in-data-[slot=tooltip-content]:bg-background/10 [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      {...props}
    >
      {shortcutKey}
    </kbd>
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
