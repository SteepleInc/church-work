import { Toaster } from "@/components/ui/sonner";
import { HeadContent, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { HeightWrapper } from "@/components/height-wrapper";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

import "../index.css";

export interface RouterAppContext {}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      {
        title: "church-task",
      },
      {
        name: "description",
        content: "church-task is a web application",
      },
    ],
    links: [
      {
        as: "font",
        crossOrigin: "anonymous",
        href: "/fonts/neueMontreal/PPNeueMontreal-Variable.woff2",
        rel: "preload",
        type: "font/woff2",
      },
      {
        as: "font",
        crossOrigin: "anonymous",
        href: "/fonts/pangaia/PPPangaia-Variable.woff2",
        rel: "preload",
        type: "font/woff2",
      },
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
});

function RootComponent() {
  return (
    <>
      <HeadContent />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
        storageKey="vite-ui-theme"
      >
        <TooltipProvider>
          <HeightWrapper>
            <Outlet />
          </HeightWrapper>
          <Toaster richColors />
        </TooltipProvider>
      </ThemeProvider>
      <TanStackRouterDevtools position="bottom-right" />
    </>
  );
}
