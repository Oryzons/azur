import { z } from 'zod';

/** Numéro de badge Airbus : lettre + chiffres, tirets autorisés (ex. A345678). */
export const airbusBadgeSchema = z
  .string()
  .trim()
  .min(2, 'Badge trop court')
  .max(24, 'Badge trop long')
  .regex(/^[A-Za-z][A-Za-z0-9-]*$/, 'Format badge invalide (ex. A345678)');

export const optionalAirbusBadgeSchema = z.union([airbusBadgeSchema, z.literal(''), z.null()]).optional();

export function normalizeAirbusBadge(value: string | null | undefined): string | null {
  const s = (value ?? '').trim().toUpperCase().replaceAll(/\s+/g, '');
  return s || null;
}
