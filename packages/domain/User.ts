import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string().nullable().optional(),
  image: z.url().nullable().optional(),
});

export type User = z.infer<typeof UserSchema>;
