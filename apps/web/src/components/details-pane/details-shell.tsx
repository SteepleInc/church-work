import type { ReactNode } from "react";

import { MainContainer } from "@/components/pageComponents";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function DetailsShell({
  topBarButtons,
  header,
  headerBand,
  tabBar,
  content,
  contentClassName,
}: {
  readonly topBarButtons: ReactNode;
  readonly header?: ReactNode;
  /**
   * A full-bleed band rendered directly below the top bar, outside the scroll
   * area and without the default header padding. Used by the Task pane for a
   * Linear-style fixed property row with its own divider. Renders in place of
   * `header` when provided.
   */
  readonly headerBand?: ReactNode;
  readonly tabBar?: ReactNode;
  readonly content: ReactNode;
  readonly contentClassName?: string;
}) {
  return (
    <MainContainer>
      <div className="flex h-[55px] items-center px-4">
        <div className="flex flex-1 flex-row items-center gap-2 md:mr-17">{topBarButtons}</div>
      </div>

      <Separator />

      <div className="flex h-full flex-col overflow-hidden">
        {headerBand ?? (
          <div className="mt-4 mb-4 flex flex-row items-center px-6">
            <div className="grid gap-1">{header}</div>
          </div>
        )}

        <div className="flex h-full flex-col overflow-hidden">
          {tabBar ? <div className="flex flex-row gap-1.5 px-6">{tabBar}</div> : null}

          <div className={cn("grid gap-4 overflow-auto p-6 pt-4", contentClassName)}>{content}</div>
        </div>
      </div>
    </MainContainer>
  );
}
