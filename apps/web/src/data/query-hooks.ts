import { Ref } from "@confect/core";
import { QueryResult } from "@confect/react";
import {
  usePaginatedQuery as useCachedPaginatedQuery,
  useQuery as useCachedConvexQuery,
} from "convex-helpers/react/cache";
import type { FunctionReference } from "convex/server";
import { Option } from "effect";

/**
 * The only sanctioned query hooks in apps/web (ADR 0011).
 *
 * `useQuery` is a drop-in for `@confect/react`'s `useQuery`, rebuilt on the
 * convex-helpers query cache so subscriptions stay alive after unmount and
 * revisited surfaces render synchronously from cache (ADR 0010). Confect's own
 * hook hard-codes `convex/react` and would silently bypass the cache.
 *
 * `useConvexQuery`/`usePaginatedQuery` are the cache-backed hooks for plain
 * Convex function references, for call sites not yet on Confect refs.
 */

type UseQueryArgs<Query extends Ref.AnyPublicQuery> = keyof Ref.Args<Query> extends never
  ? [args?: Ref.Args<Query> | "skip"]
  : [args: Ref.Args<Query> | "skip"];

export const useQuery = <Query extends Ref.AnyPublicQuery>(
  ref: Query,
  ...rest: UseQueryArgs<Query>
): QueryResult.QueryResult<Ref.Returns<Query>, Ref.Error<Query>> => {
  const functionReference = Ref.getFunctionReference(ref) as FunctionReference<"query">;
  const args = rest[0];
  const encodedArgs =
    args === "skip" ? "skip" : Ref.encodeArgsSync(ref, (args ?? {}) as Ref.Args<Query>);

  try {
    // The cache hook rethrows query errors during render, exactly like
    // convex/react's useQuery, so Confect's catch pattern transplants as-is.
    const encodedReturnsOrUndefined = useCachedConvexQuery(
      functionReference,
      encodedArgs as Parameters<typeof useCachedConvexQuery>[1],
    );

    if (encodedReturnsOrUndefined === undefined) {
      return QueryResult.load(args === "skip");
    }

    return QueryResult.succeed(Ref.decodeReturnsSync(ref, encodedReturnsOrUndefined));
  } catch (error) {
    if (Ref.isConvexError(error)) {
      const decoded = Ref.decodeErrorSync(ref, error.data);
      if (Option.isSome(decoded)) {
        return QueryResult.fail(decoded.value);
      }
    }
    throw error;
  }
};

export { QueryResult };
export { useCachedConvexQuery as useConvexQuery, useCachedPaginatedQuery as usePaginatedQuery };
