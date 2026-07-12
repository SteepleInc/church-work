import { describe, expect, test } from "bun:test";

const routeSource = await Bun.file(
  new URL("./route.tsx", import.meta.url),
).text();
const shellSource = await Bun.file(
  new URL("./-marketing-shell.tsx", import.meta.url),
).text();
const homeSource = await Bun.file(
  new URL("./index.tsx", import.meta.url),
).text();
const pricingSource = await Bun.file(
  new URL("./pricing.tsx", import.meta.url),
).text();
const librarySource = await Bun.file(
  new URL("./library.tsx", import.meta.url),
).text();
const marketingNavigationSource = await Bun.file(
  new URL(
    "../../components/navigation/marketingNavigation.tsx",
    import.meta.url,
  ),
).text();
const mobileMarketingNavigationSource = await Bun.file(
  new URL(
    "../../components/navigation/mobileMarketingNavigation.tsx",
    import.meta.url,
  ),
).text();
const stylesSource = await Bun.file(
  new URL("../../styles/globals.css", import.meta.url),
).text();

describe("marketing shell and navigation treatment", () => {
  test("light pages share one persistent shell; library opts out into its own dark shell", () => {
    // No global class toggling. The layout mounts the persistent light shell
    // for home/pricing and lets the library page render bare.
    expect(routeSource).not.toContain("marketing-dark");
    expect(routeSource).toContain("MarketingShell");
    expect(routeSource).toContain("<Outlet />");

    // The shared shell — not the individual pages — owns the scroll surface and
    // the Header, so the chrome animates once and survives navigation.
    expect(shellSource).toContain("export function MarketingShell");
    expect(shellSource).toContain("marketing-page");
    expect(shellSource).toContain("<Header />");
    expect(shellSource).toContain("<Outlet />");

    // Pages no longer mount their own Header or scroll wrapper.
    expect(homeSource).not.toContain("<Header");
    expect(pricingSource).not.toContain("<Header");
    expect(homeSource).not.toContain("overflow-y-auto");
    expect(pricingSource).not.toContain("overflow-y-auto");

    // The library page brings its own dark shell + nav and font preload.
    expect(librarySource).toContain("/fonts/pangaia/PPPangaia-Variable.woff2");
    expect(librarySource).toContain("dark min-h-full bg-black");
    expect(librarySource).toContain("MarketingNavigation");

    expect(marketingNavigationSource).toContain("motion.div");
    expect(marketingNavigationSource).toContain('to="/my-work"');
    expect(marketingNavigationSource).toContain("Sign In");

    expect(mobileMarketingNavigationSource).toContain('to="/library"');
    expect(mobileMarketingNavigationSource).toContain("Toggle Menu");
  });

  test("home route renders the Church Work landing page", () => {
    expect(homeSource).toContain("Shared task clarity");
    expect(homeSource).toContain("church teams");
    expect(homeSource).toContain("One Shared Plan");
    expect(homeSource).toContain("for Church Work");
    expect(homeSource).toContain("Weeks & Planning");
    expect(homeSource).toContain("What church teams say");
    expect(homeSource).toContain("Feb 02, 2026");

    // The medical/SaaS source copy is fully replaced.
    expect(homeSource).not.toContain("medical practice");
    expect(homeSource).not.toContain("Payments & Subscriptions");
  });

  test("pricing accurately presents Free and Paid plans", () => {
    expect(pricingSource).toContain("Free Plan");
    expect(pricingSource).toContain("$0");
    expect(pricingSource).toContain("300 planned Tasks");
    expect(pricingSource).toContain("Paid Plan");
    expect(pricingSource).toContain("$19.99 USD");
    expect(pricingSource).toContain("per Church per week");
    expect(pricingSource).toContain("including applicable tax");
    expect(pricingSource).toContain('to="/sign-in"');
    expect(pricingSource).not.toContain("pay monthly");
    expect(pricingSource).not.toContain("nothing to upgrade to");
  });

  test("marketing pages use semantic dark-mode tokens, not a scoped theme island", () => {
    // Page chrome uses the mkt-* palette utilities that respond to dark mode…
    expect(homeSource).toContain("bg-mkt-bg");
    expect(homeSource).toContain("text-mkt-fg");
    expect(homeSource).toContain("text-mkt-muted");

    // …and those tokens are defined with light + dark variants.
    expect(stylesSource).toContain("--mkt-bg:");
    expect(stylesSource).toContain("--color-mkt-bg: var(--mkt-bg)");

    // The old scoped theme-island and global-class hacks are gone.
    expect(stylesSource).not.toContain(".nixole-page");
    expect(stylesSource).not.toContain("marketing-dark");

    // The signature mesh + marquee still ship.
    expect(homeSource).toContain("mesh-showcase");
    expect(homeSource).toContain("animate-marquee");
    expect(stylesSource).toContain('"Inter Tight"');
    expect(stylesSource).toContain(".mesh-showcase");

    // The library page keeps its existing copy.
    expect(librarySource).toContain("My Work");
    expect(librarySource).toContain("Our Work");
    expect(librarySource).toContain("Settings");
  });
});
