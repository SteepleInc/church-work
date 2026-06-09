import { MarketingNavigation } from "@/components/navigation/marketingNavigation";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_marketing")({
  component: MarketingLayoutComponent,
  head: () => ({
    links: [
      {
        as: "font",
        crossOrigin: "anonymous",
        href: "/fonts/pangaia/PPPangaia-Variable.woff2",
        rel: "preload",
        type: "font/woff2",
      },
    ],
    scripts: [
      {
        children: "document.documentElement.classList.add('marketing-dark')",
      },
    ],
  }),
});

function MarketingLayoutComponent() {
  useEffect(() => {
    document.documentElement.classList.add("marketing-dark");
    return () => document.documentElement.classList.remove("marketing-dark");
  }, []);

  return (
    <div className="dark min-h-full bg-black pt-18 sm:pt-22">
      <div className="fixed top-0 right-0 left-0 z-20 flex items-center bg-black px-6 py-4 text-primary sm:px-12 sm:py-6">
        <div className="flex w-full items-center justify-between">
          <MarketingNavigation />
        </div>
      </div>
      <Outlet />
    </div>
  );
}
