import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { motion, useInView } from "motion/react";
import type { ReactNode } from "react";
import { createContext, useContext, useRef } from "react";

import {
  CHURCH_WORK_WORDMARK_PATH_COUNT,
  ChurchWorkLogoMark,
  ChurchWorkWordmarkSvg,
} from "@/components/church-work-logo";
import UserMenu from "@/components/user-menu";
import { useSession } from "@/hooks/use-session";

// The persistent marketing scroll surface is an inner container, so it's
// registered with the router's scroll restoration (see router.tsx, which lists
// this id in scrollToTopSelectors) — forward navigations start at the top,
// back/forward restore the previous position.
export const MARKETING_SCROLL_ID = "marketing-scroll";

/* ------------------------------------------------------------------ */
/* Easing tokens — shared across the marketing pages                   */
/* ------------------------------------------------------------------ */

export const RISE_EASE = [0.25, 1, 0.5, 1] as const;
export const BACK_OUT = [0.34, 1.56, 0.64, 1] as const;

/* ------------------------------------------------------------------ */
/* Header timing — the single source of truth                          */
/*                                                                     */
/* The header is the first thing that animates on a cold load, and the */
/* page heroes enter *after* it. Rather than each page guessing how     */
/* long the header takes with magic delays, the header's transitions    */
/* are derived from these constants and the same numbers yield          */
/* HEADER_SETTLE — the moment the last header element comes to rest.    */
/* Change a value here and both the header and every page that waits on */
/* it stay in sync.                                                     */
/* ------------------------------------------------------------------ */

const HEADER_TIMING = {
  logo: { delay: 0, duration: 0.5 },
  // Wordmark animates SVG path by SVG path; the last path starts at
  // wordmark.delay + (paths - 1) * wordmark.stagger.
  wordmark: { delay: 0.5, stagger: 0.06, duration: 0.6 },
  nav: { delay: 1.0, stagger: 0.08, duration: 0.5 },
  button: { delay: 1.3, duration: 0.5 },
} as const;

type NavKey = "home" | "how" | "product" | "pricing";

const NAV_LINKS: ReadonlyArray<{
  key: NavKey;
  label: string;
  to: string;
  chevron?: boolean;
}> = [
  { key: "home", label: "Home", to: "/" },
  { key: "how", label: "How it works", to: "/" },
  { key: "product", label: "Product", to: "/", chevron: true },
  { key: "pricing", label: "Pricing", to: "/pricing" },
];

// When the last-finishing header element comes to rest (seconds from load).
export const HEADER_SETTLE = Math.max(
  HEADER_TIMING.logo.delay + HEADER_TIMING.logo.duration,
  HEADER_TIMING.wordmark.delay +
    (CHURCH_WORK_WORDMARK_PATH_COUNT - 1) * HEADER_TIMING.wordmark.stagger +
    HEADER_TIMING.wordmark.duration,
  HEADER_TIMING.nav.delay +
    (NAV_LINKS.length - 1) * HEADER_TIMING.nav.stagger +
    HEADER_TIMING.nav.duration,
  HEADER_TIMING.button.delay + HEADER_TIMING.button.duration,
);

/* ------------------------------------------------------------------ */
/* Header entrance coordination                                        */
/*                                                                     */
/* The header lives in the persistent shell and only animates on the   */
/* first cold load — on client-side navigation it's already at rest.   */
/* So pages don't ask "how long is the header?", they ask "how much of  */
/* the header animation is still ahead of *me*?". A page that mounts    */
/* during the cold load gets the full HEADER_SETTLE offset; a page that */
/* mounts after navigation gets 0 and enters immediately.              */
/* ------------------------------------------------------------------ */

type HeaderEntrance = {
  /** Seconds until the header finishes, relative to when the page mounted. */
  readonly headerSettle: number;
};

// The shell publishes the timestamp at which the header began animating (its
// own first mount). null on the server, where there is no clock to compare to.
const HeaderStartedAtContext = createContext<number | null>(null);

function now(): number {
  return typeof performance === "undefined" ? 0 : performance.now();
}

/**
 * Read how long this page should wait for the header to settle before starting
 * its own load animation. Returns 0 once the header is already at rest (i.e.
 * after client-side navigation), so subsequent pages enter without delay.
 */
export function useHeaderEntrance(): HeaderEntrance {
  const startedAt = useContext(HeaderStartedAtContext);
  // Freeze the remaining settle at this page's first render so the value is
  // stable for the life of the page (animations shouldn't see it change).
  const settleRef = useRef<number | null>(null);
  if (settleRef.current === null) {
    if (startedAt === null) {
      // Server render (or no shell): assume a cold load so SSR markup matches
      // the client's first paint, where the header is mid-animation.
      settleRef.current = HEADER_SETTLE;
    } else {
      const elapsedSec = (now() - startedAt) / 1000;
      settleRef.current = Math.max(0, HEADER_SETTLE - elapsedSec);
    }
  }
  return { headerSettle: settleRef.current };
}

/* ------------------------------------------------------------------ */
/* Scroll reveal — a single quiet rise, respects reduced motion in CSS */
/* ------------------------------------------------------------------ */

export function Reveal({
  children,
  className,
  delay = 0,
  holdUntil = 0,
  as = "div",
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly delay?: number;
  /**
   * Minimum delay (ms) to apply only when this element is already in view on
   * first mount — used to hold a section back until a page-load hero above it
   * has finished animating, so the two don't reveal at the same time. Once the
   * user has scrolled it into view, the ordinary {@link delay} applies instead.
   */
  readonly holdUntil?: number;
  readonly as?: "div" | "li";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-12% 0px", once: true });
  // Capture when this Reveal mounted. If it comes into view within the hero's
  // load window (i.e. it was on-screen at load, not scrolled to), apply the
  // hold so it doesn't reveal on top of the still-animating hero above it.
  const mountedAt = useRef<number>(typeof performance === "undefined" ? 0 : performance.now());
  const cameInDuringLoad = useRef<boolean | null>(null);
  if (holdUntil > 0 && inView && cameInDuringLoad.current === null) {
    const elapsed =
      (typeof performance === "undefined" ? 0 : performance.now()) - mountedAt.current;
    cameInDuringLoad.current = elapsed < holdUntil;
  }
  const effectiveDelay = cameInDuringLoad.current ? Math.max(delay, holdUntil) : delay;
  const Tag = as;
  return (
    <Tag
      className={`cw-reveal${className ? ` ${className}` : ""}`}
      data-shown={inView ? "true" : "false"}
      ref={ref as never}
      style={{ transitionDelay: `${effectiveDelay}ms` }}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

export function ChevronDown({ className }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      height={12}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
      width={12}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Header — shared site chrome, parameterized by the active page       */
/* ------------------------------------------------------------------ */

function activeFromPathname(pathname: string): NavKey {
  return pathname.startsWith("/pricing") ? "pricing" : "home";
}

function Header() {
  // Derive the active link from the live route so the header can live in the
  // persistent layout and never re-mount (or re-animate) on navigation.
  const active = useRouterState({
    select: (state) => activeFromPathname(state.location.pathname),
  });
  const { session } = useSession();
  return (
    <header className="mx-auto flex max-w-[1400px] items-center justify-between px-6 pt-6 md:px-10 md:pt-8">
      {/* Logo group */}
      <Link className="flex items-center" style={{ gap: "9.23px" }} to="/">
        <motion.div
          aria-hidden="true"
          animate={{ scale: 1 }}
          className="size-[38px] shrink-0"
          initial={{ scale: 0 }}
          transition={{ duration: HEADER_TIMING.logo.duration, ease: BACK_OUT }}
        >
          <ChurchWorkLogoMark className="size-full" />
        </motion.div>
        <ChurchWorkWordmarkSvg
          animated
          className="h-[24px] w-[168px] overflow-visible"
          pathDelay={HEADER_TIMING.wordmark.delay}
          pathDuration={HEADER_TIMING.wordmark.duration}
          pathEase={[...RISE_EASE]}
          pathStagger={HEADER_TIMING.wordmark.stagger}
        />
      </Link>

      {/* Center nav */}
      <nav className="hidden items-center gap-[36px] md:flex">
        {NAV_LINKS.map((link, i) => {
          const isActive = link.key === active;
          return (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 20 }}
              key={link.key}
              transition={{
                delay: HEADER_TIMING.nav.delay + i * HEADER_TIMING.nav.stagger,
                duration: HEADER_TIMING.nav.duration,
              }}
            >
              <Link
                className={`flex items-center gap-1 font-medium text-[15px] transition-colors ${
                  isActive ? "text-mkt-fg" : "text-mkt-muted hover:text-mkt-fg"
                }`}
                style={
                  isActive
                    ? {
                        textDecoration: "underline",
                        textDecorationThickness: "1.5px",
                        textUnderlineOffset: "6px",
                      }
                    : undefined
                }
                to={link.to}
              >
                {link.label}
                {link.chevron ? <ChevronDown /> : null}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Account actions */}
      {session ? (
        <div className="flex items-center gap-[28px]">
          <motion.div
            animate={{ filter: "blur(0px)", opacity: 1 }}
            initial={{ filter: "blur(8px)", opacity: 0 }}
            transition={{ delay: HEADER_TIMING.button.delay, duration: 1 }}
          >
            <Link
              className="flex items-center gap-1 font-medium text-[15px] text-mkt-muted transition-colors hover:text-mkt-fg"
              to="/my-work"
            >
              Dashboard
            </Link>
          </motion.div>
          <motion.div
            animate={{ filter: "blur(0px)", opacity: 1 }}
            initial={{ filter: "blur(8px)", opacity: 0 }}
            transition={{ delay: HEADER_TIMING.button.delay + 0.2, duration: 1 }}
          >
            <UserMenu />
          </motion.div>
        </div>
      ) : (
        /* Get started */
        <motion.button
          animate={{ scale: 1 }}
          className="rounded-full border border-mkt-border bg-white px-5 py-[10px] font-medium text-[14px] text-mkt-fg transition-colors hover:bg-mkt-card"
          initial={{ scale: 0 }}
          style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}
          transition={{
            delay: HEADER_TIMING.button.delay,
            duration: HEADER_TIMING.button.duration,
            ease: BACK_OUT,
          }}
          type="button"
        >
          Get started
        </motion.button>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* MarketingShell — the persistent light surface for the home and      */
/* pricing pages. It owns the scroll wrapper and the Header, so the     */
/* header animates once on first load and stays put across navigation   */
/* between Home and Pricing (no re-animation, no flash).                */
/* ------------------------------------------------------------------ */

export function MarketingShell() {
  // The shell mounts once on cold load, at the same moment the header begins
  // its entrance, and persists across navigation — so its first-render time is
  // the header's start time. Pages read this to coordinate their own entrance.
  const headerStartedAt = useRef<number>(now());
  return (
    <HeaderStartedAtContext.Provider value={headerStartedAt.current}>
      <div
        className="marketing-page min-h-0 w-full flex-1 overflow-y-auto bg-mkt-bg text-mkt-fg"
        data-scroll-restoration-id={MARKETING_SCROLL_ID}
      >
        <Header />
        <Outlet />
      </div>
    </HeaderStartedAtContext.Provider>
  );
}
