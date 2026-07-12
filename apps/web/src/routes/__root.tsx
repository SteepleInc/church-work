import { Toaster } from "@/components/ui/sonner";
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";

import { HeightWrapper } from "@/components/height-wrapper";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ZeroRuntimeProvider } from "@/lib/zero-runtime-provider";
import { getSidebarOpen } from "@/shared/sidebar-cookie";

import "../index.css";

const APP_NAME = "Church Work";
const APP_TITLE = "Church Work — Shared task clarity for church teams";
const APP_DESCRIPTION =
  "Weeks, Templates & Teams. Coordinate recurring and project-based church work — without another spreadsheet — so every team knows what's next.";
const APP_URL = "https://churchwork.ai";

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
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content",
      },
      {
        title: APP_TITLE,
      },
      {
        name: "description",
        content: APP_DESCRIPTION,
      },
      {
        property: "og:title",
        content: APP_TITLE,
      },
      {
        property: "og:description",
        content: APP_DESCRIPTION,
      },
      {
        property: "og:site_name",
        content: APP_NAME,
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:url",
        content: APP_URL,
      },
      {
        property: "og:image",
        content: `${APP_URL}/opengraph.jpg`,
      },
      {
        property: "og:image:type",
        content: "image/jpeg",
      },
      {
        property: "og:image:width",
        content: "1200",
      },
      {
        property: "og:image:height",
        content: "630",
      },
      {
        property: "og:image:alt",
        content: APP_TITLE,
      },
      {
        property: "og:locale",
        content: "en_US",
      },
      {
        name: "theme-color",
        content: "#ffffff",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:title",
        content: APP_TITLE,
      },
      {
        name: "twitter:description",
        content: APP_DESCRIPTION,
      },
      {
        name: "twitter:image",
        content: `${APP_URL}/opengraph.jpg`,
      },
      {
        name: "twitter:image:alt",
        content: APP_TITLE,
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
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600;700&display=swap",
      },
      {
        rel: "icon",
        href: "/favicon.ico",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      {
        rel: "manifest",
        href: "/site.webmanifest",
      },
      {
        rel: "canonical",
        href: APP_URL,
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
        <AuthProvider>
          <ZeroRuntimeProvider>{children}</ZeroRuntimeProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
