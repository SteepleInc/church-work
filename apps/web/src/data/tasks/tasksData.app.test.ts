import { describe, expect, test } from "bun:test";

import {
  buildProjectedTemplateTasksForCycle,
  buildTemplateSourceBadge,
  getTemplateScheduleColorClassName,
  getTemplateScheduleDotClassName,
} from "./tasksData.app";

describe("scheduled Template projections for Cycle surfaces", () => {
  test("projects weekly Template Tasks into earlier Cycle To Do work with stable source badges", () => {
    const projections = buildProjectedTemplateTasksForCycle({
      cycle: { endDate: "2026-06-14", id: "cycle_2026_06_08", startDate: "2026-06-08" },
      existingTasks: [],
      schedules: [
        {
          church_id: "church_1",
          end_date: null,
          id: "templateschedule_sunday_service",
          kind: "weekly",
          name: "Sunday Service",
          recurrence: "repeating",
          rule: JSON.stringify({ kind: "weekly", weekdays: [0] }),
          start_date: "2026-06-21",
          template_id: "template_service",
        },
      ] as never,
      teamFilterId: "team_worship",
      templateTasks: [
        {
          assigned_user_id: "user_worship",
          description: "Pick songs before the service.",
          estimate: "m",
          id: "templatetask_plan_setlist",
          label_ids: JSON.stringify(["label_music"]),
          placement_cycle_offset: -1,
          placement_weekday: 3,
          template_id: "template_service",
          template_team_id: "templateteam_worship",
          title: "Plan setlist",
        },
      ] as never,
      templateTeams: [{ id: "templateteam_worship", mapped_team_id: "team_worship" }] as never,
      workflows: [{ id: "workflow_worship", team_id: "team_worship" }] as never,
      workflowStatuses: [
        {
          archived_at: null,
          id: "workflowstatus_todo",
          task_state: "todo",
          workflow_id: "workflow_worship",
        },
      ] as never,
    });

    expect(projections).toHaveLength(1);
    expect(projections[0]).toMatchObject({
      dueDate: "2026-06-10",
      id: "projected-template-task:templateschedule_sunday_service:templatetask_plan_setlist:weekly:2026-06-21:sunday:cycle_2026_06_08",
      identifier: "Projected",
      isAdjusted: false,
      isProjected: true,
      sourceTemplateOccurrenceKey: "weekly:2026-06-21:sunday",
      sourceTemplateScheduleId: "templateschedule_sunday_service",
      taskState: "todo",
      teamId: "team_worship",
      title: "Plan setlist",
      workflowStatusId: "workflowstatus_todo",
    });
    expect(projections[0]?.sourceBadge).toMatchObject({
      colorClassName: getTemplateScheduleColorClassName("templateschedule_sunday_service"),
      occurrenceDate: "2026-06-21",
      occurrenceLabel: "Sunday Jun 21",
      occurrencePeriod: "2026-06",
      scheduleName: "Sunday Service",
    });
  });

  test("keeps the same source badge for materialized scheduled Tasks", () => {
    const badge = buildTemplateSourceBadge({
      occurrenceKey: "weekly:2026-06-21:sunday",
      schedule: { id: "templateschedule_sunday_service", name: "Sunday Service" },
    });

    expect(badge).toMatchObject({
      colorClassName: getTemplateScheduleColorClassName("templateschedule_sunday_service"),
      dotClassName: getTemplateScheduleDotClassName("templateschedule_sunday_service"),
      occurrenceDate: "2026-06-21",
      periodLabel: "Jun 2026",
      scheduleName: "Sunday Service",
    });
  });

  test("derives a stable native dot color per Template Schedule", () => {
    expect(getTemplateScheduleDotClassName("templateschedule_sunday_service")).toBe(
      getTemplateScheduleDotClassName("templateschedule_sunday_service"),
    );
    expect(getTemplateScheduleDotClassName("templateschedule_sunday_service")).toMatch(/^bg-/);
  });

  test("projects fixed, dynamic, one-off, and yearly Key Date Template schedules", () => {
    const base = {
      cycle: { endDate: "2026-03-29", id: "cycle_2026_03_23", startDate: "2026-03-23" },
      existingTasks: [],
      keyDates: [
        {
          id: "keydate_easter",
          schedule: JSON.stringify({ kind: "computedYearly", rule: "easter" }),
        },
        {
          id: "keydate_christmas",
          schedule: JSON.stringify({ kind: "fixedYearly", month: 12, day: 25 }),
        },
        {
          id: "keydate_retreat",
          schedule: JSON.stringify({ kind: "oneTime", localDate: "2026-03-29" }),
        },
      ],
      templateTasks: [
        {
          assigned_user_id: null,
          description: null,
          estimate: null,
          id: "templatetask_invite",
          label_ids: JSON.stringify([]),
          placement_cycle_offset: 0,
          placement_weekday: 3,
          template_id: "template_special",
          template_team_id: "templateteam_worship",
          title: "Send invites",
        },
      ],
      templateTeams: [{ id: "templateteam_worship", mapped_team_id: "team_worship" }],
      workflows: [{ id: "workflow_worship", team_id: "team_worship" }],
      workflowStatuses: [
        { id: "workflowstatus_todo", task_state: "todo", workflow_id: "workflow_worship" },
      ],
    } as const;

    const retreatProjection = buildProjectedTemplateTasksForCycle({
      ...base,
      schedules: [
        {
          church_id: "church_1",
          end_date: "2026-03-29",
          id: "templateschedule_retreat",
          kind: "key_date",
          name: "Retreat prep",
          recurrence: "oneOff",
          rule: JSON.stringify({ keyDateId: "keydate_retreat", kind: "keyDate", repeat: "none" }),
          start_date: "2026-03-29",
          template_id: "template_special",
        },
      ] as never,
    } as never);

    expect(retreatProjection[0]).toMatchObject({
      dueDate: "2026-03-25",
      sourceTemplateOccurrenceKey: "keydate:2026-03-29:keydate_retreat",
    });

    const easterProjection = buildProjectedTemplateTasksForCycle({
      ...base,
      cycle: { endDate: "2026-04-05", id: "cycle_2026_03_30", startDate: "2026-03-30" },
      schedules: [
        {
          church_id: "church_1",
          end_date: null,
          id: "templateschedule_easter",
          kind: "key_date",
          name: "Easter prep",
          recurrence: "repeating",
          rule: JSON.stringify({ keyDateId: "keydate_easter", kind: "keyDate", repeat: "yearly" }),
          start_date: "2026-04-05",
          template_id: "template_special",
        },
      ] as never,
    } as never);

    expect(easterProjection[0]).toMatchObject({
      dueDate: "2026-04-01",
      sourceTemplateOccurrenceKey: "keydate:2026-04-05:keydate_easter",
    });

    // Key Date occurrences carry a distinct source-chip glyph kind so they read
    // differently from weekly Cadence occurrences on Cycle surfaces.
    expect(easterProjection[0]?.sourceBadge?.occurrenceKind).toBe("keyDate");

    const christmas2027 = buildProjectedTemplateTasksForCycle({
      ...base,
      cycle: { endDate: "2027-12-26", id: "cycle_2027_12_20", startDate: "2027-12-20" },
      schedules: [
        {
          church_id: "church_1",
          end_date: null,
          id: "templateschedule_christmas",
          kind: "key_date",
          name: "Christmas prep",
          recurrence: "repeating",
          rule: JSON.stringify({
            keyDateId: "keydate_christmas",
            kind: "keyDate",
            repeat: "yearly",
          }),
          start_date: "2026-12-25",
          template_id: "template_special",
        },
      ] as never,
    } as never);

    expect(christmas2027[0]).toMatchObject({
      dueDate: "2027-12-22",
      sourceTemplateOccurrenceKey: "keydate:2027-12-25:keydate_christmas",
    });
  });

  test("merges Cycle Adjustments into projected Template Tasks and drops foreign Team Labels", () => {
    const projections = buildProjectedTemplateTasksForCycle({
      cycle: { endDate: "2026-06-14", id: "cycle_2026_06_08", startDate: "2026-06-08" },
      cycleAdjustments: [
        {
          cycle_id: "cycle_2026_06_08",
          lifecycle: "active",
          overrides: JSON.stringify([
            { field: "title", value: "Plan production-heavy setlist" },
            { field: "description", value: "Bring production in earlier." },
            { field: "assignedUserId", value: "user_production" },
            { field: "teamId", value: "team_production" },
            { field: "dueDate", value: "2026-06-11" },
            { field: "estimate", value: "l" },
          ]),
          source_template_occurrence_key: "weekly:2026-06-21:sunday",
          source_template_schedule_id: "templateschedule_sunday_service",
          template_task_id: "templatetask_plan_setlist",
        },
      ] as never,
      existingTasks: [],
      labels: [
        { id: "label_shared", team_id: null },
        { id: "label_music", team_id: "team_worship" },
      ] as never,
      schedules: [
        {
          church_id: "church_1",
          end_date: null,
          id: "templateschedule_sunday_service",
          kind: "weekly",
          name: "Sunday Service",
          recurrence: "repeating",
          rule: JSON.stringify({ kind: "weekly", weekdays: [0] }),
          start_date: "2026-06-21",
          template_id: "template_service",
        },
      ] as never,
      templateTasks: [
        {
          assigned_user_id: "user_worship",
          description: "Pick songs before the service.",
          estimate: "m",
          id: "templatetask_plan_setlist",
          label_ids: JSON.stringify(["label_shared", "label_music"]),
          placement_cycle_offset: -1,
          placement_weekday: 3,
          template_id: "template_service",
          template_team_id: "templateteam_worship",
          title: "Plan setlist",
        },
      ] as never,
      templateTeams: [{ id: "templateteam_worship", mapped_team_id: "team_worship" }] as never,
      workflows: [
        { id: "workflow_worship", team_id: "team_worship" },
        { id: "workflow_production", team_id: "team_production" },
      ] as never,
      workflowStatuses: [
        { id: "status_worship_todo", task_state: "todo", workflow_id: "workflow_worship" },
        { id: "status_production_todo", task_state: "todo", workflow_id: "workflow_production" },
      ] as never,
    });

    expect(projections).toHaveLength(1);
    expect(projections[0]).toMatchObject({
      assignedUserId: "user_production",
      description: "Bring production in earlier.",
      dueDate: "2026-06-11",
      estimate: "l",
      // A projection carrying any planning override is flagged so surfaces can
      // mark it edited-for-this-Cycle while it stays a projection.
      isAdjusted: true,
      isProjected: true,
      labelIds: ["label_shared"],
      teamId: "team_production",
      title: "Plan production-heavy setlist",
      workflowId: "workflow_production",
      workflowStatusId: "status_production_todo",
    });
  });
});
