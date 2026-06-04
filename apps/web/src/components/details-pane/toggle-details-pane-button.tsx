import { Boolean, pipe } from "effect";
import { PanelRightIcon } from "lucide-react";
import { useAtom } from "jotai";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { detailsPaneStickyAtom } from "@/shared/global-state";

export function ToggleDetailsPaneButton({ className, ...domProps }: ComponentProps<typeof Button>) {
  const [detailsPaneSticky, setDetailsPaneSticky] = useAtom(detailsPaneStickyAtom);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            className={cn("group", className)}
            onClick={(event) => {
              event.preventDefault();
              setDetailsPaneSticky((isSticky) => !isSticky);
            }}
            size="icon-sm"
            type="button"
            variant="ghost"
            {...domProps}
          />
        }
      >
        <PanelRightIcon className={cn("size-4", detailsPaneSticky ? "text-primary" : null)} />
        <span className="sr-only">
          {detailsPaneSticky ? "Overlay details pane" : "Pin details pane"}
        </span>
      </TooltipTrigger>

      <TooltipContent>
        <p>
          {pipe(
            detailsPaneSticky,
            Boolean.match({
              onFalse: () => "Pin details pane",
              onTrue: () => "Overlay details pane",
            }),
          )}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
