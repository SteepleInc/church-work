import { z } from "zod";

export const TemplateSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  teamId: z.string().nullable().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
});

export type Template = z.infer<typeof TemplateSchema>;
