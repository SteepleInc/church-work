import { describe, expect, it } from "bun:test";

import { buildWeekTasksCsv, WEEK_ACTION_MENU_LABELS } from "./week-actions-data";

describe("Week actions", () => {
  it("exports only Tasks scoped to the selected Week as CSV", () => {
    const csv = buildWeekTasksCsv({
      cycleId: "week-1",
      tasks: [
        {
          identifier: "CT-1",
          title: "Prep sanctuary, chairs",
          taskState: "todo",
          workflowStatusName: "Todo",
          assignedUserName: "Ava",
          teamName: "Worship",
          dueDate: "2026-06-22",
          cycleId: "week-1",
        },
        {
          identifier: "CT-2",
          title: "Next week task",
          taskState: "todo",
          workflowStatusName: "Todo",
          assignedUserName: null,
          teamName: "Worship",
          dueDate: null,
          cycleId: "week-2",
        },
      ],
    });

    expect(csv).toBe(
      [
        "Identifier,Title,Status,Task state,Assignee,Team,Due date",
        'CT-1,"Prep sanctuary, chairs",Todo,todo,Ava,Worship,2026-06-22',
      ].join("\n"),
    );
  });

  it("keeps the scoped Week menu actions to the ones our domain supports", () => {
    expect(WEEK_ACTION_MENU_LABELS).toEqual([
      "Export tasks as CSV",
      "Open in new tab",
      "Open in new window",
      "Copy link",
    ]);
    // Weeks run a fixed Monday–Sunday span, so there is no date editing, and we
    // have no notification/favorite domain to subscribe or star a Week.
    expect(WEEK_ACTION_MENU_LABELS).not.toContain("Change dates");
    expect(WEEK_ACTION_MENU_LABELS).not.toContain("Notifications");
    expect(WEEK_ACTION_MENU_LABELS).not.toContain("Favorite");
  });
});
