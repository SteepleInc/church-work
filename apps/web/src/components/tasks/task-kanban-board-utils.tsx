import type { MutableRefObject } from "react";

import { WorkflowStatusIcon, type CardSelectOption } from "./task-card-fields";
import type { TaskBoardWorkflowStatus } from "./task-kanban-adapter";

export type PickerHotkey = {
  readonly key: string;
  readonly shift?: boolean;
  readonly openRef: MutableRefObject<(() => void) | null>;
};

export function matchPickerHotkey(
  event: Pick<KeyboardEvent, "key" | "shiftKey" | "metaKey" | "ctrlKey" | "altKey">,
  hotkeys: readonly PickerHotkey[],
): PickerHotkey | null {
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  const key = event.key.toLowerCase();
  return (
    hotkeys.find(
      (hotkey) => hotkey.key.toLowerCase() === key && Boolean(hotkey.shift) === event.shiftKey,
    ) ?? null
  );
}

export function statusOptions(
  workflowStatuses: readonly TaskBoardWorkflowStatus[],
): readonly CardSelectOption<string>[] {
  return [...workflowStatuses]
    .filter((status) => status.archivedAt == null)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((status) => ({
      value: status.id,
      label: status.name,
      icon: <WorkflowStatusIcon taskState={status.taskState} />,
    }));
}
