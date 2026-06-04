import { z } from 'zod';
import { isoDateTimeSchema, parseOrThrow, trimmedString, uuidSchema } from './primitives';

export const COUPON_DISCOUNT_KIND_VALUES = ['PERCENT', 'FIXED'] as const;

export const couponDiscountKindSchema = z.enum(COUPON_DISCOUNT_KIND_VALUES);

const couponCodeSchema = z
  .string()
  .trim()
  .min(2, 'Code trop court')
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Code coupon : lettres, chiffres, _ et - uniquement');

export const createCouponSchema = z
  .object({
    code: couponCodeSchema,
    internalLabel: trimmedString(200, 'Libellé'),
    discountKind: couponDiscountKindSchema,
    discountValue: z.number().finite().min(0),
    validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Date de début invalide (AAAA-MM-JJ)'),
    validUntil: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}/), z.null()]).optional(),
    enabled: z.boolean().optional(),
    seasonMaxFullUsesPerClient: z.union([z.number().int().min(1).max(100), z.null()]).optional(),
    seasonDegradedDiscountValue: z.union([z.number().finite().min(0), z.null()]).optional(),
    requiresAirbusBadge: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.discountKind === 'PERCENT' && data.discountValue > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Remise % max 100', path: ['discountValue'] });
    }
    if (data.discountKind === 'FIXED' && data.discountValue > 1_000_000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Montant fixe trop élevé', path: ['discountValue'] });
    }
    const hasSeasonMax = data.seasonMaxFullUsesPerClient != null;
    const hasSeasonDeg = data.seasonDegradedDiscountValue != null;
    if (hasSeasonMax !== hasSeasonDeg) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Règle saisonnière : max utilisations et remise dégradée ensemble',
        path: ['seasonMaxFullUsesPerClient'],
      });
    }
    if (data.validUntil) {
      const from = new Date(`${data.validFrom.slice(0, 10)}T00:00:00.000Z`);
      const until = new Date(`${data.validUntil.slice(0, 10)}T00:00:00.000Z`);
      if (until < from) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fin de validité avant le début', path: ['validUntil'] });
      }
    }
  });

export const updateCouponSchema = createCouponSchema;

export const createCouponRedemptionSchema = z.object({
  clientKey: trimmedString(320, 'Clé client'),
  redeemedAt: isoDateTimeSchema.optional(),
});

export const couponIdParamSchema = z.object({ id: uuidSchema });

export const deleteCouponClientRedemptionsQuerySchema = z.object({
  clientKey: trimmedString(320, 'Clé client'),
});

export type DeleteCouponClientRedemptionsQuery = z.infer<typeof deleteCouponClientRedemptionsQuerySchema>;

export const removeCouponClientRedemptionsBodySchema = z.object({
  couponId: uuidSchema,
  clientKey: trimmedString(320, 'Clé client'),
});

export const removeCouponClientRedemptionsQuerySchema = removeCouponClientRedemptionsBodySchema;

export type RemoveCouponClientRedemptionsBody = z.infer<typeof removeCouponClientRedemptionsBodySchema>;

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type CreateCouponRedemptionInput = z.infer<typeof createCouponRedemptionSchema>;

export function parseCreateCoupon(value: unknown): CreateCouponInput {
  return parseOrThrow(createCouponSchema, value);
}

export function parseUpdateCoupon(value: unknown): CreateCouponInput {
  return parseOrThrow(updateCouponSchema, value);
}

export function parseCreateCouponRedemption(value: unknown): CreateCouponRedemptionInput {
  return parseOrThrow(createCouponRedemptionSchema, value);
}
