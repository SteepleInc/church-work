/**
 * Runtime-agnostic view of a trace span. Mirrors the surface of Cloudflare's
 * `Span` from `cloudflare:workers` so callers can annotate spans without
 * depending on workerd types.
 */
export interface TraceSpan {
  readonly isTraced: boolean;
  setAttribute(key: string, value: string | number | boolean | undefined): void;
}

export type TraceAttributes = Record<string, string | number | boolean | undefined>;
