import { z } from "zod";

export const OrgSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().nullable().optional(),
  churchTimeZone: z.string(),
  completedOnboarding: z.boolean().default(false),
  url: z.url().nullable().optional(),
  street: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  countryCode: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  size: z.string().nullable().optional(),
});

export type Org = z.infer<typeof OrgSchema>;
