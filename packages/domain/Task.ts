import { z } from "zod";

export const TaskStatusSchema = z.enum(["todo", "in_progress", "done", "canceled"]);

export const TaskSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  teamId: z.string().nullable().optional(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: TaskStatusSchema,
  assigneeUserId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export type Task = z.infer<typeof TaskSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
