import { z } from 'zod';
import { parseOrThrow, trimmedString } from './primitives';

import { paymentChannelSchema } from './primitives';

export const EXTRA_PRICE_KIND_VALUES = ['PERCENT', 'EURO'] as const;
export const EXTRA_BILLING_UNIT_VALUES = ['LOCATION', 'JOUR', 'SEMAINE'] as const;

export const createExtraSchema = z
  .object({
    name: trimmedString(120, 'Nom'),
    description: trimmedString(2000, 'Description'),
    priceKind: z.enum(EXTRA_PRICE_KIND_VALUES),
    priceValue: z.number().finite().min(0),
    billingUnit: z.enum(EXTRA_BILLING_UNIT_VALUES),
    vatRate: z.number().finite().min(0).max(100),
    stock: z.union([z.number().int().min(0).max(1_000_000), z.null()]).optional(),
    paymentChannel: paymentChannelSchema.optional(),
    icon: z.union([z.string().trim().max(40), z.null()]).optional(),
    enabled: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.priceKind === 'PERCENT' && data.priceValue > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Pourcentage max 100', path: ['priceValue'] });
    }
    if (data.priceKind === 'EURO' && data.priceValue > 1_000_000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Montant trop élevé', path: ['priceValue'] });
    }
  });

export const updateExtraSchema = createExtraSchema;

export type CreateExtraInput = z.infer<typeof createExtraSchema>;

export function parseCreateExtra(value: unknown): CreateExtraInput {
  return parseOrThrow(createExtraSchema, value);
}

export function parseUpdateExtra(value: unknown): CreateExtraInput {
  return parseOrThrow(updateExtraSchema, value);
}
