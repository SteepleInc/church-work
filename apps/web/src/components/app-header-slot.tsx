import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A portal seam between the page and the app's top header. The shell renders a
 * single anchor in the header and shares it through this context; a page can
 * then mount header-level chrome — like the Linear-style Week switcher on the
 * Team Week board — into the header from deep inside its own tree, without the
 * shell needing any per-page data. When no page fills it, the shell falls back
 * to its default breadcrumb.
 */

type AppHeaderSlotContextValue = {
  readonly node: HTMLElement | null;
  readonly setNode: (node: HTMLElement | null) => void;
  readonly filled: boolean;
  readonly setFilled: (filled: boolean) => void;
};

const AppHeaderSlotContext = createContext<AppHeaderSlotContextValue | null>(null);

export function AppHeaderSlotProvider({ children }: { readonly children: ReactNode }) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [filled, setFilled] = useState(false);

  return (
    <AppHeaderSlotContext.Provider value={{ node, setNode, filled, setFilled }}>
      {children}
    </AppHeaderSlotContext.Provider>
  );
}

/**
 * The header anchor itself, rendered once by the shell. While a page has filled
 * the slot, the shell's default content (passed as children) is hidden so the
 * two never stack.
 */
export function AppHeaderSlotAnchor({ children }: { readonly children: ReactNode }) {
  const context = useContext(AppHeaderSlotContext);
  if (!context) return <>{children}</>;

  return (
    <>
      <div ref={context.setNode} className="flex min-w-0 items-center" />
      {context.filled ? null : children}
    </>
  );
}

/**
 * Render `children` into the app header. Mount it from a page (e.g. the Team
 * Week board) to replace the default header breadcrumb with page-specific
 * chrome for as long as that page is mounted.
 */
export function AppHeaderSlot({ children }: { readonly children: ReactNode }) {
  const context = useContext(AppHeaderSlotContext);
  const setFilled = context?.setFilled;

  // Flag the slot as filled while mounted so the shell hides its fallback, and
  // clear it on unmount so the breadcrumb returns.
  useEffect(() => {
    if (!setFilled) return;
    setFilled(true);
    return () => setFilled(false);
  }, [setFilled]);

  if (!context?.node) return null;
  return createPortal(children, context.node);
}
