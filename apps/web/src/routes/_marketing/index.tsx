import { createFileRoute } from "@tanstack/react-router";
import { LibraryBig, Repeat2 } from "lucide-react";
import { motion, useInView } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import browserMockup from "@/assets/browser-mockup.png";
import farmerImage from "@/assets/farmer.png";
import frame207 from "@/assets/frame-207.svg";
import programmingArrow from "@/assets/programming-arrow.svg";

import {
  BoardColumnPresentation,
  type PresentationTask,
  ProductFrame,
  TaskRowPresentation,
  TemplateProjectionPresentation,
  type TemplateProjectionWeek,
} from "@/components/tasks/task-presentation";

import { BACK_OUT, Reveal, RISE_EASE, useHeaderEntrance } from "./-marketing-shell";

export const Route = createFileRoute("/_marketing/")({
  component: HomePage,
  head: () => ({
    meta: [
      {
        title: "Church Work — Shared task clarity for church teams",
      },
      {
        name: "description",
        content:
          "Cycles, Templates & Teams. Coordinate recurring and project-based church work — without another spreadsheet — so every team knows what's next.",
      },
    ],
  }),
});

/* ------------------------------------------------------------------ */
/* AnimatedWords                                                       */
/* ------------------------------------------------------------------ */

function AnimatedWords({
  text,
  className,
  delayStart = 0,
  stagger = 0.06,
  inView = false,
}: {
  readonly text: string;
  readonly className?: string;
  readonly delayStart?: number;
  readonly stagger?: number;
  readonly inView?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { margin: "-80px", once: true });
  const animate = inView ? isInView : true;
  const words = text.split(" ");

  return (
    <span className={className} ref={ref}>
      {words.map((word, i) => (
        <span
          className="inline-block overflow-hidden align-bottom"
          key={`${word}-${i}`}
          style={{ paddingBottom: "0.2em" }}
        >
          <motion.span
            animate={animate ? { opacity: 1, y: "0%" } : undefined}
            className="inline-block"
            initial={{ opacity: 0, y: "110%" }}
            transition={{
              delay: delayStart + i * stagger,
              duration: 0.6,
              ease: RISE_EASE,
            }}
          >
            {word}
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* AnimatedDottedFrame                                                 */
/* ------------------------------------------------------------------ */

function AnimatedDottedFrame({
  className,
  style,
  startDelay = 0,
}: {
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly startDelay?: number;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const [dots, setDots] = useState<ReadonlyArray<{ x: number; y: number }>>([]);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    const next: Array<{ x: number; y: number }> = [];
    for (let d = 2; d <= total; d += 4) {
      const p = path.getPointAtLength(d);
      next.push({ x: p.x, y: p.y });
    }
    setDots(next);
  }, []);

  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      height={107}
      style={style}
      viewBox="0 0 141 107"
      width={141}
    >
      <path
        d="M140.75 3.75H5.75C2.98857 3.75 0.75 5.98858 0.75 8.75V95.75C0.75 98.5114 2.98858 100.75 5.75 100.75H40"
        ref={pathRef}
      />
      {dots.map((dot, i) => (
        <circle
          className="dot-pop"
          cx={dot.x}
          cy={dot.y}
          fill="#FFFFFF"
          key={i}
          r={1.5}
          style={{ animationDelay: `${startDelay + i * 40}ms` }}
        />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

function StarIcon({ half = false }: { readonly half?: boolean }) {
  const d =
    "M12 2.5l2.95 6.2 6.8.78-5.05 4.66 1.4 6.66L12 17.6l-6.1 3.2 1.4-6.66L2.25 9.48l6.8-.78L12 2.5z";
  return (
    <svg className="star" fill="currentColor" height={16} viewBox="0 0 24 24" width={16}>
      {half ? (
        <>
          <defs>
            <linearGradient id="half-star">
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="50%" stopColor="rgba(0,0,0,0.15)" />
            </linearGradient>
          </defs>
          <path d={d} fill="url(#half-star)" />
        </>
      ) : (
        <path d={d} />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Trusted-by wordmarks (Inter Tight text marks, white)               */
/* ------------------------------------------------------------------ */

function BrandWordmark({ children }: { readonly children: ReactNode }) {
  return (
    <span
      className="whitespace-nowrap font-semibold text-[20px] text-white/90 leading-none tracking-tight"
      style={{ fontFamily: '"Inter Tight", sans-serif' }}
    >
      {children}
    </span>
  );
}

const TRUSTED_CHURCHES = [
  "Grace City",
  "Hillside Church",
  "Redeemer",
  "New Life",
  "Cornerstone",
] as const;

function TrustedByGroup() {
  return (
    <div className="flex items-center gap-[40px] pr-[40px]">
      {TRUSTED_CHURCHES.map((name) => (
        <BrandWordmark key={name}>{name}</BrandWordmark>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

// The hero's load cascade is timed relative to the header settling, so it picks
// up wherever the header leaves off. Each value is an offset (seconds) from
// `base`, which is `headerSettle` on a cold load and 0 after navigation.
const HERO_OFFSET = {
  eyebrow: -0.3,
  h1Line1: -0.1,
  h1Line2: 0.15,
  h1Tail: 0.3,
  video: 0.35,
  subhead: 0.7,
  ctaPrimary: 0.9,
  ctaSecondary: 1.0,
  showcase: 1.2,
} as const;

// The showcase's internal choreography (cards, popover, dotted frame) is
// authored against this absolute cold-load delay. Showcase derives a `shift`
// from the live `base` so the whole block slides together while keeping its
// internal timing intact.
const SHOWCASE_BASELINE = 3.0;

function Hero({ base }: { readonly base: number }) {
  // Never start before the page mounts, even when base is small post-navigation.
  const at = (offset: number) => Math.max(0, base + offset);
  return (
    <section className="mx-auto max-w-[1400px] px-6 pt-16 text-center md:px-10 md:pt-24">
      {/* Eyebrow pill */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="inline-flex items-center rounded-[8px]"
        initial={{ opacity: 0, y: 30 }}
        style={{
          backgroundColor: "rgba(192,192,192,0.17)",
          gap: "10px",
          padding: "4px 11px 4px 4px",
        }}
        transition={{
          delay: at(HERO_OFFSET.eyebrow),
          duration: 0.8,
          ease: "easeOut",
        }}
      >
        <span
          className="flex items-center justify-center rounded-[6px] bg-mkt-bg text-mkt-fg"
          style={{ height: 22, width: 28 }}
        >
          <svg fill="none" height={12} viewBox="0 0 12 10" width={14}>
            <path
              d="M5.71198 0L9.56198 9.982H7.686L6.734 7.336H2.786L1.806 9.982H0L3.85 0H5.71198ZM6.272 6.02L4.788 1.82L3.234 6.02H6.272ZM11.998 0.014V9.982H10.234V0.014H11.998Z"
              fill="currentColor"
              opacity={0.85}
            />
          </svg>
        </span>
        <span className="text-[14px]">Cycles, Templates &amp; Teams</span>
      </motion.div>

      {/* H1 */}
      <h1
        className="mx-auto mt-6 max-w-[1100px] font-medium text-[64px] md:text-[88px]"
        style={{ letterSpacing: "-0.035em", lineHeight: 1.05 }}
      >
        <span className="block">
          <AnimatedWords
            delayStart={at(HERO_OFFSET.h1Line1)}
            stagger={0.05}
            text="Built for ministry"
          />
        </span>
        <span className="block">
          <AnimatedWords delayStart={at(HERO_OFFSET.h1Line2)} stagger={0.05} text="not" />{" "}
          <motion.img
            alt="Farmer"
            animate={{ scale: 1 }}
            className="inline-block h-[56px] w-[56px] -translate-y-[0.2em] object-contain align-middle md:h-[64px] md:w-[64px]"
            initial={{ scale: 0 }}
            src={farmerImage}
            transition={{
              delay: at(HERO_OFFSET.video),
              duration: 0.6,
              ease: BACK_OUT,
            }}
          />{" "}
          <AnimatedWords
            className="text-mkt-fg/25"
            delayStart={at(HERO_OFFSET.h1Tail)}
            stagger={0.05}
            text="projects"
          />
        </span>
      </h1>

      {/* Subheading */}
      <motion.p
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto mt-8 max-w-[760px] text-[18px] text-mkt-muted"
        initial={{ opacity: 0, y: 30 }}
        style={{ lineHeight: 1.5 }}
        transition={{
          delay: at(HERO_OFFSET.subhead),
          duration: 0.8,
          ease: "easeOut",
        }}
      >
        Most task managers help you complete one and done projects. Church Work helps you lead recurring ministry. Build repeatable templates for your weekly services, big events like Christmas and Easter, and your monthly rhythms.
        {/* Built for how church work actually happens. It recurs every week. It spans every team. It
        slips through the cracks. Church Work turns Templates, Cycles, and Tasks into one shared
        plan — so everyone knows what's next. */}
      </motion.p>

      {/* CTA row */}
      <div className="mt-10 flex items-center justify-center gap-3">
        <motion.button
          animate={{ scale: 1 }}
          className="rounded-full border border-mkt-border bg-mkt-bg px-6 py-3 font-medium text-[15px] text-mkt-fg transition-colors hover:bg-mkt-card"
          initial={{ scale: 0 }}
          style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}
          transition={{
            delay: at(HERO_OFFSET.ctaPrimary),
            duration: 0.5,
            ease: BACK_OUT,
          }}
          type="button"
        >
          Book a demo
        </motion.button>
        <motion.button
          animate={{ scale: 1 }}
          className="rounded-full px-6 py-3 font-semibold text-[15px] text-mkt-fg"
          initial={{ scale: 0 }}
          style={{ backgroundColor: "oklch(0.88 0.18 95)" }}
          transition={{
            delay: at(HERO_OFFSET.ctaSecondary),
            duration: 0.5,
            ease: BACK_OUT,
          }}
          type="button"
          whileHover={{ scale: 1.02 }}
        >
          Get started
        </motion.button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Showcase                                                            */
/* ------------------------------------------------------------------ */

const KEY_FEATURES = [
  { active: false, label: "My Work & Our Work" },
  { active: false, label: "Templates & Schedules" },
  { active: true, label: "Cycles & Weeks" },
  { active: false, label: "Boards & Insights" },
  { active: false, label: "Teams & Workflows" },
] as const;

function CheckIcon() {
  return (
    <svg
      fill="none"
      height={8}
      stroke="#FFFFFF"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={4}
      viewBox="0 0 24 24"
      width={8}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SeamDot({ style }: { readonly style?: CSSProperties }) {
  return (
    <span
      className="absolute block rounded-full bg-white"
      style={{
        backgroundClip: "content-box",
        border: "2px solid rgba(255,255,255,0.12)",
        height: 8,
        width: 8,
        ...style,
      }}
    />
  );
}

function LeftCard({ shift }: { readonly shift: number }) {
  const at = (delay: number) => Math.max(0, delay + shift);
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[22px] bg-mkt-surface p-6 text-white md:p-7"
      initial={{ opacity: 0, y: 40 }}
      style={{ minHeight: 360 }}
      transition={{ delay: at(3.2), duration: 0.8, ease: "easeOut" }}
    >
      <div className="relative z-20 flex h-full flex-col md:max-w-[55%]">
        {/* Pro pill */}
        <motion.span
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-center font-medium text-[12px]"
          initial={{ opacity: 0.2, scale: 2.4 }}
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 6,
            color: "#111114",
            height: 22,
            width: 36,
          }}
          transition={{ delay: at(3.45), duration: 0.7, ease: RISE_EASE }}
        >
          Plan
        </motion.span>

        {/* Heading */}
        <h3
          className="mt-5 font-medium text-[28px] tracking-tight text-white"
          style={{ lineHeight: 1.15 }}
        >
          <span className="block">
            <AnimatedWords delayStart={at(3.6)} text="One Shared Plan" />
          </span>
          <span className="block">
            <AnimatedWords delayStart={at(3.75)} text="for Church Work" />
          </span>
        </h3>

        {/* Bottom paragraph */}
        <p
          className="mt-auto pt-6 text-[16px]"
          style={{ color: "rgba(255,255,255,0.36)", lineHeight: "19px" }}
        >
          From recurring Templates to weekly Cycles,
          <br />
          every team sees what's next.
        </p>
      </div>

      {/* Floating browser mockup (md+) */}
      <div className="absolute right-0 bottom-0 hidden md:block" style={{ width: 330 }}>
        <SeamDot style={{ left: 1, top: 40 }} />
        <AnimatedDottedFrame
          startDelay={Math.max(0, 4200 + shift * 1000)}
          style={{ left: -135.75, position: "absolute", top: 43.25 }}
        />
        <img
          alt="Church Work dashboard"
          className="w-full"
          src={browserMockup}
          style={{ filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.45))" }}
        />
      </div>

      {/* Key Features popover (md+) */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="absolute z-10 hidden flex-col md:flex"
        initial={{ opacity: 0, y: 30 }}
        style={{
          backdropFilter: "blur(214.5px)",
          background:
            "linear-gradient(164deg, rgba(255,255,255,0.04) 14.62%, rgba(255,255,255,0.40) 85.2%)",
          border: "1px solid rgba(255,255,255,0.34)",
          borderRadius: 13.654,
          bottom: -24,
          height: 222,
          padding: 12,
          right: 214,
          width: 210,
        }}
        transition={{ delay: at(3.95), duration: 0.8, ease: "easeOut" }}
      >
        {/* Header */}
        <div className="mb-2 flex items-center gap-2">
          <img alt="" height={14} src={programmingArrow} width={14} />
          <span className="font-medium text-[13px] text-white">Key Features</span>
        </div>

        {/* Divider */}
        <div
          className="relative mb-2 h-px"
          style={{
            background: "rgba(255,255,255,0.19)",
            marginLeft: -12,
            marginRight: -12,
          }}
        >
          <SeamDot style={{ left: -4, top: -4 }} />
        </div>

        {/* List */}
        <div className="flex flex-col gap-1">
          {KEY_FEATURES.map((feature) => (
            <div
              className="flex items-center gap-2"
              key={feature.label}
              style={
                feature.active
                  ? {
                    background: "#F4F4F4",
                    borderRadius: 4.312,
                    padding: "6px 4px",
                  }
                  : { padding: "6px 4px" }
              }
            >
              {feature.active ? (
                <span
                  className="flex items-center justify-center"
                  style={{
                    background: "#FFD209",
                    borderRadius: 1.006,
                    height: 12,
                    width: 12,
                  }}
                >
                  <CheckIcon />
                </span>
              ) : (
                <span className="rounded-[3px] bg-white/15" style={{ height: 12, width: 12 }} />
              )}
              <span
                className="font-medium text-[12px]"
                style={feature.active ? { color: "#111114" } : { color: "rgba(255,255,255,0.9)" }}
              >
                {feature.label}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function RightCard({ shift }: { readonly shift: number }) {
  const at = (delay: number) => Math.max(0, delay + shift);
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-[22px] bg-mkt-bg p-6 md:p-7"
      initial={{ opacity: 0, y: 40 }}
      style={{ minHeight: 360 }}
      transition={{ delay: at(3.3), duration: 0.8, ease: "easeOut" }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <img alt="" className="h-[44px] w-auto" src={frame207} />
          <span className="font-medium text-[15px] text-mkt-fg">What church teams say</span>
        </div>
        <div className="flex flex-col" style={{ gap: "4.34px" }}>
          <span
            style={{
              background: "#131318",
              borderRadius: 5.428,
              height: 32.569,
              width: 4.343,
            }}
          />
          <span
            style={{
              background: "#DCDCDC",
              borderRadius: 5.428,
              height: 16.285,
              width: 4.343,
            }}
          />
        </div>
      </div>

      {/* Date */}
      <p className="mt-12 text-[13px] text-mkt-muted">Feb 02, 2026</p>

      {/* Quote */}
      <p
        className="mt-2 max-w-[420px] font-medium text-[22px] tracking-tight"
        style={{ lineHeight: 1.3 }}
      >
        <AnimatedWords
          className="text-mkt-fg"
          delayStart={at(3.6)}
          stagger={0.04}
          text="Every team knows what's next"
        />{" "}
        <AnimatedWords
          className="text-mkt-muted"
          delayStart={at(3.75)}
          stagger={0.04}
          text="each week — and nothing slips through the cracks."
        />
      </p>

      {/* Bottom row */}
      <div className="absolute right-6 bottom-6 left-6 flex items-center justify-between">
        <div className="flex flex-col leading-tight">
          <span className="font-semibold text-[14px] text-mkt-fg">Hillside Church</span>
          <span className="text-[12px] text-mkt-muted">Operations Pastor</span>
        </div>
        <div className="flex items-center gap-1">
          <StarIcon />
          <StarIcon />
          <StarIcon />
          <StarIcon />
          <StarIcon half />
        </div>
      </div>
    </motion.div>
  );
}

function Showcase({ base }: { readonly base: number }) {
  // The showcase is the second beat of the load cascade. Its internal
  // choreography is authored against the cold-load timeline (~3.0s+), so we
  // slide the whole block by how far `base` sits from the cold-load settle.
  const shift = base + HERO_OFFSET.showcase - SHOWCASE_BASELINE;
  return (
    <div className="mx-auto mt-16 max-w-[1400px] px-6 md:px-10">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mesh-showcase overflow-hidden rounded-[28px] p-5 md:p-7"
        initial={{ opacity: 0, y: 60 }}
        transition={{
          delay: Math.max(0, SHOWCASE_BASELINE + shift),
          duration: 1,
          ease: RISE_EASE,
        }}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <LeftCard shift={shift} />
          <RightCard shift={shift} />
        </div>

        {/* Trusted-by row */}
        <div className="mt-7 flex flex-col items-start gap-6 px-1 text-white md:flex-row md:items-center md:justify-between">
          <p className="max-w-md text-[13px] text-white/75" style={{ lineHeight: 1.5 }}>
            Built with churches who run real ministry every week,
            <br />
            not another spreadsheet they have to keep up to date.
          </p>
          <div
            className="w-full overflow-hidden md:max-w-[60%]"
            style={{
              maskImage:
                "linear-gradient(to right, transparent 0, #000 80px, #000 calc(100% - 80px), transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0, #000 80px, #000 calc(100% - 80px), transparent 100%)",
            }}
          >
            <div className="animate-marquee flex w-max">
              <TrustedByGroup />
              <TrustedByGroup />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* How it works — a Template projecting its recurring Tasks onto the    */
/* weeks ahead, then the ordered weekly rhythm beneath it.             */
/* ------------------------------------------------------------------ */

// Each Team keeps one color across every week, so a glance reads ownership the
// same way the product does: teal is always Admin, violet always Worship.
const TEAM_COLOR = {
  Admin: "var(--t-teal)",
  Worship: "var(--t-violet)",
  Production: "var(--t-blue)",
  Creative: "var(--t-orange)",
  Welcome: "var(--t-emerald)",
} as const;

type Team = keyof typeof TEAM_COLOR;
type Task = { readonly label: string; readonly team: Team };

// A Sunday Service isn't one burst of work — it's phased. The Template owns the
// whole arc: prep lands in the week before, execution in the week of, recap in
// the week after. Same definition, but each week inherits its own real Tasks.
type ProjectionWeek = {
  readonly name: string;
  readonly date: string;
  readonly tag: string;
  // 0 = the live week of service; 1 = the weeks bracketing it (drives the fade).
  readonly future: 0 | 1;
  readonly tasks: readonly Task[];
};

const PROJECTION_WEEKS: readonly ProjectionWeek[] = [
  {
    name: "Week before",
    date: "Feb 2 — 8",
    future: 1,
    tag: "Prep",
    tasks: [
      { label: "Confirm the roster", team: "Admin" },
      { label: "Send the roster email", team: "Admin" },
      { label: "Finish sermon graphics", team: "Creative" },
    ],
  },
  {
    name: "Week of service",
    date: "Feb 9 — 15",
    future: 0,
    tag: "Live",
    tasks: [
      { label: "Lock the song list", team: "Worship" },
      { label: "Finalize the run sheet", team: "Admin" },
      { label: "Post Sunday promos", team: "Creative" },
    ],
  },
  {
    name: "Week after",
    date: "Feb 16 — 22",
    future: 1,
    tag: "Follow-up",
    tasks: [
      { label: "Follow up on connection cards", team: "Welcome" },
      { label: "Post the recap", team: "Creative" },
      { label: "Clip content for social", team: "Creative" },
    ],
  },
];

// The left panel summarizes the arc the Template owns — three phases, not three
// identical Tasks — so the projection reads as "one definition, phased across
// the weeks it lands on."
const TEMPLATE_PHASES = [
  { label: "Prep the week before", team: "Admin" },
  { label: "Run the week of", team: "Worship" },
  { label: "Recap the week after", team: "Welcome" },
] as const satisfies readonly Task[];

// The weekly rhythm as a real ordered process: define the Template, the Cycle
// runs it, then rollover carries the rest forward. The order is information, so
// these earn typed 01 / 02 / 03 markers.
const WEEK_MOMENTS = [
  {
    body: "Build the recurring work once — the weekly service, the monthly all-staff, the Easter season. Church Work treats it as a Template every Cycle inherits.",
    label: "Define it once",
    title: "Set up a Template",
  },
  {
    body: "Monday morning, the new Cycle opens with this week's Tasks already in place. Every Team sees My Work and Our Work — no one rebuilds the plan from scratch.",
    label: "The week runs",
    title: "The Cycle picks it up",
  },
  {
    body: "Sunday night, rollover closes the week and carries anything unfinished into the next Cycle — while the Template has already projected the week after.",
    label: "And the next",
    title: "It rolls forward",
  },
] as const;

function HowItWorks() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 pt-28 md:px-10 md:pt-36">
      <Reveal>
        <p className="cw-eyebrow">Templates · one definition, every Cycle</p>
        <h2
          className="mt-5 max-w-[820px] font-medium text-[40px] tracking-tight md:text-[56px]"
          style={{ letterSpacing: "-0.03em", lineHeight: 1.05 }}
        >
          Churches don't plan in projects. They plan in weeks.
        </h2>
        <p className="mt-5 max-w-[580px] text-[18px] text-mkt-muted" style={{ lineHeight: 1.5 }}>
          So you build the recurring work once as a Template — and Church Work projects it onto the
          weeks ahead. One Sunday service, phased across the weeks it touches: prep before, the run
          itself, recap after.
        </p>
      </Reveal>

      {/* Signature: the Template (left) projecting its Tasks onto the weeks. */}
      <Reveal className="mt-12" delay={80}>
        <div
          aria-label="A Template projecting its recurring Tasks onto the weeks ahead"
          className="cw-proj"
          role="img"
        >
          {/* The source — the Template definition the weeks inherit. */}
          <div className="cw-proj-source">
            <div className="cw-proj-tile">
              <span className="cw-proj-tile-icon">
                <LibraryBig className="size-[19px]" />
              </span>
              <span>
                <span className="cw-proj-tile-name block">Sunday Service</span>
                <span className="cw-proj-tile-cadence flex items-center gap-1">
                  <Repeat2 className="size-3.5" />
                  Repeats every Sunday
                </span>
              </span>
            </div>

            <div>
              <p className="cw-proj-deflabel">Recurring work, phased</p>
              <div className="mt-2.5 flex flex-col">
                {TEMPLATE_PHASES.map((phase) => (
                  <span className="cw-proj-defrow" key={phase.label}>
                    <span className="cw-proj-dot" style={{ background: TEAM_COLOR[phase.team] }} />
                    <span className="min-w-0 truncate">{phase.label}</span>
                    <span className="cw-proj-team">{phase.team}</span>
                  </span>
                ))}
              </div>
            </div>

            <p className="mt-auto text-[12.5px] text-mkt-muted" style={{ lineHeight: 1.5 }}>
              Defined once. Projected onto every Cycle &rarr;
            </p>
          </div>

          {/* The rail — each Week the Template lands on. */}
          <div className="cw-proj-rail">
            {PROJECTION_WEEKS.map((week) => {
              const isLive = week.future === 0;
              return (
                <div
                  className="cw-proj-week"
                  data-future={isLive ? undefined : String(week.future)}
                  data-live={isLive ? "true" : undefined}
                  key={week.name}
                >
                  <div className="cw-proj-weekhead">
                    <span className="cw-proj-weekname">{week.name}</span>
                    <span className="cw-proj-weektag">{week.tag}</span>
                  </div>
                  <span className="text-[11.5px] text-mkt-muted tabular-nums">{week.date}</span>
                  <div className="cw-proj-chips">
                    {week.tasks.map((task) => (
                      <span
                        className="cw-proj-chip"
                        data-solid={isLive ? "true" : undefined}
                        key={task.label}
                      >
                        <span
                          className="cw-proj-dot"
                          style={{
                            background: TEAM_COLOR[task.team],
                            opacity: isLive ? 1 : 0.7,
                          }}
                        />
                        <span className="cw-proj-chip-body">
                          <span className="cw-proj-chip-label">{task.label}</span>
                          <span className="cw-proj-team">{task.team}</span>
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* The three moments — the ordered weekly rhythm, read left to right. */}
      <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-mkt-border bg-mkt-border md:grid-cols-3">
        {WEEK_MOMENTS.map((m, i) => (
          <Reveal as="li" className="bg-mkt-bg p-7 md:p-8" delay={120 + i * 90} key={m.title}>
            <p className="cw-step-index">
              <b>{String(i + 1).padStart(2, "0")}</b> / 03
            </p>
            <p className="cw-eyebrow mt-4">{m.label}</p>
            <h3 className="mt-3 font-medium text-[22px] tracking-tight">{m.title}</h3>
            <p className="mt-3 text-[15px] text-mkt-muted" style={{ lineHeight: 1.55 }}>
              {m.body}
            </p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Product mockups — real in-app surfaces (the same List rows, Board    */
/* cards and Workflow Status icons the live app renders), driven by     */
/* static data so the marketing imagery can never drift from the app.   */
/* ------------------------------------------------------------------ */

// Stable, open-license headshots (randomuser.me, free to use) keyed by the
// fictional church-team members the marketing surfaces share. Centralizing them
// keeps a person's face consistent across every mock on the page.
const PEOPLE = {
  user_ak: {
    id: "user_ak",
    name: "Avery King",
    image: "https://randomuser.me/api/portraits/women/68.jpg",
  },
  user_jd: {
    id: "user_jd",
    name: "Jordan Diaz",
    image: "https://randomuser.me/api/portraits/men/32.jpg",
  },
  user_st: {
    id: "user_st",
    name: "Sam Torres",
    image: "https://randomuser.me/api/portraits/men/75.jpg",
  },
  user_mr: {
    id: "user_mr",
    name: "Morgan Reyes",
    image: "https://randomuser.me/api/portraits/women/44.jpg",
  },
  user_lb: {
    id: "user_lb",
    name: "Liam Brooks",
    image: "https://randomuser.me/api/portraits/men/52.jpg",
  },
  user_cn: {
    id: "user_cn",
    name: "Casey Nguyen",
    image: "https://randomuser.me/api/portraits/women/12.jpg",
  },
  user_dp: {
    id: "user_dp",
    name: "Devon Park",
    image: "https://randomuser.me/api/portraits/men/19.jpg",
  },
} as const;

const MY_WORK_ROWS: readonly PresentationTask[] = [
  {
    identifier: "WOR-128",
    title: "Confirm Sunday band lineup",
    state: "in_progress",
    priority: "high",
    labels: [{ color: "violet", name: "Worship" }],
    assignee: PEOPLE.user_ak,
  },
  {
    identifier: "KID-064",
    title: "Print check-in labels",
    state: "todo",
    priority: "medium",
    labels: [{ color: "orange", name: "Kids" }],
    assignee: PEOPLE.user_jd,
  },
  {
    identifier: "PRD-201",
    title: "Render lyric slides",
    state: "done",
    priority: "no_priority",
    labels: [{ color: "blue", name: "Production" }],
    assignee: PEOPLE.user_st,
  },
];

function MyWorkMock() {
  return (
    <ProductFrame title="My Work">
      <div className="py-1">
        {MY_WORK_ROWS.map((task) => (
          <TaskRowPresentation key={task.identifier} task={task} />
        ))}
      </div>
    </ProductFrame>
  );
}

const BOARD_COLUMNS: readonly {
  readonly state: PresentationTask["state"];
  readonly title: string;
  readonly tasks: readonly PresentationTask[];
}[] = [
    {
      state: "todo",
      title: "To Do",
      tasks: [
        {
          identifier: "EXP-058",
          title: "Order communion supplies",
          state: "todo",
          priority: "low",
          labels: [{ color: "pink", name: "Experience" }],
          assignee: PEOPLE.user_mr,
        },
        {
          identifier: "EXP-061",
          title: "Confirm greeter schedule",
          state: "todo",
          labels: [{ color: "teal", name: "Welcome" }],
          assignee: PEOPLE.user_cn,
        },
      ],
    },
    {
      state: "in_progress",
      title: "In Progress",
      tasks: [
        {
          identifier: "WOR-130",
          title: "Band rehearsal run-through",
          state: "in_progress",
          priority: "high",
          labels: [{ color: "violet", name: "Worship" }],
          assignee: PEOPLE.user_ak,
        },
      ],
    },
    {
      state: "done",
      title: "Done",
      tasks: [
        {
          identifier: "KID-066",
          title: "Kids check-in tested",
          state: "done",
          labels: [{ color: "orange", name: "Kids" }],
          assignee: PEOPLE.user_jd,
        },
      ],
    },
  ];

function BoardMock() {
  return (
    <ProductFrame title="Production · Board">
      <div className="grid grid-cols-3 gap-2 p-3">
        {BOARD_COLUMNS.map((col) => (
          <BoardColumnPresentation
            key={col.title}
            state={col.state}
            tasks={col.tasks}
            title={col.title}
          />
        ))}
      </div>
    </ProductFrame>
  );
}

// Each Team's share of the Cycle's Tasks, drawn in that Team's own color so the
// chart reads as real product data, not decoration.
const INSIGHT_TEAMS = [
  { name: "Worship", count: 11, bar: "bg-violet-500", dot: "bg-violet-500" },
  { name: "Production", count: 16, bar: "bg-blue-500", dot: "bg-blue-500" },
  { name: "Kids", count: 9, bar: "bg-orange-500", dot: "bg-orange-500" },
  {
    name: "Experience",
    count: 12,
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
] as const;

function InsightsMock() {
  const total = INSIGHT_TEAMS.reduce((sum, team) => sum + team.count, 0);
  const max = Math.max(...INSIGHT_TEAMS.map((team) => team.count));
  return (
    <ProductFrame
      bodyClassName="flex flex-1 flex-col"
      className="h-full"
      title="Insights · by Team"
    >
      <div className="flex min-h-[116px] flex-1 items-end gap-3 px-4 pt-4">
        {INSIGHT_TEAMS.map((team) => (
          <span
            className={`flex-1 rounded-t-sm ${team.bar}`}
            key={team.name}
            style={{ height: `${Math.round((team.count / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3">
        {INSIGHT_TEAMS.map((team) => (
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs" key={team.name}>
            <span className={`size-1.5 rounded-full ${team.dot}`} />
            {team.name}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between border-t px-4 py-2.5">
        <span className="text-muted-foreground text-xs">Tasks this Cycle</span>
        <span className="font-medium text-foreground text-sm tabular-nums">{total} total</span>
      </div>
    </ProductFrame>
  );
}

// One Weekly Service Template, laid out as the service's full lifecycle: the
// prep that has to land the week before, the work during the service week, and
// the follow-up that has to happen the week after — each Task projected onto
// the right Cycle automatically. The service week is live; the surrounding
// weeks are projected (ghost) Tasks waiting to be created.
const TEMPLATE_PROJECTION_WEEKS: readonly TemplateProjectionWeek[] = [
  {
    label: "Jan 26 — Feb 1",
    relative: "Week before",
    tasks: [
      { color: "violet", label: "Plan the set list" },
      { color: "blue", label: "Build lyric slides" },
      { color: "orange", label: "Recruit kids volunteers" },
    ],
  },
  {
    label: "Feb 2 — 8",
    relative: "Service week",
    projected: false,
    tasks: [
      { color: "violet", label: "Band rehearsal" },
      { color: "pink", label: "Set up auditorium" },
      { color: "orange", label: "Run kids check-in" },
    ],
  },
  {
    label: "Feb 9 — 15",
    relative: "Week after",
    tasks: [
      { color: "blue", label: "Post sermon clip" },
      { color: "emerald", label: "Follow up with guests" },
      { color: "teal", label: "Tear-down debrief" },
    ],
  },
];

function TemplatesMock() {
  return (
    <ProductFrame className="h-full" title="Templates · Library">
      <TemplateProjectionPresentation
        cadence="Every Sunday"
        name="Sunday Service"
        shape="Weekly service"
        weeks={TEMPLATE_PROJECTION_WEEKS}
      />
    </ProductFrame>
  );
}

/* ------------------------------------------------------------------ */
/* What you get — the real product surfaces, each with a UI preview     */
/* ------------------------------------------------------------------ */

const SURFACES = [
  {
    body: "Everything assigned to you across every Team and Cycle, in one list. No hunting through channels to find what's yours this week.",
    mock: "my-work",
    span: "md:col-span-2",
    tag: "Personal",
    title: "My Work",
  },
  {
    body: "Drag a Task through your Team's own Workflow — To Do, In Progress, Done — without leaving the plan.",
    mock: "board",
    span: "md:col-span-4",
    tag: "Flow",
    title: "Team Boards",
  },
  {
    body: "Recurring work, written once. A Template projects its Tasks onto every future Cycle automatically — so the same Sunday prep is never rebuilt by hand.",
    mock: "templates",
    span: "md:col-span-4",
    tag: "Reuse",
    title: "Templates",
  },
  {
    body: "Where the week's work stands, counted by Team — so a glance answers \u201care we ready for Sunday?\u201d",
    mock: "insights",
    span: "md:col-span-2",
    tag: "Read",
    title: "Insights",
  },
] as const;

function SurfaceMock({ mock }: { readonly mock: string | null }) {
  if (mock === "my-work") return <MyWorkMock />;
  if (mock === "board") return <BoardMock />;
  if (mock === "insights") return <InsightsMock />;
  if (mock === "templates") return <TemplatesMock />;
  return null;
}

function WhatYouGet() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 pt-28 md:px-10 md:pt-36">
      <Reveal>
        <p className="cw-eyebrow">What&rsquo;s inside</p>
        <h2
          className="mt-5 max-w-[820px] font-medium text-[40px] tracking-tight md:text-[56px]"
          style={{ letterSpacing: "-0.03em", lineHeight: 1.05 }}
        >
          Make the vision plain so your team can run with it.
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-4 md:grid-cols-6">
        {SURFACES.map((s, i) => (
          <Reveal
            className={`flex flex-col rounded-2xl border border-mkt-border bg-mkt-bg p-6 ${s.span}`}
            delay={i * 70}
            key={s.title}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="font-medium text-[20px] tracking-tight">{s.title}</h3>
              <span className="cw-eyebrow">{s.tag}</span>
            </div>
            <p className="mt-3 text-[15px] text-mkt-muted" style={{ lineHeight: 1.55 }}>
              {s.body}
            </p>
            {s.mock ? (
              <div className="mt-5 flex flex-1 flex-col">
                <SurfaceMock mock={s.mock} />
              </div>
            ) : null}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The vocabulary — the domain's own words, defined plainly            */
/* ------------------------------------------------------------------ */

const TERMS = [
  {
    term: "Cadence",
    def: "The rhythm that makes work recur — weekly, monthly, every Easter.",
  },
  {
    term: "Cycle",
    def: "One Monday-to-Sunday week of work for the whole church.",
  },
  {
    term: "Template",
    def: "Recurring work written once, projected onto future Cycles.",
  },
  {
    term: "Rollover",
    def: "Sunday's hand-off that carries unfinished work into next week.",
  },
] as const;

function Vocabulary() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 pt-28 md:px-10 md:pt-36">
      <div className="overflow-hidden rounded-[28px] bg-mkt-surface p-8 text-white md:p-12">
        <Reveal>
          <p className="cw-eyebrow" style={{ color: "rgba(255,255,255,0.55)" }}>
            Speaks your language
          </p>
          <h2
            className="mt-5 max-w-[680px] font-medium text-[32px] tracking-tight md:text-[44px]"
            style={{ letterSpacing: "-0.03em", lineHeight: 1.1 }}
          >
            Built on the words a ministry team already uses.
          </h2>
        </Reveal>

        <dl className="mt-10 grid gap-x-10 sm:grid-cols-2">
          {TERMS.map((t, i) => (
            <Reveal
              className="flex flex-col gap-2 border-white/10 border-t py-6"
              delay={i * 80}
              key={t.term}
            >
              <dt className="font-medium text-[20px] tracking-tight">{t.term}</dt>
              <dd
                className="text-[15px]"
                style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}
              >
                {t.def}
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Closing call to action                                              */
/* ------------------------------------------------------------------ */

function ClosingCTA() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 pt-28 pb-8 text-center md:px-10 md:pt-40">
      <Reveal>
        <h2
          className="mx-auto max-w-[820px] font-medium text-[44px] tracking-tight md:text-[68px]"
          style={{ letterSpacing: "-0.035em", lineHeight: 1.04 }}
        >
          Start the next Cycle with a plan, not a scramble.
        </h2>
        <p
          className="mx-auto mt-6 max-w-[520px] text-[18px] text-mkt-muted"
          style={{ lineHeight: 1.5 }}
        >
          Set up your church in minutes. Your first Cycle and a ready next week are waiting.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <button
            className="rounded-full px-7 py-3 font-semibold text-[15px] text-mkt-fg transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: "oklch(0.88 0.18 95)" }}
            type="button"
          >
            Get started
          </button>
          <button
            className="rounded-full border border-mkt-border bg-mkt-bg px-7 py-3 font-medium text-[15px] text-mkt-fg transition-colors hover:bg-mkt-card"
            style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}
            type="button"
          >
            Book a demo
          </button>
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Gradient showcase band — a second mesh moment with a product view   */
/* ------------------------------------------------------------------ */

const CYCLE_ROWS: readonly PresentationTask[] = [
  {
    identifier: "WOR-128",
    title: "Set list finalized",
    state: "done",
    labels: [{ color: "violet", name: "Worship" }],
    assignee: PEOPLE.user_ak,
  },
  {
    identifier: "PRD-204",
    title: "Camera cuts rehearsed",
    state: "in_progress",
    priority: "high",
    labels: [{ color: "blue", name: "Production" }],
    assignee: PEOPLE.user_st,
  },
  {
    identifier: "KID-066",
    title: "Volunteer check-in ready",
    state: "in_progress",
    labels: [{ color: "orange", name: "Kids" }],
    assignee: PEOPLE.user_jd,
  },
  {
    identifier: "EXP-039",
    title: "Coffee + welcome team",
    state: "todo",
    priority: "medium",
    labels: [{ color: "teal", name: "Experience" }],
    assignee: PEOPLE.user_mr,
  },
  {
    identifier: "SOC-017",
    title: "Sermon clip scheduled",
    state: "todo",
    labels: [{ color: "pink", name: "Social" }],
    assignee: PEOPLE.user_lb,
  },
];

function CycleBoardMock() {
  return (
    <ProductFrame
      title="This Week · Our Work"
      trailing={
        <span className="inline-flex items-center rounded-md border bg-background px-2 py-0.5 font-medium text-muted-foreground text-xs">
          Feb 2 — Feb 8
        </span>
      }
    >
      <div className="py-1">
        {CYCLE_ROWS.map((task) => (
          <TaskRowPresentation key={task.identifier} task={task} />
        ))}
      </div>
    </ProductFrame>
  );
}

function GradientBand() {
  return (
    <section className="mx-auto mt-28 max-w-[1400px] px-6 md:mt-36 md:px-10">
      <motion.div
        className="mesh-band overflow-hidden rounded-[28px] p-7 md:p-12"
        initial={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.9, ease: RISE_EASE }}
        viewport={{ margin: "-15%", once: true }}
        whileInView={{ opacity: 1, y: 0 }}
      >
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
          <div className="text-white">
            <p className="cw-eyebrow" style={{ color: "rgba(255,255,255,0.6)" }}>
              One shared picture
            </p>
            <h2
              className="mt-5 max-w-[420px] font-medium text-[32px] tracking-tight md:text-[46px]"
              style={{ letterSpacing: "-0.03em", lineHeight: 1.08 }}
            >
              The whole week, in one view.
            </h2>
            <p
              className="mt-5 max-w-[420px] text-[16px]"
              style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.55 }}
            >
              Every Team&rsquo;s Tasks for the current Cycle, color-coded and live. Production sees
              production; everyone sees how Sunday is coming together.
            </p>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ delay: 0.15, duration: 0.8, ease: RISE_EASE }}
            viewport={{ margin: "-15%", once: true }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            style={{ filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.35))" }}
          >
            <CycleBoardMock />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function HomePage() {
  // The persistent MarketingShell (see route.tsx) owns the scroll surface and
  // the Header; this page just contributes its sections. The hero and showcase
  // enter relative to when the header settles — full delay on a cold load, ~0
  // after navigation (when the header is already at rest).
  const { headerSettle } = useHeaderEntrance();
  return (
    <>
      <Hero base={headerSettle} />
      <Showcase base={headerSettle} />
      <HowItWorks />
      <WhatYouGet />
      <GradientBand />
      <Vocabulary />
      <ClosingCTA />
      <div className="h-16" />
    </>
  );
}
