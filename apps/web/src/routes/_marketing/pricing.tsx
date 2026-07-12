import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { Reveal, RISE_EASE, useHeaderEntrance } from "./-marketing-shell";

export const Route = createFileRoute("/_marketing/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Free and Paid pricing — Church Work" },
      {
        name: "description",
        content:
          "Start Church Work free with unlimited Users and Teams and up to 300 planned Tasks. Upgrade to unlimited usage for $19.99 USD per Church per week, including applicable tax.",
      },
    ],
  }),
});

/* ------------------------------------------------------------------ */
/* Plan data — the two plans differ on exactly one line, so the cards   */
/* keep the shared rows parallel and draw the differing row heavier.    */
/* ------------------------------------------------------------------ */

type PlanFeature = {
  readonly label: string;
  /** The line that actually differs between the plans. */
  readonly highlight?: boolean;
};

const FREE_FEATURES: readonly PlanFeature[] = [
  { label: "Unlimited Users" },
  { label: "Unlimited Teams" },
  { highlight: true, label: "Up to 300 planned Tasks" },
];
const PAID_FEATURES: readonly PlanFeature[] = [
  { label: "Unlimited Users" },
  { label: "Unlimited Teams" },
  { highlight: true, label: "Unlimited planned Tasks" },
  { label: "Unlimited product usage" },
];

function Check() {
  return (
    <span
      aria-hidden
      className="mt-0.5 flex size-[18px] flex-none items-center justify-center rounded-full bg-mkt-accent text-mkt-accent-fg"
    >
      <svg
        fill="none"
        height="10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.5"
        viewBox="0 0 24 24"
        width="10"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Plan cards                                                          */
/* ------------------------------------------------------------------ */

function PlanCta({ dark, label }: { readonly dark?: boolean; readonly label: string }) {
  return (
    <Link
      className={`mt-8 inline-flex w-full items-center justify-center rounded-full bg-mkt-accent px-7 py-3 text-center font-semibold text-[15px] text-mkt-accent-fg transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-auto ${
        dark ? "focus-visible:outline-white" : "focus-visible:outline-mkt-fg"
      }`}
      to="/sign-in"
    >
      {label}
    </Link>
  );
}

function PlanCard({
  badge,
  children,
  dark,
  features,
  name,
  price,
  priceNote,
}: {
  readonly badge: string;
  readonly children: ReactNode;
  readonly dark?: boolean;
  readonly features: readonly PlanFeature[];
  readonly name: string;
  readonly price: { readonly amount: string; readonly currency?: string };
  readonly priceNote: string;
}) {
  const headingId = `plan-${name.toLowerCase().replace(/\s+/g, "-")}`;
  const muted = dark ? "text-white/60" : "text-mkt-muted";
  return (
    <article
      aria-labelledby={headingId}
      className={
        dark
          ? "mesh-price flex flex-col rounded-[28px] p-7 text-white md:p-10"
          : "flex flex-col rounded-[28px] border border-mkt-border bg-mkt-bg p-7 md:p-10"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={`font-semibold text-sm ${muted}`} id={headingId}>
          {name}
        </h2>
        <span
          className={`rounded-full px-3 py-1 font-medium text-xs ${
            dark
              ? "border border-white/25 bg-white/10 text-white/85"
              : "border border-mkt-border bg-mkt-card text-mkt-muted"
          }`}
        >
          {badge}
        </span>
      </div>
      <div className="mt-6 flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium text-[56px] leading-none tracking-[-0.04em] md:text-7xl">
          {price.amount}
        </span>
        {price.currency ? (
          <span className={`font-medium text-[17px] ${muted}`}>{price.currency}</span>
        ) : null}
      </div>
      <p className={`mt-3 text-[15px] ${muted}`}>{priceNote}</p>
      <ul className="mt-8 space-y-3">
        {features.map((feature) => (
          <li className="flex items-start gap-3" key={feature.label}>
            <Check />
            <span className={feature.highlight ? "font-semibold" : undefined}>{feature.label}</span>
          </li>
        ))}
      </ul>
      {children}
    </article>
  );
}

function PriceHero({ base }: { readonly base: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <section className="mx-auto max-w-[1200px] px-6 pt-16 md:px-10 md:pt-24">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        transition={
          reduceMotion ? { duration: 0 } : { delay: Math.max(0, base - 0.3), duration: 0.8 }
        }
      >
        <p className="cw-eyebrow text-center">Free to start. One clear upgrade.</p>
        <h1 className="mx-auto mt-7 max-w-[900px] text-center font-medium text-[48px] tracking-[-0.035em] leading-[1.04] md:text-[76px]">
          Plan the work now. Upgrade when you need more room.
        </h1>
        <p className="mx-auto mt-6 max-w-[650px] text-center text-[18px] text-mkt-muted leading-relaxed">
          Every Church starts free with no card required. Both plans include unlimited Users and
          Teams—never per-seat pricing.
        </p>
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mt-12 grid gap-5 md:mt-14 md:grid-cols-2"
        initial={reduceMotion ? false : { opacity: 0, y: 40 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                delay: Math.max(0, base + 0.45),
                duration: 0.9,
                ease: RISE_EASE,
              }
        }
      >
        <PlanCard
          badge="No card required"
          features={FREE_FEATURES}
          name="Free Plan"
          price={{ amount: "$0" }}
          priceNote="Free forever, for every Church"
        >
          <p className="mt-7 text-sm text-mkt-muted leading-relaxed">
            Planned Tasks are real Tasks in your current or future planning horizon, plus Week-less
            To Do work. Past work and projected Template work never use the allowance.
          </p>
          <div className="mt-auto">
            <PlanCta label="Start free" />
          </div>
        </PlanCard>
        <PlanCard
          badge="Billed weekly"
          dark
          features={PAID_FEATURES}
          name="Paid Plan"
          price={{ amount: "$19.99", currency: "USD" }}
          priceNote="per Church per week, including applicable tax"
        >
          <p className="mt-7 text-sm text-white/65 leading-relaxed">
            Billed weekly only—no monthly, annual, or per-seat options. Sign up on Free, then a
            Church owner or admin can upgrade from Church Billing settings.
          </p>
          <div className="mt-auto">
            <PlanCta dark label="Start free, upgrade later" />
          </div>
        </PlanCard>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Side-by-side comparison — the whole difference in one glance        */
/* ------------------------------------------------------------------ */

const COMPARE_ROWS = [
  { free: "Unlimited", label: "Users", paid: "Unlimited" },
  { free: "Unlimited", label: "Teams", paid: "Unlimited" },
  { free: "Up to 300", label: "Planned Tasks", paid: "Unlimited" },
  {
    free: "$0, forever",
    label: "Price",
    paid: "$19.99 USD per Church per week",
  },
  {
    free: "No card required",
    label: "Billing",
    paid: "Weekly only, including applicable tax",
  },
] as const;

function ComparePlans({ heroSettleMs }: { readonly heroSettleMs: number }) {
  return (
    <section
      aria-labelledby="compare-heading"
      className="mx-auto max-w-[1200px] px-6 pt-28 md:px-10 md:pt-36"
    >
      <Reveal holdUntil={heroSettleMs}>
        <p className="cw-eyebrow">Side by side</p>
        <h2
          className="mt-5 max-w-[760px] font-medium text-[40px] tracking-[-0.03em] leading-[1.05] md:text-[56px]"
          id="compare-heading"
        >
          One difference: how much you can plan.
        </h2>
      </Reveal>
      <Reveal className="mt-10" delay={80}>
        <div className="overflow-x-auto rounded-2xl border border-mkt-border">
          <table className="w-full min-w-[560px] border-collapse text-left text-[15px]">
            <caption className="sr-only">Free Plan and Paid Plan comparison</caption>
            <thead>
              <tr className="border-mkt-border border-b bg-mkt-card">
                <th className="w-[28%] px-6 py-4 font-semibold" scope="col">
                  <span className="sr-only">Plan detail</span>
                </th>
                <th className="w-[32%] px-6 py-4 font-semibold text-mkt-fg" scope="col">
                  Free Plan
                </th>
                <th className="px-6 py-4 font-semibold text-mkt-fg" scope="col">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="size-2 rounded-full bg-mkt-accent" />
                    Paid Plan
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr className="border-mkt-border border-b last:border-b-0" key={row.label}>
                  <th className="px-6 py-4 align-top font-medium text-mkt-muted" scope="row">
                    {row.label}
                  </th>
                  <td className="px-6 py-4 align-top">{row.free}</td>
                  <td className="px-6 py-4 align-top">{row.paid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* From signup to upgrade — the one path every Church takes            */
/* ------------------------------------------------------------------ */

const UPGRADE_STEPS = [
  {
    body: "Create your Church from sign-in—no card and no trial clock. Unlimited Users and Teams from day one, on either plan.",
    label: "Sign up",
    title: "Start free",
  },
  {
    body: "Complete Onboarding, invite your Teams, and plan the weeks ahead. Free covers up to 300 planned Tasks across your current and future Weeks.",
    label: "Settle in",
    title: "Plan your weeks",
  },
  {
    body: "Once usage passes 200 planned Tasks, every Church Member can see it. A Church owner or admin upgrades from Church Billing settings—no one stops working.",
    label: "When you need room",
    title: "Upgrade in Church Billing",
  },
] as const;

function UpgradePath() {
  return (
    <section
      aria-labelledby="upgrade-heading"
      className="mx-auto max-w-[1200px] px-6 pt-28 md:px-10 md:pt-36"
    >
      <Reveal>
        <p className="cw-eyebrow">Signup to upgrade</p>
        <h2
          className="mt-5 max-w-[760px] font-medium text-[40px] tracking-[-0.03em] leading-[1.05] md:text-[56px]"
          id="upgrade-heading"
        >
          Every Church takes the same path.
        </h2>
      </Reveal>
      <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-mkt-border bg-mkt-border md:grid-cols-3">
        {UPGRADE_STEPS.map((step, i) => (
          <Reveal as="li" className="bg-mkt-bg p-7 md:p-8" delay={120 + i * 90} key={step.title}>
            <p className="cw-step-index">
              <b>{String(i + 1).padStart(2, "0")}</b> / 03
            </p>
            <p className="cw-eyebrow mt-4">{step.label}</p>
            <h3 className="mt-3 font-medium text-[22px] tracking-tight">{step.title}</h3>
            <p className="mt-3 text-[15px] text-mkt-muted leading-[1.55]">{step.body}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Good to know                                                        */
/* ------------------------------------------------------------------ */

const FAQS = [
  {
    q: "What counts toward 300 planned Tasks?",
    a: "Real Tasks in the current Week or a future Week count while they are To Do, In Progress, or Done. Week-less To Do Tasks count too. Past-Week Tasks, canceled or deleted Tasks, and projected Template Tasks do not count.",
  },
  {
    q: "Do Users or Teams cost extra?",
    a: "No. Free and Paid both include unlimited Users and unlimited Teams for the whole Church.",
  },
  {
    q: "How is Paid billed?",
    a: "Paid is $19.99 USD per Church per week, including applicable tax. There are no monthly, annual, per-seat, or trial billing options.",
  },
  {
    q: "How do we upgrade?",
    a: "Start with the Free Plan and complete the usual Onboarding. A Church owner or admin can upgrade later from Church Billing settings.",
  },
  {
    q: "How will we know we're near the limit?",
    a: "Every Church Member can see Task Usage once it passes 200 planned Tasks—including usage above 300 caused by scheduled Template materialization. Owners and admins can go from the usage notice straight to Church Billing.",
  },
  {
    q: "What happens if a payment fails?",
    a: "Your Church keeps Paid Plan access for a two-week recovery period. If the Subscription is still past due after that, Free Plan limits apply—existing work is never deleted or hidden.",
  },
] as const;

function Details() {
  return (
    <section
      aria-labelledby="details-heading"
      className="mx-auto max-w-[1200px] px-6 pt-28 md:px-10 md:pt-36"
    >
      <Reveal>
        <p className="cw-eyebrow">Good to know</p>
        <h2
          className="mt-5 max-w-[760px] font-medium text-[40px] tracking-[-0.03em] leading-[1.05] md:text-[56px]"
          id="details-heading"
        >
          Clear limits. No hidden billing paths.
        </h2>
      </Reveal>
      <dl className="mt-10 grid gap-x-12 sm:grid-cols-2">
        {FAQS.map((faq, i) => (
          <Reveal className="border-mkt-border border-t py-7" delay={i * 70} key={faq.q}>
            <dt className="font-medium text-[18px]">{faq.q}</dt>
            <dd className="mt-2 text-[15px] text-mkt-muted leading-relaxed">{faq.a}</dd>
          </Reveal>
        ))}
      </dl>
    </section>
  );
}

function ClosingCTA() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 pt-28 pb-8 text-center md:px-10 md:pt-40">
      <Reveal>
        <h2 className="mx-auto max-w-[820px] font-medium text-[44px] tracking-[-0.035em] leading-[1.04] md:text-[68px]">
          Start planning for free.
        </h2>
        <p className="mx-auto mt-6 max-w-[560px] text-[18px] text-mkt-muted">
          Create your Church, invite your team, and complete Onboarding without a card.
        </p>
        <Link
          className="mt-9 inline-flex rounded-full bg-mkt-accent px-7 py-3 font-semibold text-[15px] text-mkt-accent-fg transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-mkt-fg focus-visible:outline-offset-2"
          to="/sign-in"
        >
          Get started free
        </Link>
      </Reveal>
    </section>
  );
}

function PricingPage() {
  const { headerSettle } = useHeaderEntrance();
  return (
    <>
      <PriceHero base={headerSettle} />
      <ComparePlans heroSettleMs={Math.round((headerSettle + 1.4) * 1000)} />
      <UpgradePath />
      <Details />
      <ClosingCTA />
      <div className="h-16" />
    </>
  );
}
