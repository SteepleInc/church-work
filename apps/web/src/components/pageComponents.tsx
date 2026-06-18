import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function MainContainer({ children, className, ...domProps }: ComponentProps<"main">) {
  return (
    <main
      className={cn("-mt-1 flex flex-1 flex-col overflow-hidden pt-1", className)}
      data-slot="main-container"
      {...domProps}
    >
      {children}
    </main>
  );
}

export function PageContainer({
  children,
  className,
  wrapperClassName,
  ...domProps
}: ComponentProps<typeof ScrollArea> & { readonly wrapperClassName?: string }) {
  return (
    <ScrollArea className={className} data-slot="page-container" {...domProps}>
      <PageWrapper className={wrapperClassName}>{children}</PageWrapper>
    </ScrollArea>
  );
}

export const pageWrapperSpacing = "px-4 py-4 pt-0 md:pt-1";

const pageWrapperVariants = cva(["flex flex-col", pageWrapperSpacing], {
  defaultVariants: {
    variant: "default",
  },
  variants: {
    variant: {
      default: "",
      noPageContainer: "flex-1 overflow-hidden",
    },
  },
});

export function PageWrapper({
  children,
  className,
  variant,
  ...domProps
}: ComponentProps<"div"> & VariantProps<typeof pageWrapperVariants>) {
  return (
    <div
      className={cn(pageWrapperVariants({ variant }), className)}
      data-slot="page-wrapper"
      {...domProps}
    >
      {children}
    </div>
  );
}
