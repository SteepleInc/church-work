import * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";

import { cn } from "@/lib/utils";

type Mask = {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
};

const ScrollAreaContext = React.createContext(false);

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

function useTouchPrimary() {
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

const ScrollArea = React.forwardRef<
  HTMLDivElement,
  ScrollAreaPrimitive.Root.Props & {
    viewportClassName?: string;
    scrollAreaViewportRef?: React.Ref<HTMLDivElement>;
    maskHeight?: number;
    maskClassName?: string;
  }
>(
  (
    {
      className,
      children,
      viewportClassName,
      scrollAreaViewportRef,
      maskClassName,
      maskHeight = 30,
      ...props
    },
    ref,
  ) => {
    const [showMask, setShowMask] = React.useState<Mask>({
      bottom: false,
      left: false,
      right: false,
      top: false,
    });
    const viewportRef = React.useRef<HTMLDivElement>(null);
    const isTouch = useTouchPrimary();

    const mergedViewportRef = React.useMemo(
      () => mergeRefs([viewportRef, scrollAreaViewportRef]),
      [scrollAreaViewportRef],
    );

    const checkScrollability = React.useCallback(() => {
      const element = viewportRef.current;
      if (!element) {
        return;
      }

      const { scrollTop, scrollLeft, scrollWidth, clientWidth, scrollHeight, clientHeight } =
        element;
      setShowMask((prev) => ({
        ...prev,
        bottom: scrollTop + clientHeight < scrollHeight - 1,
        left: scrollLeft > 0,
        right: scrollLeft + clientWidth < scrollWidth - 1,
        top: scrollTop > 0,
      }));
    }, []);

    React.useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }

      const element = viewportRef.current;
      if (!element) {
        return;
      }

      const controller = new AbortController();
      const resizeObserver = new ResizeObserver(checkScrollability);
      resizeObserver.observe(element);

      element.addEventListener("scroll", checkScrollability, { signal: controller.signal });
      window.addEventListener("resize", checkScrollability, { signal: controller.signal });
      checkScrollability();

      return () => {
        controller.abort();
        resizeObserver.disconnect();
      };
    }, [checkScrollability]);

    const touchProps = props as React.HTMLAttributes<HTMLDivElement>;

    return (
      <ScrollAreaContext.Provider value={isTouch}>
        {isTouch ? (
          <div
            aria-roledescription="scroll area"
            className={cn("relative overflow-hidden", className)}
            data-slot="scroll-area"
            ref={ref}
            role="group"
            {...touchProps}
          >
            <div
              className={cn("size-full overflow-auto rounded-[inherit]", viewportClassName)}
              data-slot="scroll-area-viewport"
              ref={mergedViewportRef}
            >
              {children}
            </div>
            {maskHeight > 0 ? (
              <ScrollMask className={maskClassName} maskHeight={maskHeight} showMask={showMask} />
            ) : null}
          </div>
        ) : (
          <ScrollAreaPrimitive.Root
            className={cn("relative overflow-hidden", className)}
            data-slot="scroll-area"
            ref={ref}
            {...props}
          >
            <ScrollAreaPrimitive.Viewport
              className={cn("size-full rounded-[inherit]", viewportClassName)}
              data-slot="scroll-area-viewport"
              ref={mergedViewportRef}
            >
              {children}
            </ScrollAreaPrimitive.Viewport>
            {maskHeight > 0 ? (
              <ScrollMask className={maskClassName} maskHeight={maskHeight} showMask={showMask} />
            ) : null}
            <ScrollBar />
            <ScrollAreaPrimitive.Corner />
          </ScrollAreaPrimitive.Root>
        )}
      </ScrollAreaContext.Provider>
    );
  },
);

ScrollArea.displayName = "ScrollArea";

const ScrollBar = React.forwardRef<HTMLDivElement, ScrollAreaPrimitive.Scrollbar.Props>(
  ({ className, orientation = "vertical", ...props }, ref) => {
    const isTouch = React.useContext(ScrollAreaContext);

    if (isTouch) {
      return null;
    }

    return (
      <ScrollAreaPrimitive.Scrollbar
        className={cn(
          "flex touch-none p-px transition-colors select-none hover:bg-muted dark:hover:bg-muted/50",
          orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent",
          orientation === "horizontal" &&
            "h-2.5 flex-col border-t border-t-transparent px-1 pr-1.5",
          className,
        )}
        data-slot="scroll-area-scrollbar"
        orientation={orientation}
        ref={ref}
        {...props}
      >
        <ScrollAreaPrimitive.Thumb
          className={cn(
            "relative flex-1 origin-center rounded-full bg-border transition-transform",
            orientation === "vertical" && "my-1 active:scale-y-95",
            orientation === "horizontal" && "active:scale-x-98",
          )}
          data-slot="scroll-area-thumb"
        />
      </ScrollAreaPrimitive.Scrollbar>
    );
  },
);

ScrollBar.displayName = "ScrollBar";

function ScrollMask({
  showMask,
  maskHeight,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  showMask: Mask;
  maskHeight: number;
}) {
  return (
    <>
      <div
        {...props}
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 z-10",
          "before:absolute before:inset-x-0 before:top-0 before:transition-[height,opacity] before:duration-300 before:content-['']",
          "after:absolute after:inset-x-0 after:bottom-0 after:transition-[height,opacity] after:duration-300 after:content-['']",
          "before:h-(--top-fade-height) after:h-(--bottom-fade-height)",
          showMask.top ? "before:opacity-100" : "before:opacity-0",
          showMask.bottom ? "after:opacity-100" : "after:opacity-0",
          "before:bg-gradient-to-b before:from-background before:to-transparent",
          "after:bg-gradient-to-t after:from-background after:to-transparent",
          className,
        )}
        style={
          {
            "--bottom-fade-height": showMask.bottom ? `${maskHeight}px` : "0px",
            "--top-fade-height": showMask.top ? `${maskHeight}px` : "0px",
          } as React.CSSProperties
        }
      />
      <div
        {...props}
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 z-10",
          "before:absolute before:inset-y-0 before:left-0 before:transition-[width,opacity] before:duration-300 before:content-['']",
          "after:absolute after:inset-y-0 after:right-0 after:transition-[width,opacity] after:duration-300 after:content-['']",
          "before:w-(--left-fade-width) after:w-(--right-fade-width)",
          showMask.left ? "before:opacity-100" : "before:opacity-0",
          showMask.right ? "after:opacity-100" : "after:opacity-0",
          "before:bg-gradient-to-r before:from-background before:to-transparent",
          "after:bg-gradient-to-l after:from-background after:to-transparent",
          className,
        )}
        style={
          {
            "--left-fade-width": showMask.left ? `${maskHeight}px` : "0px",
            "--right-fade-width": showMask.right ? `${maskHeight}px` : "0px",
          } as React.CSSProperties
        }
      />
    </>
  );
}

export { ScrollArea, ScrollBar };
