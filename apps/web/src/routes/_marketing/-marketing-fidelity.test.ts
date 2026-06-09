import { describe, expect, test } from "bun:test";

const routeSource = await Bun.file(new URL("./route.tsx", import.meta.url)).text();
const homeSource = await Bun.file(new URL("./index.tsx", import.meta.url)).text();
const librarySource = await Bun.file(new URL("./library.tsx", import.meta.url)).text();
const marketingNavigationSource = await Bun.file(
  new URL("../../components/navigation/marketingNavigation.tsx", import.meta.url),
).text();
const mobileMarketingNavigationSource = await Bun.file(
  new URL("../../components/navigation/mobileMarketingNavigation.tsx", import.meta.url),
).text();
const stylesSource = await Bun.file(new URL("../../styles/globals.css", import.meta.url)).text();

describe("marketing PreachX fidelity guards", () => {
  test("keeps the copied PreachX marketing shell and navigation treatment", () => {
    expect(routeSource).toContain("document.documentElement.classList.add('marketing-dark')");
    expect(routeSource).toContain("/fonts/pangaia/PPPangaia-Variable.woff2");
    expect(routeSource).toContain("dark min-h-full bg-black pt-18 sm:pt-22");
    expect(routeSource).toContain(
      "fixed top-0 right-0 left-0 z-20 flex items-center bg-black px-6 py-4 text-primary sm:px-12 sm:py-6",
    );

    expect(marketingNavigationSource).toContain("motion.div");
    expect(marketingNavigationSource).toContain("font-medium font-serif text-3xl text-white");
    expect(marketingNavigationSource).toContain('to="/my-work"');
    expect(marketingNavigationSource).toContain("Sign In");

    expect(mobileMarketingNavigationSource).toContain('to="/library"');
    expect(mobileMarketingNavigationSource).toContain("Toggle Menu");
  });

  test("keeps the copied PreachX marketing layout classes with Church Task copy", () => {
    expect(homeSource).toContain("bg-cream px-6 py-34 sm:px-12");
    expect(homeSource).toContain("hidden min-h-[calc(100vh-168px)] lg:flex");
    expect(homeSource).toContain("Workflows For Churches");
    expect(homeSource).toContain("Shared task clarity, built for church teams.");
    expect(homeSource).toContain("Churches, Teams, Workflows, and Tasks");
    expect(homeSource).toContain("Built For Every Church Team");

    expect(librarySource).toContain("A working library for church operations.");
    expect(librarySource).toContain("My Work");
    expect(librarySource).toContain("Our Work");
    expect(librarySource).toContain("Settings");
  });

  test("uses the copied PreachX fonts and removes leftover sermon marketing copy", () => {
    expect(stylesSource).toContain('font-family: "PP Neue Montreal"');
    expect(stylesSource).toContain('font-family: "PP Pangaia"');
    expect(stylesSource).toContain("/fonts/neueMontreal/PPNeueMontreal-Variable.woff2");
    expect(stylesSource).toContain("/fonts/pangaia/PPPangaia-Variable.woff2");
    expect(stylesSource).toContain('--font-serif: "PP Pangaia"');

    const marketingSources = [homeSource, librarySource, marketingNavigationSource].join("\n");
    expect(marketingSources).not.toContain("PreachX");
    expect(marketingSources).not.toContain("Sermon");
    expect(marketingSources).not.toContain("sermon");
    expect(marketingSources).not.toContain("preacher");
    expect(marketingSources).not.toContain("royalty");
  });
});
