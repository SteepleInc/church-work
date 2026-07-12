import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTaskCreationGate } from "@/features/billing/task-creation-gate";

/**
 * The per-column / per-group "+" that files a new Task into that column,
 * shared by the Board and List surfaces. At the Free Plan Task Limit it reads
 * as disabled (aria-disabled, dimmed) but stays hoverable so its role-aware
 * tooltip explains why; clicking raises the shared Sonner notification
 * instead of opening the creation dialog.
 */
export function AddTaskColumnButton({
  columnTitle,
  onAddTask,
}: {
  readonly columnTitle: string;
  readonly onAddTask: () => void;
}) {
  const taskCreationGate = useTaskCreationGate();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-disabled={taskCreationGate.blocked || undefined}
            aria-label={`Add Task to ${columnTitle}`}
            className={taskCreationGate.blocked ? "cursor-not-allowed opacity-50" : undefined}
            onClick={(event) => {
              // The List group header toggles collapse on double click; keep
              // the "+" from feeding that gesture.
              event.stopPropagation();
              if (taskCreationGate.blocked) {
                taskCreationGate.notify();
                return;
              }
              onAddTask();
            }}
            size="icon-xs"
            type="button"
            variant="ghost"
          />
        }
      >
        <PlusIcon />
      </TooltipTrigger>
      {taskCreationGate.blocked ? (
        <TooltipContent className="max-w-64">{taskCreationGate.message}</TooltipContent>
      ) : (
        <TooltipContent>
          Add Task... <Kbd>C</Kbd>
        </TooltipContent>
      )}
    </Tooltip>
  );
}
