# Migration References

For PRD #164 implementation work, use the OpenCode references configured in `opencode.json` as the preferred implementation references:

- `drizzle` for Drizzle ORM, Drizzle Kit, migrations, and beta integration checks.
- `drizzle-zero` for `drizzle-zero` schema generation and beta integration checks.
- `zero` for Zero, `zero-cache`, query helpers, mutators, and generated schema conventions.
- `effect-smol` for the Effect v4 / effect-smol API shape used by Drizzle integration experiments.
- `preach-x` for package shape, Better Auth session/plugin patterns, Zero endpoint mounting, and local test ergonomics.

Legacy source checkouts, if present locally, are old-stack behavior references only. New code must not import them or use them as target architecture examples.
