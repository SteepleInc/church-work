import { Link } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { useMemo } from "react";

import {
  useCloseDetailsPane,
  useDetailsPaneState,
  useOpenDetailsPaneUrl,
} from "@/components/details-pane/details-pane-helpers";
import type {
  DetailsPaneParams,
  DetailsPaneUnion,
} from "@/components/details-pane/details-pane-types";
import { OrgDetailsPane } from "@/features/details-pane/org-details-pane";
import { TaskDetailsPane } from "@/features/details-pane/task-details-pane";
import { TeamDetailsPane } from "@/features/details-pane/team-details-pane";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DetailsPane({ className }: { readonly className?: string }) {
  const [detailsPaneState] = useDetailsPaneState();
  const closeDetailsPane = useCloseDetailsPane();
  const currentEntity = useMemo(() => detailsPaneState.at(-1) ?? null, [detailsPaneState]);

  if (!currentEntity) {
    return null;
  }

  return (
    <aside
      aria-label="Details Pane"
      className={cn(
        "fixed right-2 bottom-2 z-50 grid h-[min(42rem,calc(100svh-5rem))] w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border bg-background shadow-2xl md:top-[4.5rem] md:w-[28rem]",
        className,
      )}
    >
      <DetailsPaneHistory history={detailsPaneState} />
      <DetailsPaneContent entity={currentEntity} />
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="absolute top-3 right-3 z-10"
        onClick={closeDetailsPane}
      >
        <XIcon className="size-4" />
        <span className="sr-only">Close details pane</span>
      </Button>
    </aside>
  );
}

function DetailsPaneContent({ entity }: { readonly entity: DetailsPaneUnion }) {
  if (entity._tag === "task") {
    return <TaskDetailsPane taskId={entity.id} />;
  }

  if (entity._tag === "team") {
    return <TeamDetailsPane teamId={entity.id} />;
  }

  return <OrgDetailsPane orgId={entity.id} />;
}

function DetailsPaneHistory({ history }: { readonly history: DetailsPaneParams }) {
  const openDetailsPaneUrl = useOpenDetailsPaneUrl({ replace: true });

  if (history.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Details history" className="flex gap-2 border-b px-4 pt-4 text-sm">
      {history.map((entry, index) => {
        const label = `${entry._tag} ${index + 1}`;
        const isCurrent = index === history.length - 1;

        return (
          <Link
            key={`${entry._tag}-${entry.id}-${index}`}
            {...openDetailsPaneUrl(history.slice(0, index + 1) as DetailsPaneParams)}
            className={cn("capitalize", isCurrent ? "font-medium" : "text-muted-foreground")}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
