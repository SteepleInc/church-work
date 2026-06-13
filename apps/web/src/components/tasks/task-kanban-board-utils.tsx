import type { MutableRefObject } from "react";

import { WorkflowStatusIcon, type CardSelectOption } from "./task-card-fields";
import type { TaskBoardWorkflowStatus } from "./task-kanban-adapter";

export type PickerHotkey = {
  readonly key: string;
  readonly shift?: boolean;
  readonly openRef: MutableRefObject<(() => void) | null>;
};

// Avoid hijacking shortcut keys while the user is typing in a field (e.g.
// another open combobox/search box, or the dialog title/description inputs).
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

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
