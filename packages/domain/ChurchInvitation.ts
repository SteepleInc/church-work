import { z } from "zod";

export const ChurchInvitationStatusSchema = z.enum(["pending", "accepted", "rejected", "canceled"]);

export const ChurchInvitationSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  email: z.email(),
  role: z.string(),
  status: ChurchInvitationStatusSchema,
  teamId: z.string().nullable().optional(),
  inviterUserId: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});

export type ChurchInvitation = z.infer<typeof ChurchInvitationSchema>;
export type ChurchInvitationStatus = z.infer<typeof ChurchInvitationStatusSchema>;
