/**
 * Réinitialise le mot de passe admin (ADMIN_EMAIL / ADMIN_PASSWORD dans apps/api/.env).
 * Usage : npm run reset-admin-password --workspace=@bleu-calanque/db
 */
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');
const dbEnv = join(repoRoot, 'packages/db/.env');
const apiEnv = join(repoRoot, 'apps/api/.env');
if (existsSync(dbEnv)) config({ path: dbEnv });
if (existsSync(apiEnv)) config({ path: apiEnv, override: true });
if (existsSync(dbEnv)) config({ path: dbEnv, override: true });

const email = (process.env.ADMIN_EMAIL ?? 'admin@bleu-calanque.local').toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? 'admin123';

async function main() {
  const prisma = new PrismaClient();
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash: hash, isActive: true, role: UserRole.ADMIN },
    create: {
      email,
      passwordHash: hash,
      firstName: process.env.ADMIN_FIRST_NAME ?? 'Admin',
      lastName: process.env.ADMIN_LAST_NAME ?? 'Demo',
      role: UserRole.ADMIN,
    },
  });
  console.log(`Mot de passe réinitialisé pour ${user.email}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
