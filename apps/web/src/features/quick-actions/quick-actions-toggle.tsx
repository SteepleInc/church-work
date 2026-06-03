import { useSetAtom } from "jotai";
import { KeyboardIcon } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

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
        "relative flex-1 justify-start rounded-lg border bg-background/80 px-2 text-muted-foreground shadow-none transition-all hover:bg-muted group-data-[state=collapsed]:md:px-2",
        className,
      )}
      contentWrapperClassName="w-full justify-start"
      onClick={() => setQuickActionsIsOpen(true)}
      type="button"
      variant="ghost"
      {...props}
    >
      <KeyboardIcon className="size-4 shrink-0 text-foreground" />
      <span className="line-clamp-1 text-left group-data-[state=collapsed]:md:hidden">
        Quick Actions
      </span>
      <Kbd className="absolute right-2 ml-auto group-data-[state=collapsed]:md:hidden">mod K</Kbd>
    </Button>
  );
}
