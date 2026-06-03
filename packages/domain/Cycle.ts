import { z } from "zod";

export const CycleSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
});

export type Cycle = z.infer<typeof CycleSchema>;
