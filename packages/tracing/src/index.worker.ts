import { tracing } from "cloudflare:workers";
import { Effect, Logger } from "effect";

import type { Layer } from "effect";
import type { TraceAttributes, TraceSpan } from "./span";

export type { TraceAttributes, TraceSpan } from "./span";

// workerd entry: backs the tracing helpers with Cloudflare's native
// `tracing.enterSpan`. Spans appear in the Workers Traces view, and any
// `console.*` output emitted while a span is active is attached to it as a
// span event. `tracing.enterSpan` is safe to import statically but must only
// be *called* from within a request handler (workerd forbids it at global
// scope).

/**
 * Runs `fn` inside a named Cloudflare trace span. The span ends when `fn`
 * returns or its returned promise settles.
 */
export const traceSpan = <T>(name: string, fn: (span: TraceSpan) => T): T =>
  tracing.enterSpan(name, fn);

/**
 * Wraps an Effect in a named Cloudflare trace span.
 *
 * Cloudflare spans are callback-scoped (no manual start/end), so the effect is
 * re-entered inside the `enterSpan` callback: the current context is captured,
 * and the effect runs as a fresh fiber via `runPromiseExitWith`, preserving
 * services/loggers and typed errors (the resulting `Exit` is flattened back
 * into the effect world). Interruption propagates through the `AbortSignal`
 * that `Effect.promise` provides.
 *
 * Intended for coarse-grained sections (route handlers, db transactions);
 * every use hops through a promise boundary.
 */
export const withTraceSpan =
  (name: string, attributes?: TraceAttributes) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.context<R>().pipe(
      Effect.flatMap((context) =>
        Effect.promise((signal) =>
          tracing.enterSpan(name, (span) => {
            if (attributes && span.isTraced) {
              for (const [key, value] of Object.entries(attributes)) {
                span.setAttribute(key, value);
              }
            }
            return Effect.runPromiseExitWith(context)(effect, { signal });
          }),
        ),
      ),
      Effect.flatten,
    );

/**
 * Logger configuration for server effects on Cloudflare Workers. Replaces the
 * default pretty console logger (workerd's `console.group` is a no-op, which
 * can swallow log lines) with structured console output that Workers Logs
 * indexes by field, plus the tracer logger that mirrors logs onto Effect
 * spans.
 */
export const loggerLayer: Layer.Layer<never> = Logger.layer([
  Logger.consoleStructured,
  Logger.tracerLogger,
]);
