import { Effect, Option, Schema } from "effect";

/**
 * An optional URL search field that degrades to `undefined` instead of failing
 * the whole route when its value is malformed. Shared links with bad or stale
 * params must never error a page (ADR 0010 — chrome always renders); they just
 * fall back to defaults.
 */
export function lenientSearchField<A>(schema: Schema.ConstraintDecoder<A, never>) {
  return Schema.optional(
    Schema.UndefinedOr(schema).pipe(
      Schema.catchDecoding(() => Effect.succeed(Option.some(undefined))),
    ),
  );
}
