import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(3001),
  ADMIN_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  /** inline | s3 | r2 — s3/r2 nécessitent bucket + credentials (voir upload-storage). */
  UPLOAD_STORAGE_DRIVER: z.enum(['inline', 's3', 'r2']).default('inline'),
  CLAMAV_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  CLAMAV_BINARY: z.string().default('clamdscan'),
  /** Durée de conservation des audit_logs (suppression auto). Défaut ~2 mois. */
  AUDIT_RETENTION_DAYS: z.coerce.number().int().min(7).max(365).default(60),
  /** Resend (emails transactionnels). */
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().default('onboarding@resend.dev'),
  RESEND_FROM_NAME: z.string().default('Bleu Calanque'),
  /** Stripe Checkout + empreinte caution. */
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  /** URL publique (admin) pour pages paiement / redirections Stripe. */
  PUBLIC_APP_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(env: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Env invalide:\n${msg}`);
  }
  return parsed.data;
}
