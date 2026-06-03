import type { ReactNode } from "react";

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
