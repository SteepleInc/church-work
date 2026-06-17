import "./telemetry";

import { RouterProvider, createRouter } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";

import { ZeroRuntimeProvider } from "./lib/zero-runtime-provider";
import { routeTree } from "./routeTree.gen";

// No defaultPendingComponent and no route loaders: Render Gates are forbidden
// (see docs/adr/0010-no-render-gates.md). Zero owns synced product reads.
const router = createRouter({
  routeTree,
  scrollRestoration: true,
  context: {},
  Wrap: function WrapComponent({ children }: { children: React.ReactNode }) {
    return <ZeroRuntimeProvider>{children}</ZeroRuntimeProvider>;
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("app");

if (!rootElement) {
  throw new Error("Root element not found");
}

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<RouterProvider router={router} />);
}
