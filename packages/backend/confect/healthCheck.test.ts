import { describe, it } from "@effect/vitest";
import { assertEquals } from "@effect/vitest/utils";
import { Effect } from "effect";

import refs from "./_generated/refs";
import * as TestConfect from "../test/TestConfect";

describe("healthCheck", () => {
  it.effect("get returns OK", () =>
    Effect.gen(function* () {
      const c = yield* TestConfect.TestConfect;

      const result = yield* c.query(refs.public.healthCheck.get);

      assertEquals(result, "OK");
    }).pipe(Effect.provide(TestConfect.layer())),
  );
});
