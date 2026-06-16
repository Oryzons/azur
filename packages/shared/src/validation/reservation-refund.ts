import { z } from 'zod';

export const createReservationRefundSchema = z.object({
  amount: z.number().positive().max(999_999),
  note: z.string().trim().max(2000).optional(),
  /** Marque la réservation comme annulée (créneau libéré) en plus du remboursement. */
  cancelReservation: z.boolean().optional().default(false),
});

export type CreateReservationRefundInput = z.infer<typeof createReservationRefundSchema>;
