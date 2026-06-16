import { z } from 'zod';

/** UUID v4 (Prisma @default(uuid())). */
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const uuidSchema = z.string().regex(UUID_REGEX, 'Identifiant invalide');

export const optionalUuidSchema = z.union([uuidSchema, z.null()]).optional();

/** Chaîne vide → null (évite 400 si le client envoie "" au lieu de null). */
export function coerceEmptyString<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((val) => (val === '' ? null : val), schema);
}

export const MAX_MONEY_CENTS = 100_000_000;

/** Montant en centimes (entier, ≥ 0). */
export const moneyCentsSchema = z.number().int('Montant en centimes entier requis').min(0).max(MAX_MONEY_CENTS);

export const optionalMoneyCentsSchema = z.union([moneyCentsSchema, z.null()]).optional();

/** Pourcentage 0–100. */
export const percentIntSchema = z.number().int().min(0).max(100);

export const optionalPercentIntSchema = z.union([percentIntSchema, z.null()]).optional();

/** Montant en euros (remboursements saisis côté admin). */
export const moneyEurosSchema = z
  .number()
  .finite('Montant invalide')
  .min(0.01, 'Montant minimum 0,01 €')
  .max(1_000_000, 'Montant trop élevé');

export const isoDateTimeSchema = z.string().refine((s) => {
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}, 'Date/heure invalide');

export const optionalIsoDateTimeSchema = z.union([isoDateTimeSchema, z.null()]).optional();

export const trimmedString = (max: number, label = 'Champ') =>
  z.string().trim().min(1, `${label} requis`).max(max, `${label} trop long`);

export const optionalTrimmedString = (max: number) =>
  z.union([z.string().trim().max(max), z.null()]).optional();

export const positiveIntSchema = (max: number) => z.number().int().min(1).max(max);

export const PAYMENT_CHANNEL_VALUES = ['ONLINE', 'OFFLINE'] as const;

export const paymentChannelSchema = z.enum(PAYMENT_CHANNEL_VALUES);

export const PAYMENT_METHOD_VALUES = ['ONLINE', 'CASH', 'CARD_ONSITE', 'CHECK', 'TRANSFER'] as const;

export const paymentMethodSchema = z.enum(PAYMENT_METHOD_VALUES);

export function formatZodIssues(error: z.ZodError): { message: string; errors: { path: string; message: string }[] } {
  return {
    message: 'Validation échouée',
    errors: error.errors.map((e) => ({
      path: e.path.length ? e.path.join('.') : '_',
      message: e.message,
    })),
  };
}

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}
