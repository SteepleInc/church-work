import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function DetailSection({
  title,
  children,
  className,
}: {
  readonly title: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string;
}) {
  return (
    <section className={cn("grid gap-2", className)}>
      <h3 className="font-semibold text-muted-foreground text-sm">{title}</h3>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}

export function DetailItem({
  label,
  value,
}: {
  readonly label: ReactNode;
  readonly value: ReactNode;
}) {
  return (
    <div className="grid gap-1 rounded-lg border bg-background/60 p-3">
      <dt className="font-medium text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className="break-words text-sm">{value}</dd>
    </div>
  );
}

/**
 * Skeleton matching the DetailSection/DetailItem layout, shown while a
 * Details Pane's data has not yet arrived (ADR 0010 — no "Loading X..." text).
 */
export function DetailSectionSkeleton({ rows = 4 }: { readonly rows?: number }) {
  return (
    <section className="grid gap-2">
      <Skeleton className="h-4 w-24" />
      <div className="grid gap-2">
        {Array.from({ length: rows }, (_, index) => (
          <div className="grid gap-1 rounded-lg border bg-background/60 p-3" key={index}>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </section>
  );
}
