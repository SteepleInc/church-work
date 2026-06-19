import { describe, expect, test } from "bun:test";

import { buildTemplateSchedulesCollection, buildTemplatesCollection } from "./templatesData.app";

describe("template library data seams", () => {
  const templates = [
    { id: "template-weekly", key: "weekly", name: "Sunday Service", recurrence: "weekly" },
    { id: "template-unscheduled", key: "unscheduled", name: "Guest Follow-up", recurrence: "none" },
  ];

  test("library includes unscheduled Templates with schedule and task summaries", () => {
    expect(
      buildTemplatesCollection({
        schedules: [
          {
            id: "schedule-1",
            key: "sunday-am",
            kind: "weekly",
            name: "Sunday AM",
            recurrence: "repeating",
            start_date: "2026-06-21",
            template_id: "template-weekly",
          },
        ],
        tasks: [{ template_id: "template-weekly" }, { template_id: "template-unscheduled" }],
        templates,
      }),
    ).toEqual([
      {
        id: "template-weekly",
        key: "weekly",
        name: "Sunday Service",
        placementShape: null,
        recurrence: "weekly",
        scheduleCount: 1,
        taskCount: 1,
      },
      {
        id: "template-unscheduled",
        key: "unscheduled",
        name: "Guest Follow-up",
        placementShape: null,
        recurrence: "none",
        scheduleCount: 0,
        taskCount: 1,
      },
    ]);
  });

  test("schedules join to Template names and expose next occurrence scaffolding", () => {
    expect(
      buildTemplateSchedulesCollection({
        schedules: [
          {
            id: "schedule-1",
            key: "sunday-am",
            kind: "weekly",
            name: "Sunday AM",
            recurrence: "repeating",
            start_date: "2026-06-21",
            template_id: "template-weekly",
          },
          {
            id: "schedule-2",
            key: "easter",
            kind: "key_date",
            name: "Easter Prep",
            recurrence: "one_off",
            start_date: "2026-04-05",
            template_id: "missing-template",
          },
        ],
        templates,
        today: "2026-06-19",
      }),
    ).toEqual([
      {
        id: "schedule-1",
        key: "sunday-am",
        kind: "weekly",
        kindLabel: "Weekly",
        name: "Sunday AM",
        nextOccurrence: "2026-06-21",
        recentUsage: "Usage history coming soon",
        recurrence: "repeating",
        templateId: "template-weekly",
        templateName: "Sunday Service",
      },
      {
        id: "schedule-2",
        key: "easter",
        kind: "key_date",
        kindLabel: "Key Date",
        name: "Easter Prep",
        nextOccurrence: null,
        recentUsage: "Usage history coming soon",
        recurrence: "one_off",
        templateId: "missing-template",
        templateName: "Unknown Template",
      },
    ]);
  });
});
