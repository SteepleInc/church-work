import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { useEffect, useState } from "react";

import { Form } from "@/components/form/form";
import { ActionRow } from "@/components/ui/action-row";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function useIsMdScreen() {
  const [isMdScreen, setIsMdScreen] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setIsMdScreen(query.matches);
    update();
    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, []);

  return isMdScreen;
}

type QuickActionsWrapperProps = {
  children?: ReactNode;
  dialogContentClassName?: string;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
};

export function QuickActionsWrapper({
  children,
  dialogContentClassName,
  ...domProps
}: QuickActionsWrapperProps) {
  const isMdScreen = useIsMdScreen();

  if (!isMdScreen) {
    return (
      <Drawer {...domProps}>
        <DrawerContent>{children}</DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog {...domProps}>
      <DialogContent
        className={cn(
          "top-[clamp(16px,calc((100vh-512px)/2),192px)] flex max-h-[calc(100vh-clamp(16px,calc((100vh-512px)/2),192px)*2)] w-full translate-y-0 flex-col gap-0 overflow-hidden p-0 shadow-lg sm:max-w-3xl",
          dialogContentClassName,
        )}
        hideCloseButton
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function QuickActionsHeader(props: HTMLAttributes<HTMLDivElement>) {
  const isMdScreen = useIsMdScreen();

  return isMdScreen ? <DialogHeader {...props} /> : <DrawerHeader {...props} />;
}

export function QuickActionsTitle(props: HTMLAttributes<HTMLDivElement>) {
  const isMdScreen = useIsMdScreen();

  return isMdScreen ? <DialogTitle {...props} /> : <DrawerTitle {...props} />;
}

export function QuickActionsDescription(props: HTMLAttributes<HTMLDivElement>) {
  const isMdScreen = useIsMdScreen();

  return isMdScreen ? <DialogDescription {...props} /> : <DrawerDescription {...props} />;
}

/**
 * Skeleton matching the QuickActionForm field layout, shown while a quick
 * action's record has not yet arrived (ADR 0010 — no "Loading X..." text).
 */
export function QuickActionFormSkeleton({ fields = 2 }: { readonly fields?: number }) {
  return (
    <div className="m-4 flex flex-col gap-3">
      {Array.from({ length: fields }, (_, index) => (
        <div className="flex flex-col gap-1.5" key={index}>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

const formColumnClassName = "flex flex-col gap-3 flex-1";

type QuickActionFormProps = Omit<ComponentProps<typeof Form>, "children"> & {
  Primary?: ReactNode;
  Secondary?: ReactNode;
  // Replaces the default scrolling Primary/Secondary body entirely: content
  // that manages its own overflow (e.g. the create task dialog, whose
  // description scrolls internally so the title can never scroll away).
  Body?: ReactNode;
  // Rendered between the body and the ActionRow, outside any scroll: content
  // that must stay visible (e.g. the create task dialog's property pill row).
  Pinned?: ReactNode;
  Actions?: ReactNode;
};

export function QuickActionForm({
  Primary,
  Secondary,
  Body,
  Pinned,
  Actions,
  form,
  className,
  ...domProps
}: QuickActionFormProps) {
  const formContent = (
    <div className="m-4 flex flex-col gap-3 md:flex-row">
      <div className={formColumnClassName}>{Primary}</div>
      {Secondary ? (
        <>
          <Separator orientation="vertical" />
          <div className={formColumnClassName}>{Secondary}</div>
        </>
      ) : null}
    </div>
  );

  return (
    <>
      <Separator />
      <Form
        // `grow` (not flex-1: basis stays auto) lets the form fill a
        // fixed-height dialog (e.g. the expanded create task dialog) while
        // content-height dialogs keep sizing naturally.
        className={cn("min-h-0 grow gap-0 overflow-hidden rounded-[inherit]", className)}
        form={form}
        {...domProps}
      >
        <div
          className={cn(
            "grid size-full min-h-0",
            Pinned ? "grid-rows-[1fr_auto_auto]" : "grid-rows-[1fr_auto]",
          )}
        >
          {Body ?? <ScrollArea className="min-h-0">{formContent}</ScrollArea>}
          {Pinned}
          <ActionRow>{Actions}</ActionRow>
        </div>
      </Form>
    </>
  );
}
