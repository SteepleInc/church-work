import { FREE_PLAN_TASK_LIMIT } from "@church-work/domain";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import { canManageSubscription } from "@/features/billing/billing-helpers";
import { useTaskUsagePolicy } from "@/features/billing/use-task-usage-policy";

/** One Sonner id so repeated blocked attempts update a single notification. */
export const TASK_LIMIT_TOAST_ID = "free-plan-task-limit";

export const TASK_LIMIT_TITLE = "Free Plan Task Limit reached";

/**
 * Role-aware one-line explanation for disabled creation controls. Owners and
 * admins are pointed at Church Billing; members are told who can upgrade —
 * they never see payment details (mirrors PastDueBanner).
 */
export function taskLimitMessage(canManage: boolean): string {
  return canManage
    ? `${TASK_LIMIT_TITLE} — upgrade to Paid in Church Billing to create more Tasks.`
    : `${TASK_LIMIT_TITLE} — a Church owner or admin can upgrade to Paid to create more Tasks.`;
}

/**
 * The one Free Plan Task Limit seam for every user-initiated control that
 * would create a new Task identity: standard creation, Task Draft conversion,
 * Subtask creation, and user materialization of a projected Template Task.
 *
 * `blocked` disables the control, `message` is its explanatory tooltip, and
 * `notify` raises the Sonner notification used by keyboard shortcuts and
 * clicks on aria-disabled controls instead of opening creation UI.
 */
export function useTaskCreationGate() {
  const navigate = useNavigate();
  const policy = useTaskUsagePolicy();
  const canManage = canManageSubscription(policy.church?.role ?? "member");

  const notify = useCallback(() => {
    toast.error(TASK_LIMIT_TITLE, {
      id: TASK_LIMIT_TOAST_ID,
      description: canManage
        ? `This Church has ${FREE_PLAN_TASK_LIMIT} or more counted Tasks in the Active Planning Horizon. Upgrade to Paid in Church Billing to create more — existing and scheduled work stays available.`
        : `This Church has ${FREE_PLAN_TASK_LIMIT} or more counted Tasks in the Active Planning Horizon. A Church owner or admin can upgrade to Paid — existing and scheduled work stays available.`,
      ...(canManage
        ? {
            action: {
              label: "View Billing",
              onClick: () => void navigate({ to: "/settings/workspace/billing" }),
            },
          }
        : {}),
    });
  }, [canManage, navigate]);

  const blocked = policy.blocked;
  return useMemo(
    () => ({ blocked, canManage, message: taskLimitMessage(canManage), notify }) as const,
    [blocked, canManage, notify],
  );
}
