import { z } from "zod";

export const WorkflowSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  teamId: z.string().nullable().optional(),
  name: z.string(),
  archivedAt: z.string().nullable().optional(),
});

export type Workflow = z.infer<typeof WorkflowSchema>;
