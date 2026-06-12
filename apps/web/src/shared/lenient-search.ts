import { Either, Schema } from "effect";

/**
 * An optional URL search field that degrades to `undefined` instead of failing
 * the whole route when its value is malformed. Shared links with bad or stale
 * params must never error a page (ADR 0010 — chrome always renders); they just
 * fall back to defaults.
 */
export function lenientSearchField<A, I>(schema: Schema.Schema<A, I>) {
  return Schema.optional(
    Schema.UndefinedOr(schema).annotations({
      decodingFallback: () => Either.right(undefined),
    }),
  );
}
