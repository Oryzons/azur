import { z } from 'zod';
import { moneyCentsSchema, parseOrThrow, trimmedString, uuidSchema } from './primitives';

export const PRICING_UNIT_VALUES = ['DEMI_JOURNEE', 'JOURNEE', 'SEMAINE'] as const;

export const pricingUnitSchema = z.enum(PRICING_UNIT_VALUES);

export const createPricingPeriodSchema = z
  .object({
    name: trimmedString(120, 'Nom'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Date de début invalide'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Date de fin invalide'),
    active: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const start = new Date(`${data.startDate.slice(0, 10)}T00:00:00.000Z`);
    const end = new Date(`${data.endDate.slice(0, 10)}T00:00:00.000Z`);
    if (end < start) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fin avant début', path: ['endDate'] });
    }
  });

export const updatePricingPeriodSchema = createPricingPeriodSchema;

export const upsertBoatPriceSchema = z.object({
  boatId: uuidSchema,
  unit: pricingUnitSchema,
  amountCents: moneyCentsSchema,
});

export const upsertFleetPriceSchema = z.object({
  fleetId: uuidSchema,
  unit: pricingUnitSchema,
  amountCents: moneyCentsSchema,
});

export function parseUpsertBoatPrice(value: unknown) {
  return parseOrThrow(upsertBoatPriceSchema, value);
}

export function parseUpsertFleetPrice(value: unknown) {
  return parseOrThrow(upsertFleetPriceSchema, value);
}
