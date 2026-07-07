import { traceSpan } from "@church-work/tracing";
import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";

// Providing a start instance replaces TanStack Start's built-in request
// middleware, so the framework's default CSRF protection must be re-added
// explicitly. This mirrors the default exactly: validate server-function
// requests only.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// Wraps every server-handled request (SSR document renders, server routes,
// and server functions) in a named Cloudflare trace span so request logs and
// child spans (e.g. the tracer API's route spans) group under it in the
// Workers Traces view. No-op outside Cloudflare Workers.
const tracingMiddleware = createMiddleware({ type: "request" }).server(
  ({ handlerType, next, pathname, request }) =>
    traceSpan(`${request.method} ${pathname}`, (span) => {
      span.setAttribute("http.request.method", request.method);
      span.setAttribute("url.path", pathname);
      span.setAttribute("start.handler_type", handlerType);
      return next();
    }),
);

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, tracingMiddleware],
}));
