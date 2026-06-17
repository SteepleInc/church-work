import { createIsomorphicFn } from "@tanstack/react-start";

import { SIDEBAR_COOKIE_NAME } from "@/components/ui/sidebar";

/**
 * The shadcn `SidebarProvider` writes the `sidebar_state` cookie on every
 * toggle; we read it here so the correct expanded/collapsed state can be
 * rendered on the SSR first paint instead of always defaulting to expanded.
 */
const SIDEBAR_DEFAULT_OPEN = true;

function parseSidebarOpen(value: string | undefined): boolean {
  if (value === undefined) {
    return SIDEBAR_DEFAULT_OPEN;
  }
  return value === "true";
}

/**
 * Read the sidebar open/collapsed preference from its cookie. Works in both
 * contexts: on the server (SSR / navigation `beforeLoad`) it reads the request
 * cookies; on the client it reads `document.cookie`. Falls back to expanded.
 */
export const getSidebarOpen = createIsomorphicFn()
  .server(async () => {
    const { getCookie } = await import("@tanstack/react-start/server");
    return parseSidebarOpen(getCookie(SIDEBAR_COOKIE_NAME));
  })
  .client(() => {
    if (typeof document === "undefined") {
      return SIDEBAR_DEFAULT_OPEN;
    }
    const match = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${SIDEBAR_COOKIE_NAME}=`));
    return parseSidebarOpen(match?.split("=")[1]);
  });
