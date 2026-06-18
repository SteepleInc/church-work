export const WEEK_ACTION_MENU_LABELS = [
  "Export tasks as CSV",
  "Open in new tab",
  "Open in new window",
  "Copy link",
] as const;

export type WeekCsvTask = {
  readonly identifier: string;
  readonly title: string;
  readonly taskState: string;
  readonly workflowStatusName: string | null;
  readonly assignedUserName: string | null;
  readonly teamName: string | null;
  readonly dueDate: string | null;
  readonly cycleId: string | null;
};

export function buildWeekTasksCsv({
  cycleId,
  tasks,
}: {
  readonly cycleId: string;
  readonly tasks: readonly WeekCsvTask[];
}) {
  const rows = getWeekCsvTasks({ cycleId, tasks }).map((task) => [
    task.identifier,
    task.title,
    task.workflowStatusName ?? "",
    task.taskState,
    task.assignedUserName ?? "",
    task.teamName ?? "",
    task.dueDate ?? "",
  ]);

  return [["Identifier", "Title", "Status", "Task state", "Assignee", "Team", "Due date"], ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}

export function getWeekCsvTasks({
  cycleId,
  tasks,
}: {
  readonly cycleId: string;
  readonly tasks: readonly WeekCsvTask[];
}) {
  return tasks.filter((task) => task.cycleId === cycleId);
}

function csvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
