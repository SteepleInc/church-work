import { Layer } from "effect";

import type { Effect } from "effect";
import type { TraceAttributes, TraceSpan } from "./span";

export type { TraceAttributes, TraceSpan } from "./span";

// Default (Node/Bun) entry: tracing is a Cloudflare Workers runtime feature,
// so outside workerd every helper is a no-op passthrough. The `workerd` export
// condition swaps in `index.worker.ts`, which backs these with
// `tracing.enterSpan` from `cloudflare:workers`.

const noopSpan: TraceSpan = {
  isTraced: false,
  setAttribute: () => {},
};

/**
 * Runs `fn` inside a named trace span. No-op span outside Cloudflare Workers.
 */
export const traceSpan = <T>(_name: string, fn: (span: TraceSpan) => T): T => fn(noopSpan);

/**
 * Wraps an Effect in a named trace span. Passthrough outside Cloudflare
 * Workers.
 */
export const withTraceSpan =
  (_name: string, _attributes?: TraceAttributes) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    effect;

/**
 * Logger configuration for server effects. Outside Cloudflare Workers the
 * default (pretty) console logger is kept, so this is the empty layer.
 */
export const loggerLayer: Layer.Layer<never> = Layer.empty;
