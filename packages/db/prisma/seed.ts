import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_BRAND_NAME } from '@bleu-calanque/shared';
import { Prisma, PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DB_BUSY_CODES = new Set(['P1008', 'P2034']);

function isSqliteBusyError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && DB_BUSY_CODES.has(e.code);
}

/** Attente active côté SQLite quand un autre processus tient un verrou (ms). */
async function configureSqliteBusyTimeout(client: PrismaClient) {
  await client.$queryRawUnsafe('PRAGMA busy_timeout = 60000');
}

async function runWithDbRetries<T>(label: string, fn: () => Promise<T>, maxAttempts = 8): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isSqliteBusyError(e) || attempt === maxAttempts - 1) throw e;
      const ms = 500 * (attempt + 1);
      console.warn(`[seed] ${label} — base occupée, réessai ${attempt + 1}/${maxAttempts} (attente ${ms}ms)…`);
      await new Promise((r) => setTimeout(r, ms));
    }
  }
  throw last;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
/** `packages/db/prisma/seed.ts` → racine du monorepo */
const repoRoot = join(__dirname, '../../..');

/** Charge ADMIN_* depuis `apps/api/.env` sans écraser `DATABASE_URL` (chemin relatif à `packages/db`). */
function loadProjectEnv() {
  const dbEnv = join(repoRoot, 'packages/db/.env');
  const apiEnv = join(repoRoot, 'apps/api/.env');
  const rootEnv = join(repoRoot, '.env');
  if (existsSync(rootEnv)) config({ path: rootEnv });
  if (existsSync(dbEnv)) config({ path: dbEnv, override: true });
  if (existsSync(apiEnv)) {
    const beforeDb = process.env.DATABASE_URL;
    config({ path: apiEnv, override: true });
    if (existsSync(dbEnv)) {
      config({ path: dbEnv, override: true });
    } else if (beforeDb) {
      process.env.DATABASE_URL = beforeDb;
    }
  }
}
loadProjectEnv();

const prisma = new PrismaClient();

async function main() {
  await configureSqliteBusyTimeout(prisma);

  const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@bleu-calanque.local').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';
  const adminFirstName = process.env.ADMIN_FIRST_NAME ?? 'Admin';
  const adminLastName = process.env.ADMIN_LAST_NAME ?? 'Demo';

  const hash = await bcrypt.hash(adminPassword, 10);
  await runWithDbRetries('user.upsert', () =>
    prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        passwordHash: hash,
        firstName: adminFirstName,
        lastName: adminLastName,
        role: UserRole.ADMIN,
      },
      create: {
        email: adminEmail,
        passwordHash: hash,
        firstName: adminFirstName,
        lastName: adminLastName,
        role: UserRole.ADMIN,
      },
    }),
  );
  // Ne jamais logger le mot de passe (même en dev)
  console.log(`Seed ok — admin: ${adminEmail}`);

  await runWithDbRetries('settings', async () => {
  // Singleton settings (valeurs minimales)
  await prisma.companySettings.upsert({
    where: { id: 'company_settings' },
    update: {
      legalName: DEFAULT_BRAND_NAME,
      tradeName: DEFAULT_BRAND_NAME,
      brandName: DEFAULT_BRAND_NAME,
      addressLine: 'Port Ouest Marseille, D568',
      postalCode: '13016',
      city: 'Marseille',
      country: 'France',
    },
    create: {
      id: 'company_settings',
      legalName: DEFAULT_BRAND_NAME,
      tradeName: DEFAULT_BRAND_NAME,
      professionalPhone: '',
      domiciliation: '',
      companyType: '',
      vatNumber: '',
      siret: '',
      rcsRegistration: '',
      nafCode: '',
      shareCapital: '',
      addressLine: 'Port Ouest Marseille, D568',
      city: 'Marseille',
      postalCode: '13016',
      country: 'France',
      contactEmail: '',
      contactPhone: '',
      publicSiteUrl: '',
      brandName: DEFAULT_BRAND_NAME,
      adsVatRatePercent: 20,
      vatBasePercent: 100,
      vatPercent: 20,
      departureLocation: 'Port Ouest Marseille — L\'Estaque',
      arrivalLocation: 'Port Ouest Marseille — L\'Estaque',
      contactOpeningHours: 'Lundi – vendredi : 9h – 18h\nSamedi : 9h – 12h',
    },
  });

  await prisma.bankSettings.upsert({
    where: { id: 'bank_settings' },
    update: {},
    create: { id: 'bank_settings', accountHolder: '', iban: '', bic: '', bankName: '' },
  });

  await prisma.notificationsSettings.upsert({
    where: { id: 'notifications_settings' },
    update: {},
    create: {
      id: 'notifications_settings',
      adminEmailsCsv: '',
      onReservationCreated: true,
      onReservationUpdated: true,
      onPaymentCaptured: true,
      onRefundCreated: true,
      onReservationCancelled: true,
      onReservationRestored: true,
      onReservationDeleted: true,
      onCheckInDone: true,
      onCheckOutDone: true,
    },
  });

  await prisma.checkFlowSettings.upsert({
    where: { id: 'check_flow_settings' },
    update: {},
    create: { id: 'check_flow_settings', checkOutUsesCheckInForm: false },
  });

  await prisma.bookingSettings.upsert({
    where: { id: 'booking_settings' },
    update: {},
    create: {
      id: 'booking_settings',
      defaultNavalBase: 'Port Ouest Marseille — L\'Estaque',
      departureLocation: 'Port Ouest Marseille — L\'Estaque',
      arrivalLocation: 'Port Ouest Marseille — L\'Estaque',
      requireDeposit: true,
      depositDefaultAmount: '1500',
      paymentsOnlineEnabled: true,
    },
  });

  await prisma.emailSettings.upsert({
    where: { id: 'email_settings' },
    update: {},
    create: { id: 'email_settings', fromName: DEFAULT_BRAND_NAME, fromEmail: '', replyToEmail: '', confirmationsEnabled: true },
  });

  await prisma.publicSiteSettings.upsert({
    where: { id: 'public_site_settings' },
    update: {
      brandName: DEFAULT_BRAND_NAME,
      addressLine: 'Port Ouest Marseille, D568',
      postalCode: '13016',
      city: 'Marseille',
      country: 'France',
    },
    create: {
      id: 'public_site_settings',
      publicSiteUrl: '',
      brandName: DEFAULT_BRAND_NAME,
      contactEmail: '',
      contactPhone: '',
      addressLine: 'Port Ouest Marseille, D568',
      city: 'Marseille',
      postalCode: '13016',
      country: 'France',
      departureLocation: 'Port Ouest Marseille — L\'Estaque',
      arrivalLocation: 'Port Ouest Marseille — L\'Estaque',
    },
  });
  });
}

try {
  await main();
} catch (e) {
  if (isSqliteBusyError(e)) {
    console.error(
      '\n[seed] SQLite est verrouillée ou trop lente (timeout). Arrête tout ce qui utilise dev.db — surtout `npm run dev` / l’API et Prisma Studio — puis relance `npm run db:seed`.\n',
    );
  }
  console.error(e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
