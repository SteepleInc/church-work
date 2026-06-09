import { type RefObject, useEffect, useState } from "react";

export function useElementSize<T extends HTMLElement | null>(ref?: RefObject<T>) {
  const [size, setSize] = useState<{
    width: number | undefined;
    height: number | undefined;
  }>({ height: undefined, width: undefined });

  useEffect(() => {
    if (!ref) {
      return;
    }

    let resizeObserver: ResizeObserver | null = null;

    const updateSize = () => {
      const element = ref.current;
      if (!element) {
        return;
      }

      const { offsetWidth, offsetHeight } = element;

      // Ignore zero dimensions - element is likely hidden or not yet laid out
      if (offsetWidth === 0 && offsetHeight === 0) {
        return;
      }

      setSize((prev) => {
        if (prev.width === offsetWidth && prev.height === offsetHeight) {
          return prev;
        }
        return {
          height: offsetHeight,
          width: offsetWidth,
        };
      });
    };

    const setupObserver = () => {
      const element = ref.current;
      if (!element) {
        return;
      }

      // Initialize size
      updateSize();

      // Create a ResizeObserver to track size changes
      resizeObserver = new ResizeObserver(() => {
        updateSize();
      });

      // Start observing the element
      resizeObserver.observe(element);
    };

    // Try to set up immediately
    setupObserver();

    // Listen for window resize to update size and also to catch
    // cases where the element becomes available after mount
    const handleResize = () => {
      if (!resizeObserver && ref.current) {
        setupObserver();
      }
      updateSize();
    };

    window.addEventListener("resize", handleResize);

    // Clean up
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [ref]);

  return size;
}
