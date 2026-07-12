import { hasPaidEntitlements, type ChurchSubscriptionState } from "./billing";

export const FREE_PLAN_TASK_USAGE_NOTICE_THRESHOLD = 200;
export const FREE_PLAN_TASK_LIMIT = 300;
export const FREE_PLAN_TASK_LIMIT_ERROR =
  "This Church has reached the Free Plan limit of 300 planned Tasks.";

export type TaskUsageCandidate = {
  readonly deletedAt?: Date | number | null;
  readonly taskState: string;
  readonly cycleEndsAt?: Date | number | null;
  readonly cycleDeletedAt?: Date | number | null;
};

const epoch = (value: Date | number): number => (value instanceof Date ? value.getTime() : value);

/** Counts real Tasks in the Active Planning Horizon. Projections have no Task row. */
export function isTaskCountedForUsage(
  task: TaskUsageCandidate,
  now: Date | number = Date.now(),
): boolean {
  if (task.deletedAt != null || task.taskState === "canceled") return false;
  if (!(["todo", "in_progress", "done"] as const).includes(task.taskState as never)) return false;
  if (task.cycleEndsAt == null) return task.taskState === "todo";
  if (task.cycleDeletedAt != null) return false;
  return epoch(task.cycleEndsAt) > epoch(now);
}

export function taskUsage(tasks: readonly TaskUsageCandidate[], now?: Date | number): number {
  return tasks.filter((task) => isTaskCountedForUsage(task, now)).length;
}

export function isUserTaskCreationBlocked(input: {
  readonly usage: number;
  readonly subscription: ChurchSubscriptionState | null;
  readonly now?: Date | number;
}): boolean {
  return !hasPaidEntitlements(input.subscription, input.now) && input.usage >= FREE_PLAN_TASK_LIMIT;
}

export function shouldShowTaskUsage(input: {
  readonly usage: number;
  readonly subscription: ChurchSubscriptionState | null;
  readonly now?: Date | number;
}): boolean {
  return (
    !hasPaidEntitlements(input.subscription, input.now) &&
    input.usage > FREE_PLAN_TASK_USAGE_NOTICE_THRESHOLD
  );
}
