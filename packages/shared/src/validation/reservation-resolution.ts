import { z } from 'zod';

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Heure invalide (HH:MM)');
const dateIsoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide');

const baseFields = {
  notifyClient: z.boolean().optional().default(true),
  note: z.string().trim().max(2000).optional(),
};

export const reservationResolutionMoveSchema = z.object({
  type: z.literal('move'),
  boatId: z.string().uuid(),
  dateIso: dateIsoSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  creditLowerDifference: z.boolean().optional().default(true),
  ...baseFields,
});

export const reservationResolutionStoreCreditSchema = z.object({
  type: z.literal('store_credit'),
  amount: z.number().positive().max(999_999).optional(),
  ...baseFields,
});

export const reservationResolutionRefundSchema = z.object({
  type: z.literal('refund'),
  amount: z.number().positive().max(999_999),
  /** Annule la réservation en même temps que le remboursement (défaut : oui). */
  cancelReservation: z.boolean().optional().default(true),
  ...baseFields,
});

export const reservationResolutionSchema = z.discriminatedUnion('type', [
  reservationResolutionMoveSchema,
  reservationResolutionStoreCreditSchema,
  reservationResolutionRefundSchema,
]);

export type ReservationResolutionInput = z.infer<typeof reservationResolutionSchema>;
