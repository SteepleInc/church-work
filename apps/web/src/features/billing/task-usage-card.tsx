import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { canManageSubscription } from "@/features/billing/billing-helpers";
import { useTaskUsagePolicy } from "@/features/billing/use-task-usage-policy";

export function TaskUsageCard() {
  const policy = useTaskUsagePolicy();
  if (!policy.church || !policy.showUsage) return null;
  const canManage = canManageSubscription(policy.church.role);

  return (
    <aside
      className="mx-4 mb-2 flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm"
      aria-label="Task Usage"
    >
      <p className="min-w-0 flex-1">
        <span className="font-medium">
          Task Usage: {policy.usage} of {policy.limit}
        </span>{" "}
        <span className="text-muted-foreground">
          {policy.blocked
            ? canManage
              ? "Upgrade to Paid to create more Tasks. Existing and scheduled work remains available."
              : "A Church owner or admin must upgrade to Paid to create more Tasks. Existing work remains available."
            : "Free Plan Tasks in the Active Planning Horizon."}
        </span>
      </p>
      {canManage ? (
        <Button asChild size="xs" variant="outline">
          <Link to="/settings/workspace/billing">View Billing</Link>
        </Button>
      ) : null}
    </aside>
  );
}
