"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import * as React from "react";
import { cn } from "@/lib/utils";

function mergeRefs<T>(refs: Array<React.Ref<T> | undefined>) {
  return (value: T) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref) {
        ref.current = value;
      }
    }
  };
}

export function useTouchPrimary() {
  const [isTouch, setIsTouch] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(query.matches);
    update();
    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, []);

  return isTouch;
}

type ScrollAreaProps = ScrollAreaPrimitive.Root.Props & {
  scrollFade?: boolean;
  scrollbarGutter?: boolean;
  fill?: boolean;
  clampContentMinWidth?: boolean;
  viewportClassName?: string;
  scrollAreaViewportRef?: React.Ref<HTMLDivElement>;
  maskHeight?: number;
  maskClassName?: string;
};

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  (
    {
      className,
      children,
      scrollFade,
      scrollbarGutter = false,
      fill = false,
      clampContentMinWidth = true,
      viewportClassName,
      scrollAreaViewportRef,
      maskHeight = 30,
      maskClassName,
      style,
      ...props
    },
    ref,
  ): React.ReactElement => {
    const viewportRef = React.useRef<HTMLDivElement>(null);
    const mergedViewportRef = React.useMemo(
      () => mergeRefs([viewportRef, scrollAreaViewportRef]),
      [scrollAreaViewportRef],
    );
    const shouldFade = scrollFade ?? maskHeight > 0;
    const rootStyle: React.CSSProperties & { "--fade-size": string } = {
      "--fade-size": `${maskHeight}px`,
      ...style,
    };

    return (
      <ScrollAreaPrimitive.Root
        className={cn("size-full min-h-0", className)}
        data-slot="scroll-area"
        ref={ref}
        style={rootStyle}
        {...props}
      >
        <ScrollAreaPrimitive.Viewport
          className={cn(
            "h-full rounded-[inherit] outline-none transition-shadows focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-has-overflow-y:overscroll-y-contain data-has-overflow-x:overscroll-x-contain",
            shouldFade &&
              "mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start)))] mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end)))] mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start)))] mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end)))]",
            scrollbarGutter && "data-has-overflow-y:pe-2.5 data-has-overflow-x:pb-2.5",
            maskClassName,
            viewportClassName,
          )}
          data-slot="scroll-area-viewport"
          ref={mergedViewportRef}
        >
          <ScrollAreaPrimitive.Content
            className={cn(fill && "size-full")}
            data-slot="scroll-area-content"
            style={clampContentMinWidth ? { minWidth: 0 } : undefined}
          >
            {children}
          </ScrollAreaPrimitive.Content>
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar orientation="vertical" />
        <ScrollBar orientation="horizontal" />
        <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
      </ScrollAreaPrimitive.Root>
    );
  },
);

ScrollArea.displayName = "ScrollArea";

const ScrollBar = React.forwardRef<HTMLDivElement, ScrollAreaPrimitive.Scrollbar.Props>(
  ({ className, orientation = "vertical", ...props }, ref): React.ReactElement => {
    return (
      <ScrollAreaPrimitive.Scrollbar
        className={cn(
          "m-1 flex opacity-0 transition-opacity delay-300 data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:w-1.5 data-[orientation=horizontal]:flex-col data-hovering:opacity-100 data-scrolling:opacity-100 data-hovering:delay-0 data-scrolling:delay-0 data-hovering:duration-100 data-scrolling:duration-100",
          className,
        )}
        data-slot="scroll-area-scrollbar"
        orientation={orientation}
        ref={ref}
        {...props}
      >
        <ScrollAreaPrimitive.Thumb
          className="relative flex-1 rounded-full bg-foreground/20"
          data-slot="scroll-area-thumb"
        />
      </ScrollAreaPrimitive.Scrollbar>
    );
  },
);

ScrollBar.displayName = "ScrollBar";

export { ScrollArea, ScrollAreaPrimitive, ScrollBar };
