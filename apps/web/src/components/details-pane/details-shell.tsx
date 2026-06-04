import type { ReactNode } from "react";

import { MainContainer } from "@/components/pageComponents";
import { Separator } from "@/components/ui/separator";

export function DetailsShell({
  topBarButtons,
  header,
  tabBar,
  content,
}: {
  readonly topBarButtons: ReactNode;
  readonly header: ReactNode;
  readonly tabBar?: ReactNode;
  readonly content: ReactNode;
}) {
  return (
    <MainContainer>
      <div className="flex h-[55px] items-center px-4">
        <div className="flex flex-1 flex-row items-center gap-2 md:mr-17">{topBarButtons}</div>
      </div>

      <Separator />

      <div className="grid h-full flex-col overflow-hidden pt-4 sm:flex">
        <div className="mb-4 flex flex-row items-center px-6">
          <div className="grid gap-1">{header}</div>
        </div>

        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex flex-row gap-1.5 px-6">{tabBar}</div>

          <div className="grid gap-4 overflow-auto p-6 pt-4">{content}</div>
        </div>
      </div>
    </MainContainer>
  );
}
