import {
  FREE_PLAN_TASK_LIMIT,
  isTaskCountedForUsage,
  isUserTaskCreationBlocked,
  shouldShowTaskUsage,
} from "@church-work/domain";
import { queries } from "@church-work/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";

import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useChurchSubscription } from "@/data/subscriptions/subscriptionData.app";

export function useTaskUsagePolicy() {
  const { currentOrgOpt: church } = useCurrentOrgOpt();
  const zero = useZero();
  const requestedChurchId = church?.id ?? null;
  const churchId =
    zero.context?.authenticated === true && zero.context.active_church_id === requestedChurchId
      ? requestedChurchId
      : null;
  const [tasks, tasksResult] = useQuery(
    churchId ? queries.tasks.by_church({ church_id: churchId }) : undefined,
  );
  const [cycles, cyclesResult] = useQuery(
    churchId ? queries.cycles.by_church({ church_id: churchId }) : undefined,
  );
  const { loading: subscriptionLoading, subscriptionOpt } = useChurchSubscription({
    churchId: requestedChurchId,
  });
  const loading =
    requestedChurchId !== null &&
    (churchId === null ||
      subscriptionLoading ||
      tasksResult.type !== "complete" ||
      cyclesResult.type !== "complete");
  const cyclesById = new Map((cycles ?? []).map((cycle) => [cycle.id, cycle]));
  const usage = (tasks ?? []).filter((task) => {
    const cycle = task.cycle_id ? cyclesById.get(task.cycle_id) : null;
    return isTaskCountedForUsage({
      cycleDeletedAt: cycle?.deleted_at,
      cycleEndsAt: cycle?.ends_at,
      deletedAt: task.deleted_at,
      taskState: task.task_state,
    });
  }).length;

  return {
    blocked:
      churchId !== null &&
      !loading &&
      isUserTaskCreationBlocked({ usage, subscription: subscriptionOpt }),
    church,
    limit: FREE_PLAN_TASK_LIMIT,
    loading,
    showUsage:
      churchId !== null &&
      !loading &&
      shouldShowTaskUsage({ usage, subscription: subscriptionOpt }),
    usage,
  } as const;
}
