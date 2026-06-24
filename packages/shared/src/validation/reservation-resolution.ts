import { z } from 'zod';

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Heure invalide (HH:MM)');
const dateIsoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide');

const noteField = {
  note: z.string().trim().max(2000).optional(),
};

export const reservationResolutionMoveSchema = z.object({
  type: z.literal('move'),
  boatId: z.string().uuid(),
  dateIso: dateIsoSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  creditLowerDifference: z.boolean().optional().default(true),
  notifyClient: z.boolean().optional().default(false),
  ...noteField,
});

export const reservationResolutionStoreCreditSchema = z.object({
  type: z.literal('store_credit'),
  amount: z.number().positive().max(999_999).optional(),
  notifyClient: z.boolean().optional().default(true),
  ...noteField,
});

export const reservationResolutionRefundSchema = z.object({
  type: z.literal('refund'),
  amount: z.number().positive().max(999_999),
  /** Annule la réservation en même temps que le remboursement (défaut : oui). */
  cancelReservation: z.boolean().optional().default(true),
  notifyClient: z.boolean().optional().default(true),
  ...noteField,
});

export const reservationResolutionSchema = z.discriminatedUnion('type', [
  reservationResolutionMoveSchema,
  reservationResolutionStoreCreditSchema,
  reservationResolutionRefundSchema,
]);

export type ReservationResolutionInput = z.infer<typeof reservationResolutionSchema>;
