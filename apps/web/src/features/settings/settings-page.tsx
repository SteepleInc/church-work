import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { LinkProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * Linear-style settings content shell. A single centered column that scrolls,
 * with a large page title and stacked sections. Used by every settings route's
 * right-hand pane.
 */
export function SettingsPage({
  children,
  className,
  ...domProps
}: ComponentProps<typeof ScrollArea>) {
  return (
    <ScrollArea
      className={cn("flex-1", className)}
      data-slot="settings-page"
      viewportClassName="px-6 py-10 md:px-10"
      {...domProps}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-10">{children}</div>
    </ScrollArea>
  );
}

export function SettingsBackLink({
  to,
  params,
  children,
}: {
  readonly to: LinkProps["to"];
  readonly params?: LinkProps["params"];
  readonly children: ReactNode;
}) {
  return (
    <Link
      className="flex w-fit items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
      params={params}
      preload="intent"
      to={to}
    >
      <HugeiconsIcon className="size-4" icon={ArrowLeft01Icon} strokeWidth={2} />
      {children}
    </Link>
  );
}

export function SettingsPageHeader({
  title,
  description,
  actions,
}: {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SettingsSection({
  title,
  description,
  children,
}: {
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      {title || description ? (
        <div className="flex flex-col gap-1">
          {title ? <h2 className="font-medium text-base">{title}</h2> : null}
          {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * A single labeled settings row (label + description on the left, a control on
 * the right), mirroring Linear's preferences rows. Stacks vertically when no
 * control is supplied.
 */
export function SettingsRow({
  label,
  description,
  control,
}: {
  readonly label: ReactNode;
  readonly description?: ReactNode;
  readonly control?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-border border-b py-4 last:border-b-0">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-sm">{label}</span>
        {description ? <span className="text-muted-foreground text-sm">{description}</span> : null}
      </div>
      {control ? <div className="flex shrink-0 items-center gap-2">{control}</div> : null}
    </div>
  );
}

export function SettingsRowGroup({ children }: { readonly children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

/**
 * A clickable settings row that navigates to a sub-page, used by overview pages
 * (e.g. a Team's settings overview). Mirrors Linear's card-list drill-downs.
 */
export function SettingsLinkRow({
  icon,
  title,
  description,
  to,
  params,
  meta,
}: {
  readonly icon?: ReactNode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly to: LinkProps["to"];
  readonly params?: LinkProps["params"];
  readonly meta?: ReactNode;
}) {
  return (
    <Link
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors",
        "hover:bg-accent",
      )}
      params={params}
      preload="intent"
      to={to}
    >
      {icon ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium text-sm">{title}</span>
        {description ? <span className="text-muted-foreground text-sm">{description}</span> : null}
      </span>
      {meta ? <span className="shrink-0 text-muted-foreground text-sm">{meta}</span> : null}
      <HugeiconsIcon
        className="size-4 shrink-0 text-muted-foreground"
        icon={ArrowRight01Icon}
        strokeWidth={2}
      />
    </Link>
  );
}
