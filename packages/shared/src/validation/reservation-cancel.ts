import { z } from 'zod';

export const cancelReservationSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
  notifyClient: z.boolean().optional(),
});

export type CancelReservationInput = z.infer<typeof cancelReservationSchema>;
