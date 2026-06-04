import { z } from 'zod';
import { optionalAirbusBadgeSchema } from './airbus-badge';
import {
  isoDateTimeSchema,
  moneyCentsSchema,
  moneyEurosSchema,
  optionalIsoDateTimeSchema,
  optionalMoneyCentsSchema,
  optionalPercentIntSchema,
  coerceEmptyString,
  optionalTrimmedString,
  optionalUuidSchema,
  parseOrThrow,
  paymentChannelSchema,
  positiveIntSchema,
  trimmedString,
  uuidSchema,
} from './primitives';

export const RESERVATION_STATUS_VALUES = [
  'PENDING_PAYMENT',
  'RESERVED_PAID',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const;

export const CLIENT_TYPE_VALUES = ['PARTICULIER', 'PROFESSIONNEL', 'ASSOCIATION'] as const;

export const CIVILITY_VALUES = ['M', 'MME', 'MX'] as const;

export const reservationStatusSchema = z.enum(RESERVATION_STATUS_VALUES);

export const clientTypeSchema = z.enum(CLIENT_TYPE_VALUES);

export const civilitySchema = z.enum(CIVILITY_VALUES);

export const reservationExtraItemSchema = z.object({
  extraId: uuidSchema,
  quantity: z.number().int().min(1).max(99).default(1),
});

export const reservationRefundItemSchema = z.object({
  id: optionalTrimmedString(64),
  amount: moneyEurosSchema,
  at: optionalIsoDateTimeSchema,
  note: optionalTrimmedString(2000),
});

export const upsertReservationSchema = z
  .object({
    id: optionalUuidSchema,
    boatId: uuidSchema,
    title: trimmedString(300, 'Titre'),
    start: isoDateTimeSchema,
    end: isoDateTimeSchema,
    color: optionalTrimmedString(32),
    detailsJson: z.union([z.string().max(500_000), z.null()]).optional(),
    clientMemberId: coerceEmptyString(optionalUuidSchema),
    clientType: z.union([clientTypeSchema, z.null()]).optional(),
    civility: z.union([civilitySchema, z.null()]).optional(),
    clientEmail: optionalTrimmedString(320),
    clientFirstName: optionalTrimmedString(120),
    clientLastName: optionalTrimmedString(120),
    clientPhone: optionalTrimmedString(32),
    clientBirthDate: optionalIsoDateTimeSchema,
    clientAddress: optionalTrimmedString(300),
    clientPostalCode: optionalTrimmedString(16),
    clientCity: optionalTrimmedString(120),
    clientCountry: optionalTrimmedString(80),
    passengerCount: z.union([positiveIntSchema(200), z.null()]).optional(),
    hasChildren: z.boolean().optional(),
    childrenCount: z.union([z.number().int().min(0).max(50), z.null()]).optional(),
    internalNote: optionalTrimmedString(5000),
    paymentChannel: paymentChannelSchema.optional(),
    rentalPriceCents: optionalMoneyCentsSchema,
    depositAmountCents: optionalMoneyCentsSchema,
    discountPercent: optionalPercentIntSchema,
    couponCode: coerceEmptyString(
      z
        .union([
          z
            .string()
            .trim()
            .max(64)
            .regex(/^[A-Za-z0-9_-]+$/, 'Code coupon invalide'),
          z.null(),
        ])
        .optional(),
    ),
    airbusBadge: optionalAirbusBadgeSchema,
    installments: z.union([z.literal(1), z.literal(2), z.null()]).optional(),
    settlementNote: optionalTrimmedString(2000),
    paymentCapturedAt: optionalIsoDateTimeSchema,
    depositCapturedAt: optionalIsoDateTimeSchema,
    confirmationEmailSentAt: optionalIsoDateTimeSchema,
    totalDueCents: optionalMoneyCentsSchema,
    cancelledAt: optionalIsoDateTimeSchema,
    status: z.union([reservationStatusSchema, z.null()]).optional(),
    extras: z.array(reservationExtraItemSchema).max(50).optional(),
    refunds: z.array(reservationRefundItemSchema).max(100).optional(),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.start);
    const end = new Date(data.end);
    if (end <= start) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La fin doit être après le début', path: ['end'] });
    }
    if (data.hasChildren && (data.childrenCount == null || data.childrenCount < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nombre d’enfants requis si hasChildren',
        path: ['childrenCount'],
      });
    }
    if (data.discountPercent != null && data.discountPercent > 0 && data.discountPercent > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Remise invalide', path: ['discountPercent'] });
    }
    const refunded = (data.refunds ?? []).reduce((s, r) => s + r.amount, 0);
    const rental = data.rentalPriceCents != null ? data.rentalPriceCents / 100 : null;
    if (rental != null && rental > 0 && refunded > rental + 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Le total des remboursements dépasse le prix de location',
        path: ['refunds'],
      });
    }
  });

export type UpsertReservationInput = z.output<typeof upsertReservationSchema>;

export function parseUpsertReservation(value: unknown): UpsertReservationInput {
  return upsertReservationSchema.parse(value);
}
