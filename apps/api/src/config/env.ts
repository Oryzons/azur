import { DEFAULT_BRAND_NAME } from '@bleu-calanque/shared';
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
  /** Limite globale requêtes / THROTTLE_TTL_MS (défaut 120/min). */
  THROTTLE_TTL_MS: z.coerce.number().int().min(1000).default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().min(1).default(120),
  /** Limite routes /auth/* (défaut 10/min par IP). */
  THROTTLE_AUTH_LIMIT: z.coerce.number().int().min(1).default(10),
  /** Durée de conservation des audit_logs (suppression auto). Défaut ~2 mois. */
  AUDIT_RETENTION_DAYS: z.coerce.number().int().min(7).max(365).default(60),
  /** Resend (emails transactionnels). */
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().default('onboarding@resend.dev'),
  RESEND_FROM_NAME: z.string().default(DEFAULT_BRAND_NAME),
  /** Stripe Checkout + empreinte caution. */
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  /** Estimation frais Stripe si balance_transaction pas encore sync. (% TTC, ex. 1.5) */
  STRIPE_FEE_ESTIMATE_PERCENT: z.coerce.number().min(0).max(10).default(1.5),
  /** Part fixe estimée (centimes, ex. 25 = 0,25 €). */
  STRIPE_FEE_ESTIMATE_FIXED_CENTS: z.coerce.number().int().min(0).max(500).default(25),
  /** Inscription publique POST /auth/register (désactivée en prod par défaut). */
  AUTH_PUBLIC_REGISTER_ENABLED: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  /** URL publique (admin) pour pages paiement / redirections Stripe. */
  PUBLIC_APP_URL: z.string().url().optional(),
  /** S3 / Cloudflare R2 (si UPLOAD_STORAGE_DRIVER=s3|r2). */
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
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
