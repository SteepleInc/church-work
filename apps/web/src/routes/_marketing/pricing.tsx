import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
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

const FREE_FEATURES = [
  "Unlimited Users",
  "Unlimited Teams",
  "Up to 300 planned Tasks",
] as const;
const PAID_FEATURES = [
  "Unlimited Users",
  "Unlimited Teams",
  "Unlimited product usage",
] as const;

function Check() {
  return (
    <span
      aria-hidden
      className="mt-0.5 flex size-[18px] flex-none items-center justify-center rounded-full bg-[oklch(0.88_0.18_95)] text-mkt-accent-fg"
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

function PlanCard({
  dark,
  features,
  label,
  price,
  suffix,
  children,
}: {
  readonly dark?: boolean;
  readonly features: readonly string[];
  readonly label: string;
  readonly price: string;
  readonly suffix: string;
  readonly children: ReactNode;
}) {
  return (
    <article
      className={
        dark
          ? "mesh-price rounded-[28px] p-7 text-white md:p-10"
          : "rounded-[28px] border border-mkt-border bg-mkt-bg p-7 md:p-10"
      }
    >
      <p
        className={
          dark
            ? "font-semibold text-sm text-white/60"
            : "font-semibold text-sm text-mkt-muted"
        }
      >
        {label}
      </p>
      <div className="mt-5 flex flex-wrap items-end gap-2">
        <span className="font-medium text-6xl tracking-[-0.04em] md:text-7xl">
          {price}
        </span>
        <span className={dark ? "pb-2 text-white/60" : "pb-2 text-mkt-muted"}>
          {suffix}
        </span>
      </div>
      <ul className="mt-8 space-y-3">
        {features.map((feature) => (
          <li className="flex items-start gap-3" key={feature}>
            <Check />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {children}
    </article>
  );
}

function PriceHero({ base }: { readonly base: number }) {
  return (
    <section className="mx-auto max-w-[1200px] px-6 pt-16 md:px-10 md:pt-24">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: 24 }}
        transition={{ delay: Math.max(0, base - 0.3), duration: 0.8 }}
      >
        <p className="cw-eyebrow text-center">
          Free to start. One clear upgrade.
        </p>
        <h1 className="mx-auto mt-7 max-w-[900px] text-center font-medium text-[48px] tracking-[-0.035em] leading-[1.04] md:text-[76px]">
          Plan the work now. Upgrade when you need more room.
        </h1>
        <p className="mx-auto mt-6 max-w-[650px] text-center text-[18px] text-mkt-muted leading-relaxed">
          Every Church starts free with no card required. Both plans include
          unlimited Users and Teams—never per-seat pricing.
        </p>
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mt-12 grid gap-5 md:mt-14 md:grid-cols-2"
        initial={{ opacity: 0, y: 40 }}
        transition={{
          delay: Math.max(0, base + 0.45),
          duration: 0.9,
          ease: RISE_EASE,
        }}
      >
        <PlanCard
          features={FREE_FEATURES}
          label="Free Plan"
          price="$0"
          suffix="forever"
        >
          <p className="mt-7 text-sm text-mkt-muted leading-relaxed">
            Planned Tasks are real Tasks in your current or future planning
            horizon, plus Week-less To Do work. Past work and projected Template
            work do not use the allowance.
          </p>
          <Link
            className="mt-8 inline-flex rounded-full bg-[oklch(0.88_0.18_95)] px-7 py-3 font-semibold text-[15px] text-mkt-accent-fg transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2"
            to="/sign-in"
          >
            Start free
          </Link>
          <p className="mt-4 text-xs text-mkt-muted">No card required</p>
        </PlanCard>
        <PlanCard
          dark
          features={PAID_FEATURES}
          label="Paid Plan"
          price="$19.99 USD"
          suffix="per Church per week"
        >
          <p className="mt-7 text-sm text-white/65 leading-relaxed">
            Billed weekly only, including applicable tax. Sign up on Free, then
            an owner or admin can upgrade from Church Billing settings.
          </p>
          <Link
            className="mt-8 inline-flex rounded-full bg-[oklch(0.88_0.18_95)] px-7 py-3 font-semibold text-[15px] text-mkt-accent-fg transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2"
            to="/sign-in"
          >
            Start free, upgrade later
          </Link>
        </PlanCard>
      </motion.div>
    </section>
  );
}

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
] as const;

function Details({ heroSettleMs }: { readonly heroSettleMs: number }) {
  return (
    <section className="mx-auto max-w-[1200px] px-6 pt-28 md:px-10 md:pt-36">
      <Reveal holdUntil={heroSettleMs}>
        <p className="cw-eyebrow">Good to know</p>
        <h2 className="mt-5 max-w-[760px] font-medium text-[40px] tracking-[-0.03em] leading-[1.05] md:text-[56px]">
          Clear limits. No hidden billing paths.
        </h2>
      </Reveal>
      <dl className="mt-10 grid gap-x-12 sm:grid-cols-2">
        {FAQS.map((faq, i) => (
          <Reveal
            className="border-mkt-border border-t py-7"
            delay={i * 70}
            key={faq.q}
          >
            <dt className="font-medium text-[18px]">{faq.q}</dt>
            <dd className="mt-2 text-[15px] text-mkt-muted leading-relaxed">
              {faq.a}
            </dd>
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
          Create your Church, invite your team, and complete Onboarding without
          a card.
        </p>
        <Link
          className="mt-9 inline-flex rounded-full bg-[oklch(0.88_0.18_95)] px-7 py-3 font-semibold text-[15px] text-mkt-accent-fg transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2"
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
      <Details heroSettleMs={Math.round((headerSettle + 1.4) * 1000)} />
      <ClosingCTA />
      <div className="h-16" />
    </>
  );
}
