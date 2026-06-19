import { CalendarDays, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  describeKeyDateSchedule,
  formatKeyDateOccurrence,
  useDeleteKeyDate,
  useKeyDatesCollection,
} from "@/data/templates/keyDatesData.app";

/**
 * A lightweight review of the Starter Key Dates seeded during Onboarding,
 * shown on the Finished step. It reassures the user the dates are editable and
 * lets them drop any they don't want before entering the product; full
 * management lives later in Church settings.
 */
export function OnboardingKeyDatesReview({ churchId }: { readonly churchId: string }) {
  const { keyDatesCollection } = useKeyDatesCollection({ churchId });
  const deleteKeyDate = useDeleteKeyDate();

  const keyDates = [...keyDatesCollection].sort((a, b) => {
    if (a.nextOccurrence && b.nextOccurrence) return a.nextOccurrence < b.nextOccurrence ? -1 : 1;
    if (a.nextOccurrence) return -1;
    if (b.nextOccurrence) return 1;
    return a.name.localeCompare(b.name);
  });

  if (keyDates.length === 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="px-0.5 font-medium text-foreground text-sm">Your Key Dates</span>
        {Array.from({ length: 3 }, (_, index) => (
          <div
            className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2"
            key={`key-date-skeleton-${index}`}
          >
            <Skeleton className="size-7 shrink-0 rounded-md" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="font-medium text-foreground text-sm">Your Key Dates</span>
        <span className="text-muted-foreground text-xs">
          {keyDates.length} dates · editable later
        </span>
      </div>

      <ScrollArea className="max-h-52" viewportClassName="pr-2">
        <ul aria-label="Starter Key Dates" className="flex flex-col gap-1.5">
          {keyDates.map((keyDate) => (
            <li
              className="group flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2"
              key={keyDate.id}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <CalendarDays className="size-3.5" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-sm">{keyDate.name}</span>
                <span className="truncate text-muted-foreground text-xs">
                  {describeKeyDateSchedule(keyDate.schedule)}
                </span>
              </div>
              <span className="shrink-0 whitespace-nowrap text-muted-foreground text-xs tabular-nums">
                {formatKeyDateOccurrence(keyDate.nextOccurrence)}
              </span>
              <Button
                aria-label={`Remove ${keyDate.name}`}
                className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => void deleteKeyDate({ churchId, keyDateId: keyDate.id })}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
