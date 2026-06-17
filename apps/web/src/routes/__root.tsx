import { Toaster } from "@/components/ui/sonner";
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";

import { HeightWrapper } from "@/components/height-wrapper";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ZeroRuntimeProvider } from "@/lib/zero-runtime-provider";
import { getSidebarOpen } from "@/shared/sidebar-cookie";

import "../index.css";

export const Route = createRootRoute({
  // Read presentation-preference cookies up front so the SSR first paint
  // matches the persisted state (e.g. sidebar expanded/collapsed) instead of
  // flashing the default. This is a small framework-local concern, not a
  // product-data Render Gate (ADR 0010).
  beforeLoad: async () => ({
    sidebarOpen: await getSidebarOpen(),
  }),
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
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
});

function RootComponent() {
  return (
    <RootDocument>
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
    </RootDocument>
  );
}

function RootDocument({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ZeroRuntimeProvider>{children}</ZeroRuntimeProvider>
        <Scripts />
      </body>
    </html>
  );
}
