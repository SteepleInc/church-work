import { z } from "zod";

export const TeamSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  archivedAt: z.string().nullable().optional(),
  defaultWorkflowId: z.string().nullable().optional(),
  sortOrder: z.number().nullable().optional(),
});

export type Team = z.infer<typeof TeamSchema>;
