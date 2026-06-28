import type { ReactNode } from "react";

import {
  type PresentationTask,
  ProductFrame,
  TaskRowPresentation,
} from "@/components/tasks/task-presentation";

import { Reveal } from "./-marketing-shell";

/* ------------------------------------------------------------------ */
/* Rhythm sections                                                     */
/*                                                                     */
/* The two closing sections that carry the page's thesis — Church Work */
/* is built for recurring ministry rhythm, not one-and-done projects.  */
/* First the positioning argument (two kinds of work), then the        */
/* concrete proof (one shared week, drawn with real product surfaces). */
/* They share the marketing type, accent and spacing with the rest of  */
/* the page.                                                           */
/* ------------------------------------------------------------------ */

const ACCENT = "oklch(0.88 0.18 95)";

/* ================================================================== */
/* Shared section frame                                                 */
/* ================================================================== */

function SectionShell({
  eyebrow,
  title,
  body,
  children,
}: {
  readonly eyebrow: string;
  readonly title: ReactNode;
  readonly body: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-[1400px] px-6 pt-28 md:px-10 md:pt-36">
      <Reveal>
        <p className="cw-eyebrow">{eyebrow}</p>
        <h2
          className="mt-5 max-w-[760px] font-medium text-[36px] tracking-tight md:text-[52px]"
          style={{ letterSpacing: "-0.03em", lineHeight: 1.06 }}
        >
          {title}
        </h2>
        <p className="mt-5 max-w-[560px] text-[18px] text-mkt-muted" style={{ lineHeight: 1.5 }}>
          {body}
        </p>
      </Reveal>
      {children}
    </section>
  );
}

/* ================================================================== */
/* Two kinds of work                                                   */
/*                                                                     */
/* A direct, honest positioning split: the project shape (a line to a  */
/* finish) versus the ministry shape (a recurring beat). The most      */
/* pointed statement of the "not projects" thesis the hero opens with. */
/* ================================================================== */

function ProjectShape() {
  return (
    <svg aria-hidden className="h-10 w-full" preserveAspectRatio="none" viewBox="0 0 280 40">
      <line
        stroke="currentColor"
        strokeDasharray="2 6"
        strokeLinecap="round"
        strokeWidth={2}
        x1={8}
        x2={258}
        y1={20}
        y2={20}
      />
      <circle cx={8} cy={20} fill="currentColor" r={3.5} />
      <path d="M258 12 L272 20 L258 28 Z" fill="currentColor" />
    </svg>
  );
}

function MinistryShape() {
  return (
    <svg aria-hidden className="h-10 w-full" preserveAspectRatio="none" viewBox="0 0 280 40">
      {[0, 1, 2, 3].map((i) => (
        <path
          d={`M${8 + i * 62} 20 q15.5 -15 31 0 q15.5 15 31 0`}
          fill="none"
          key={i}
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={2.5}
        />
      ))}
    </svg>
  );
}

const PROJECT_TRAITS = [
  "Set up once, close when it's done",
  "Next Sunday? Rebuild it from scratch",
  "Last week's loose ends quietly vanish",
] as const;

const MINISTRY_TRAITS = [
  "Built once as a Template, reused forever",
  "Next Sunday is already planned and waiting",
  "Unfinished work rolls into the next week",
] as const;

export function ToolsContrastSection() {
  return (
    <SectionShell
      body="Project tools assume work has an end. Ministry doesn't — Sunday comes every week, Christmas comes every year. Church Work is shaped around the beat, not the finish line."
      eyebrow="Why not a project tool"
      title="Most tools plan a finish. Ministry plans a rhythm."
    >
      <Reveal className="mt-12" delay={80}>
        <div className="grid gap-5 md:grid-cols-2">
          {/* The project shape — receded */}
          <div className="flex flex-col rounded-[24px] border border-mkt-border bg-mkt-card p-7 md:p-9">
            <p className="font-medium text-[12px] text-mkt-muted uppercase tracking-[0.14em]">
              A project tool
            </p>
            <h3 className="mt-4 font-medium text-[26px] text-mkt-muted tracking-tight">
              A line that ends.
            </h3>
            <div className="mt-7 text-mkt-muted/45">
              <ProjectShape />
            </div>
            <ul className="mt-7 flex flex-col gap-3 text-[15px] text-mkt-muted">
              {PROJECT_TRAITS.map((t) => (
                <li className="flex items-start gap-2.5" key={t}>
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-mkt-muted/40" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* The ministry shape — lit */}
          <div
            className="flex flex-col rounded-[24px] border p-7 md:p-9"
            style={{
              borderColor: "color-mix(in oklch, oklch(0.88 0.18 95) 50%, var(--mkt-border))",
              background:
                "linear-gradient(180deg, oklch(0.88 0.18 95 / 0.1) 0%, var(--mkt-bg) 55%)",
            }}
          >
            <p
              className="font-medium text-[12px] uppercase tracking-[0.14em]"
              style={{ color: "color-mix(in oklch, oklch(0.88 0.18 95) 65%, var(--mkt-fg))" }}
            >
              Church Work
            </p>
            <h3 className="mt-4 font-medium text-[26px] text-mkt-fg tracking-tight">
              A beat that repeats.
            </h3>
            <div className="mt-7" style={{ color: ACCENT }}>
              <MinistryShape />
            </div>
            <ul className="mt-7 flex flex-col gap-3 text-[15px] text-mkt-fg">
              {MINISTRY_TRAITS.map((t) => (
                <li className="flex items-start gap-2.5" key={t}>
                  <span
                    className="mt-[7px] size-1.5 shrink-0 rounded-full"
                    style={{ background: ACCENT }}
                  />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </SectionShell>
  );
}

/* ================================================================== */
/* The living week                                                     */
/*                                                                     */
/* The shared picture, using the real product surface primitive. One   */
/* week, every Team's work, one place everyone looks. Concrete proof   */
/* over metaphor — the same rows the live app renders.                 */
/* ================================================================== */

const LIVING_WEEK_ROWS: readonly PresentationTask[] = [
  {
    identifier: "WOR-128",
    title: "Set list finalized",
    state: "done",
    labels: [{ color: "violet", name: "Worship" }],
    assignee: {
      id: "user_ak",
      name: "Avery King",
      image: "https://randomuser.me/api/portraits/women/68.jpg",
    },
  },
  {
    identifier: "PRD-204",
    title: "Camera cuts rehearsed",
    state: "in_progress",
    priority: "high",
    labels: [{ color: "blue", name: "Production" }],
    assignee: {
      id: "user_st",
      name: "Sam Torres",
      image: "https://randomuser.me/api/portraits/men/75.jpg",
    },
  },
  {
    identifier: "KID-066",
    title: "Volunteer check-in ready",
    state: "in_progress",
    labels: [{ color: "orange", name: "Kids" }],
    assignee: {
      id: "user_jd",
      name: "Jordan Diaz",
      image: "https://randomuser.me/api/portraits/men/32.jpg",
    },
  },
  {
    identifier: "EXP-039",
    title: "Coffee + welcome team",
    state: "todo",
    priority: "medium",
    labels: [{ color: "teal", name: "Experience" }],
    assignee: {
      id: "user_mr",
      name: "Morgan Reyes",
      image: "https://randomuser.me/api/portraits/women/44.jpg",
    },
  },
];

const LIVING_WEEK_STATS = [
  { label: "Teams in sync", value: "6" },
  { label: "Tasks this week", value: "48" },
  { label: "Rebuilt by hand", value: "0" },
] as const;

export function LivingWeekSection() {
  return (
    <SectionShell
      body="No more “who's got the slides?” at 9pm Saturday. Every Team's work for the week lives in one place — owned, visible, and carried forward — so everyone is looking at the same plan."
      eyebrow="One shared picture"
      title="The whole week, in one place everyone can see."
    >
      <Reveal className="mt-12" delay={80}>
        <div className="grid items-center gap-8 rounded-[24px] border border-mkt-border bg-mkt-card p-5 md:grid-cols-[1fr_360px] md:gap-10 md:p-8">
          <div style={{ filter: "drop-shadow(0 20px 40px oklch(0 0 0 / 0.08))" }}>
            <ProductFrame
              title="This Week · Our Work"
              trailing={
                <span className="inline-flex items-center rounded-md border bg-background px-2 py-0.5 font-medium text-muted-foreground text-xs">
                  Feb 2 — Feb 8
                </span>
              }
            >
              <div className="py-1">
                {LIVING_WEEK_ROWS.map((task) => (
                  <TaskRowPresentation key={task.identifier} task={task} />
                ))}
              </div>
            </ProductFrame>
          </div>

          <div className="flex flex-col gap-5">
            {LIVING_WEEK_STATS.map((stat) => (
              <div
                className="flex items-baseline gap-4 border-mkt-border border-b pb-5"
                key={stat.label}
              >
                <span
                  className="font-medium text-[44px] tabular-nums tracking-tight"
                  style={{ color: stat.value === "0" ? ACCENT : "var(--mkt-fg)" }}
                >
                  {stat.value}
                </span>
                <span className="text-[15px] text-mkt-muted">{stat.label}</span>
              </div>
            ))}
            <p className="text-[15px] text-mkt-muted" style={{ lineHeight: 1.55 }}>
              Worship, Production, Kids, Experience — one Cycle, color-coded and live. A glance
              answers the only question that matters: are we ready for Sunday?
            </p>
          </div>
        </div>
      </Reveal>
    </SectionShell>
  );
}
