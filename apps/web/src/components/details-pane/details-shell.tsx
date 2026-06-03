import type { ReactNode } from "react";

export function DetailsShell({
  topBarButtons,
  header,
  content,
}: {
  readonly topBarButtons: ReactNode;
  readonly header: ReactNode;
  readonly content: ReactNode;
}) {
  return (
    <div className="grid h-full grid-rows-[auto_1fr] overflow-hidden">
      <div className="flex min-h-14 items-center gap-2 border-b px-4">{topBarButtons}</div>
      <div className="grid gap-4 overflow-auto p-5">
        <div className="grid gap-1">{header}</div>
        {content}
      </div>
    </div>
  );
}
