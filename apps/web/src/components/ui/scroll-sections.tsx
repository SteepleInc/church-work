"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import * as React from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * ScrollSections — a generic scroll container of "sticky sections" whose headers
 * know their position relative to the fold and render themselves accordingly.
 *
 * The primitive bakes in no beacon/click/label policy: a Section's header is an
 * opaque consumer component that receives a `state`
 * (`pinned` | `above` | `below` | `in-view`) plus a `scrollIntoView` callback and
 * decides its own rendering. The consumer uses that state to express a pinned
 * header, an off-screen-below beacon, an active-window banner, etc.
 *
 * Architecture (see issue #327):
 * - `ScrollSections.Root` composes the existing `ScrollArea` (with its fade mask
 *   off — the fade moves into this primitive so it can sit *between* a pinned
 *   header and the scrolling content), owns a React context, a mutable ref-map
 *   registry (NOT React state), and the scroll engine over the viewport.
 * - `ScrollSections.Section` self-registers its ref + identity + order + header
 *   renderer into the registry and keeps its measured geometry fresh via a
 *   `ResizeObserver`.
 * - The engine reads the viewport scroll offset on every scroll frame, walks the
 *   registry, and writes the header-aware fade-seam offsets imperatively to the
 *   DOM. There are no React re-renders during scroll; the only discrete state is
 *   *which* section currently owns the top/bottom overlay (and which is pinned),
 *   which changes at most once per section-boundary crossing.
 *
 * Designed-for (not built here): a virtualizer can feed the same ref-map registry
 * for off-screen sections without changing this API (see issue #327).
 */

type SectionFoldState = "pinned" | "above" | "below" | "in-view";

type SectionRenderArgs = {
  readonly state: SectionFoldState;
  readonly scrollIntoView: () => void;
};

type SectionHeaderRenderer = (args: SectionRenderArgs) => React.ReactNode;

type SectionEntry = {
  readonly id: string;
  index: number;
  element: HTMLElement | null;
  headerElement: HTMLElement | null;
  renderHeader: SectionHeaderRenderer;
  /** Live measured offset of the section top within the scroll content. */
  start: number;
  /** Live measured section height. */
  size: number;
  /** Live measured header height (drives the fade-seam offset). */
  headerSize: number;
};

type OverlayState = {
  readonly top: string | null;
  readonly bottom: string | null;
  readonly pinned: string | null;
};

type ScrollSectionsContextValue = {
  registerSection: (entry: {
    readonly id: string;
    readonly index: number;
    readonly renderHeader: SectionHeaderRenderer;
  }) => void;
  unregisterSection: (id: string) => void;
  setSectionElement: (id: string, element: HTMLElement | null) => void;
  setHeaderElement: (id: string, element: HTMLElement | null) => void;
  scrollIntoView: (id: string) => void;
  pinnedId: string | null;
};

const ScrollSectionsContext = React.createContext<ScrollSectionsContextValue | null>(null);

function useScrollSectionsContext(component: string) {
  const context = React.useContext(ScrollSectionsContext);
  if (!context) {
    throw new Error(`${component} must be used within <ScrollSections.Root>.`);
  }
  return context;
}

// --- Root -------------------------------------------------------------------

type RootProps = {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly viewportClassName?: string;
  /** Height of the fade seam between a pinned header and the scrolling content. */
  readonly fadeHeight?: number;
  /**
   * Section id to bring into view once, after the first layout settles — used to
   * land the viewport on a meaningful section (e.g. the focus window) instead of
   * the top. Aligned to the start of the viewport (under any pinned header).
   */
  readonly initialSectionId?: string;
  /**
   * Reserve a gutter for the vertical scrollbar so it never overlaps full-bleed
   * content (e.g. edge-to-edge section header rules or grid columns). Off by
   * default: surfaces whose rows carry their own side margins don't need it.
   */
  readonly scrollbarGutter?: boolean;
};

function Root({
  children,
  className,
  viewportClassName,
  fadeHeight = 30,
  initialSectionId,
  scrollbarGutter = false,
}: RootProps) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  // The registry is a mutable ref-map: registering / measuring sections must not
  // re-render Root (see issue #327 performance contract).
  const registryRef = React.useRef<Map<string, SectionEntry>>(new Map());

  // Imperative handles for the fade seams, driven directly each scroll frame.
  const topSeamRef = React.useRef<HTMLDivElement>(null);
  const bottomSeamRef = React.useRef<HTMLDivElement>(null);

  // The only discrete, human-scale state: which section owns each overlay and
  // which in-flow header is pinned. Changes at most once per boundary crossing,
  // never per scroll frame.
  const [overlay, setOverlay] = React.useState<OverlayState>({
    bottom: null,
    pinned: null,
    top: null,
  });
  const overlayRef = React.useRef(overlay);
  overlayRef.current = overlay;

  const measure = React.useCallback((entry: SectionEntry, viewport: HTMLElement) => {
    if (!entry.element) return;
    // Measure positions relative to the scroll content (independent of the
    // current scroll position) via viewport-relative rects, so the math is
    // correct regardless of the section's offsetParent.
    const viewportRect = viewport.getBoundingClientRect();
    const rect = entry.element.getBoundingClientRect();
    entry.start = rect.top - viewportRect.top + viewport.scrollTop;
    entry.size = rect.height;
    entry.headerSize = entry.headerElement?.getBoundingClientRect().height ?? 0;
  }, []);

  const recompute = React.useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const scrollTop = viewport.scrollTop;
    const viewportHeight = viewport.clientHeight;
    const viewportBottom = scrollTop + viewportHeight;
    const maxScroll = viewport.scrollHeight - viewportHeight;

    const entries = [...registryRef.current.values()].sort((a, b) => a.index - b.index);
    for (const entry of entries) measure(entry, viewport);

    let pinned: SectionEntry | null = null;
    let above: SectionEntry | null = null;
    let below: SectionEntry | null = null;
    for (const entry of entries) {
      const top = entry.start;
      const bottom = entry.start + entry.size;
      if (top <= scrollTop && bottom > scrollTop) pinned = entry;
      if (bottom <= scrollTop) above = entry; // fully above the fold (last wins)
      if (top >= viewportBottom && !below) below = entry; // nearest below the fold
    }
    // The top-overlay candidate is a fully-above section (when nothing straddles
    // the top). When a section is pinned, its in-flow sticky header is already
    // visible, so the top overlay is not used.
    const topOverlay = pinned ? null : above;

    // Fade seams — imperative offset by the active header's live height.
    const pinnedHeaderHeight = pinned?.headerSize ?? topOverlay?.headerSize ?? 0;
    if (topSeamRef.current) {
      topSeamRef.current.style.transform = `translateY(${pinnedHeaderHeight}px)`;
      topSeamRef.current.style.opacity = scrollTop > 0 ? "1" : "0";
    }
    if (bottomSeamRef.current) {
      const bottomHeaderHeight = below?.headerSize ?? 0;
      bottomSeamRef.current.style.transform = `translateY(${-bottomHeaderHeight}px)`;
      bottomSeamRef.current.style.opacity = scrollTop < maxScroll - 1 ? "1" : "0";
    }

    // Discrete overlay identity — only setState on real change.
    const next: OverlayState = {
      bottom: below?.id ?? null,
      pinned: pinned?.id ?? null,
      top: topOverlay?.id ?? null,
    };
    const current = overlayRef.current;
    if (
      current.top !== next.top ||
      current.bottom !== next.bottom ||
      current.pinned !== next.pinned
    ) {
      setOverlay(next);
    }
  }, [measure]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        recompute();
      });
    };
    viewport.addEventListener("scroll", schedule, { passive: true });
    // Observe both the viewport and its scroll content: the viewport box may not
    // change when the list mounts or rows are added/removed, but the content
    // height does — and that shifts every section's position relative to the
    // fold.
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(viewport);
    if (viewport.firstElementChild) resizeObserver.observe(viewport.firstElementChild);
    schedule();
    return () => {
      viewport.removeEventListener("scroll", schedule);
      resizeObserver.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [recompute]);

  const scrollIntoView = React.useCallback((id: string) => {
    registryRef.current.get(id)?.element?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Land the viewport on the requested section once it (and the surrounding
  // content) has mounted and measured. Polls a few animation frames so the jump
  // happens after the first layout settles, then stops — later scrolling is the
  // user's. Uses the viewport's scrollTop directly (not scrollIntoView) so the
  // page around the scroll container never moves.
  const didInitialScrollRef = React.useRef(false);
  React.useEffect(() => {
    if (!initialSectionId || didInitialScrollRef.current) return;
    let frame = 0;
    let attempts = 0;
    const tryScroll = () => {
      const viewport = viewportRef.current;
      const entry = registryRef.current.get(initialSectionId);
      if (viewport && entry?.element) {
        recompute();
        viewport.scrollTop = Math.max(0, entry.start);
        didInitialScrollRef.current = true;
        return;
      }
      if (attempts++ < 20) frame = requestAnimationFrame(tryScroll);
    };
    frame = requestAnimationFrame(tryScroll);
    return () => cancelAnimationFrame(frame);
  }, [initialSectionId, recompute]);

  const registerSection = React.useCallback(
    ({ id, index, renderHeader }: Parameters<ScrollSectionsContextValue["registerSection"]>[0]) => {
      const existing = registryRef.current.get(id);
      if (existing) {
        existing.index = index;
        existing.renderHeader = renderHeader;
      } else {
        registryRef.current.set(id, {
          element: null,
          headerElement: null,
          headerSize: 0,
          id,
          index,
          renderHeader,
          size: 0,
          start: 0,
        });
      }
      recompute();
    },
    [recompute],
  );

  const setHeaderElement = React.useCallback(
    (id: string, element: HTMLElement | null) => {
      const entry = registryRef.current.get(id);
      if (entry) {
        entry.headerElement = element;
        recompute();
      }
    },
    [recompute],
  );

  const setSectionElement = React.useCallback(
    (id: string, element: HTMLElement | null) => {
      const entry = registryRef.current.get(id);
      if (entry) {
        entry.element = element;
        recompute();
      }
    },
    [recompute],
  );

  const unregisterSection = React.useCallback(
    (id: string) => {
      registryRef.current.delete(id);
      recompute();
    },
    [recompute],
  );

  const contextValue = React.useMemo<ScrollSectionsContextValue>(
    () => ({
      pinnedId: overlay.pinned,
      registerSection,
      scrollIntoView,
      setHeaderElement,
      setSectionElement,
      unregisterSection,
    }),
    [
      overlay.pinned,
      registerSection,
      scrollIntoView,
      setHeaderElement,
      setSectionElement,
      unregisterSection,
    ],
  );

  const fadeStyle = {
    "--scroll-sections-fade": `${fadeHeight}px`,
  } as React.CSSProperties;

  return (
    <ScrollSectionsContext.Provider value={contextValue}>
      <div
        className={cn("relative min-h-0 flex-1", className)}
        data-slot="scroll-sections"
        style={fadeStyle}
      >
        <ScrollArea
          className="size-full"
          maskHeight={0}
          scrollAreaViewportRef={viewportRef}
          scrollbarGutter={scrollbarGutter}
          scrollFade={false}
          viewportClassName={viewportClassName}
        >
          {children}
        </ScrollArea>

        {/* Header-aware fade seams: non-mask gradient layers sitting between a
            pinned header and the scrolling content, offset imperatively by the
            active header's live height (see recompute). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-[var(--scroll-sections-fade)] bg-gradient-to-b from-background to-transparent opacity-0 transition-opacity"
          ref={topSeamRef}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[var(--scroll-sections-fade)] bg-gradient-to-t from-background to-transparent opacity-0 transition-opacity"
          ref={bottomSeamRef}
        />

        {/* Overlay regions: the winning above/below section's header renders here
            in its fold-state. Pinned headers ride native sticky in-flow. */}
        <OverlaySlot
          edge="top"
          id={overlay.top}
          registryRef={registryRef}
          scrollIntoView={scrollIntoView}
        />
        <OverlaySlot
          edge="bottom"
          id={overlay.bottom}
          registryRef={registryRef}
          scrollIntoView={scrollIntoView}
        />
      </div>
    </ScrollSectionsContext.Provider>
  );
}

// --- Overlay slot -----------------------------------------------------------

function OverlaySlot({
  edge,
  id,
  registryRef,
  scrollIntoView,
}: {
  readonly edge: "top" | "bottom";
  readonly id: string | null;
  readonly registryRef: React.RefObject<Map<string, SectionEntry>>;
  readonly scrollIntoView: (id: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const entry = id ? registryRef.current.get(id) : undefined;

  const motionProps = reduceMotion
    ? {}
    : {
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: edge === "top" ? -6 : 6 },
        initial: { opacity: 0, y: edge === "top" ? -6 : 6 },
        transition: { duration: 0.15, ease: "easeOut" as const },
      };

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-10",
        edge === "top" ? "top-0" : "bottom-0",
      )}
    >
      <AnimatePresence>
        {entry && id ? (
          <motion.div className="pointer-events-auto" key={id} {...motionProps}>
            {entry.renderHeader({
              scrollIntoView: () => scrollIntoView(id),
              state: edge === "top" ? "above" : "below",
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// --- Section ----------------------------------------------------------------

type SectionProps = {
  readonly id: string;
  readonly index: number;
  /**
   * Renders the section's header. Receives the header's current fold-state and a
   * `scrollIntoView` callback. The same function renders the in-flow header and
   * (for above/below sections) the overlay header, so a single component can
   * decide its pinned style, its off-screen beacon, etc.
   */
  readonly header: SectionHeaderRenderer;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly "aria-label"?: string;
};

function Section({
  id,
  index,
  header,
  children,
  className,
  "aria-label": ariaLabel,
}: SectionProps) {
  const context = useScrollSectionsContext("ScrollSections.Section");
  const {
    pinnedId,
    registerSection,
    scrollIntoView: contextScrollIntoView,
    setHeaderElement,
    setSectionElement,
    unregisterSection,
  } = context;
  const sectionRef = React.useRef<HTMLElement>(null);
  const headerRef = React.useRef<HTMLDivElement>(null);

  // Keep a stable ref to the latest header renderer so the registry always calls
  // the current closure without re-registering on every render.
  const headerRendererRef = React.useRef(header);
  headerRendererRef.current = header;
  const stableRenderHeader = React.useCallback<SectionHeaderRenderer>(
    (args) => headerRendererRef.current(args),
    [],
  );

  // Register identity + order + renderer; re-register if order changes.
  React.useEffect(() => {
    registerSection({ id, index, renderHeader: stableRenderHeader });
    return () => unregisterSection(id);
  }, [id, index, registerSection, stableRenderHeader, unregisterSection]);

  // Hand the section + header elements to the registry and keep geometry fresh.
  React.useEffect(() => {
    setSectionElement(id, sectionRef.current);
    setHeaderElement(id, headerRef.current);
    const observed = sectionRef.current;
    if (!observed) return;
    const resizeObserver = new ResizeObserver(() => {
      setSectionElement(id, sectionRef.current);
      setHeaderElement(id, headerRef.current);
    });
    resizeObserver.observe(observed);
    return () => resizeObserver.disconnect();
  }, [id, setHeaderElement, setSectionElement]);

  const isPinned = pinnedId === id;
  const scrollIntoView = React.useCallback(
    () => contextScrollIntoView(id),
    [contextScrollIntoView, id],
  );

  return (
    <section aria-label={ariaLabel} className={cn("flex flex-col", className)} ref={sectionRef}>
      <div className="sticky top-0 z-[6]" ref={headerRef}>
        {header({ scrollIntoView, state: isPinned ? "pinned" : "in-view" })}
      </div>
      {children}
    </section>
  );
}

export const ScrollSections = {
  Root,
  Section,
};

export type { SectionFoldState, SectionRenderArgs };
