import { queries } from "@church-task/zero";
import { useQuery } from "@rocicorp/zero/react";

export type TemplateCollectionItem = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly placementShape: string | null;
  readonly recurrence: string;
  readonly scheduleCount: number;
  readonly taskCount: number;
};

export type TemplateScheduleCollectionItem = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly templateId: string;
  readonly templateName: string;
  readonly kind: string;
  readonly kindLabel: string;
  readonly recurrence: string;
  readonly nextOccurrence: string | null;
  readonly recentUsage: string;
};

type TemplateRow = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly recurrence: string;
  readonly placement_shape?: string | null;
};

type TemplateScheduleRow = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly template_id: string;
  readonly kind: string;
  readonly recurrence: string;
  readonly start_date: string;
  readonly end_date?: string | null;
};

type TemplateTaskRow = { readonly template_id: string };

const NO_CHURCH_ID = "__no_church__";

export const templateScheduleKindLabel = (kind: string): string => {
  switch (kind) {
    case "key_date":
      return "Key Date";
    case "monthly":
      return "Monthly";
    case "one_off":
      return "One-off";
    case "quarterly":
      return "Quarterly";
    case "weekly":
      return "Weekly";
    case "yearly":
      return "Yearly";
    default:
      return kind.replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase());
  }
};

export const formatTemplateScheduleOccurrence = (localDate: string | null): string => {
  if (!localDate) return "—";
  const parsed = new Date(`${localDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    weekday: "short",
    year: "numeric",
  });
};

export function buildTemplatesCollection(params: {
  readonly templates: readonly TemplateRow[];
  readonly schedules: readonly TemplateScheduleRow[];
  readonly tasks: readonly TemplateTaskRow[];
}): readonly TemplateCollectionItem[] {
  const scheduleCounts = new Map<string, number>();
  const taskCounts = new Map<string, number>();
  for (const schedule of params.schedules) {
    scheduleCounts.set(schedule.template_id, (scheduleCounts.get(schedule.template_id) ?? 0) + 1);
  }
  for (const task of params.tasks) {
    taskCounts.set(task.template_id, (taskCounts.get(task.template_id) ?? 0) + 1);
  }

  return params.templates.map((template) => ({
    id: template.id,
    key: template.key,
    name: template.name,
    placementShape: template.placement_shape ?? null,
    recurrence: template.recurrence,
    scheduleCount: scheduleCounts.get(template.id) ?? 0,
    taskCount: taskCounts.get(template.id) ?? 0,
  }));
}

export function buildTemplateSchedulesCollection(params: {
  readonly templates: readonly TemplateRow[];
  readonly schedules: readonly TemplateScheduleRow[];
  readonly today?: string;
}): readonly TemplateScheduleCollectionItem[] {
  const templatesById = new Map(params.templates.map((template) => [template.id, template.name]));
  const today = params.today ?? new Date().toISOString().slice(0, 10);

  return params.schedules.map((schedule) => ({
    id: schedule.id,
    key: schedule.key,
    name: schedule.name,
    templateId: schedule.template_id,
    templateName: templatesById.get(schedule.template_id) ?? "Unknown Template",
    kind: schedule.kind,
    kindLabel: templateScheduleKindLabel(schedule.kind),
    nextOccurrence:
      schedule.end_date && schedule.end_date < today
        ? null
        : schedule.start_date >= today
          ? schedule.start_date
          : null,
    recentUsage: "Usage history coming soon",
    recurrence: schedule.recurrence,
  }));
}

export function useTemplatesCollection(params: { readonly churchId: string | null }) {
  const queryChurchId = params.churchId ?? NO_CHURCH_ID;
  const [templateRows, templatesResult] = useQuery(
    queries.templates.by_church({ church_id: queryChurchId }),
  );
  const [scheduleRows, schedulesResult] = useQuery(
    queries.template_schedules.by_church({ church_id: queryChurchId }),
  );
  const [taskRows, tasksResult] = useQuery(
    queries.template_tasks.by_church({ church_id: queryChurchId }),
  );
  const collection = params.churchId
    ? buildTemplatesCollection({
        schedules: scheduleRows,
        tasks: taskRows,
        templates: templateRows,
      })
    : [];

  return {
    loading:
      params.churchId !== null &&
      (templatesResult.type !== "complete" ||
        schedulesResult.type !== "complete" ||
        tasksResult.type !== "complete"),
    collection,
    templatesCollection: collection,
  };
}

export function useTemplateSchedulesCollection(params: { readonly churchId: string | null }) {
  const queryChurchId = params.churchId ?? NO_CHURCH_ID;
  const [templateRows, templatesResult] = useQuery(
    queries.templates.by_church({ church_id: queryChurchId }),
  );
  const [scheduleRows, schedulesResult] = useQuery(
    queries.template_schedules.by_church({ church_id: queryChurchId }),
  );
  const collection = params.churchId
    ? buildTemplateSchedulesCollection({ schedules: scheduleRows, templates: templateRows })
    : [];

  return {
    collection,
    loading:
      params.churchId !== null &&
      (templatesResult.type !== "complete" || schedulesResult.type !== "complete"),
    templateSchedulesCollection: collection,
  };
}
