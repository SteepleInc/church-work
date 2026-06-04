import { useSetAtom } from "jotai";
import type { ComponentPropsWithoutRef } from "react";

import { KeyboardIcon } from "@/components/icons/keyboardIcon";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { quickActionsIsOpenAtom } from "@/features/quick-actions/quick-actions-state";
import { cn } from "@/lib/utils";

type QuickActionsToggleProps = Omit<ComponentPropsWithoutRef<typeof Button>, "onClick">;

export function QuickActionsToggle({ className, ...props }: QuickActionsToggleProps) {
  const setQuickActionsIsOpen = useSetAtom(quickActionsIsOpenAtom);

  return (
    <Button
      aria-label="Open quick actions"
      className={cn(
        "group-data-[state=collapsed]:md:!px-2 relative flex-1 justify-start rounded-lg border border-l2 bg-l2 px-2 text-muted-foreground text-sm transition-all hover:border-zinc-950/20 hover:bg-l2",
        className,
      )}
      contentWrapperClassName="w-full justify-[initial] justify-start"
      onClick={() => setQuickActionsIsOpen(true)}
      type="button"
      variant="ghost"
      {...props}
    >
      <KeyboardIcon className={cn("ml-0 flex-shrink-0 text-foreground")} />
      <span className="line-clamp-1 text-left group-data-[state=collapsed]:md:hidden">
        Quick Actions
      </span>
      <Kbd className="absolute right-2 ml-auto transition-opacity duration-200 group-data-[state=collapsed]:md:opacity-0">
        mod K
      </Kbd>
    </Button>
  );
}
