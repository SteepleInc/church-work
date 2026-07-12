import { queries } from "@church-work/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";

/**
 * The Church Subscription row synced through Zero for one Church. Absence of a
 * row (or a non-paying status) means the Church is on the Free Plan — webhook
 * state is authoritative, so a Checkout redirect alone never flips this.
 */
export function useChurchSubscription(params: { readonly churchId: string | null }) {
  const zero = useZero();
  const churchId =
    zero.context?.authenticated === true && zero.context.active_church_id === params.churchId
      ? params.churchId
      : null;
  const [subscription, result] = useQuery(
    churchId ? queries.subscription.by_church({ church_id: churchId }) : undefined,
  );

  return {
    loading: params.churchId !== null && (churchId === null || result.type !== "complete"),
    subscriptionOpt: subscription ?? null,
  };
}
