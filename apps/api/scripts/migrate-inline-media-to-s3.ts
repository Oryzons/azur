/**
 * Inventaire et migration des médias inline (data URL) vers S3/R2.
 *
 * Prérequis : UPLOAD_STORAGE_DRIVER=s3 (ou r2) + variables S3_* configurées.
 *
 * Usage:
 *   cd apps/api && npx tsx scripts/migrate-inline-media-to-s3.ts
 *   cd apps/api && npx tsx scripts/migrate-inline-media-to-s3.ts --migrate
 */
import { PrismaClient } from '@prisma/client';
import {
  parseDataUrl,
  prepareDocumentBuffer,
  prepareImageBuffer,
} from '../src/common/media/image-security';
import { createUploadStorageProvider } from '../src/common/media/upload-storage';

const prisma = new PrismaClient();
const migrate = process.argv.includes('--migrate');

function isInline(url: string | null | undefined): boolean {
  return Boolean(url?.trim().startsWith('data:'));
}

function inlineBytes(url: string): number {
  try {
    return parseDataUrl(url).buffer.length;
  } catch {
    return 0;
  }
}

async function uploadInline(url: string): Promise<string> {
  const trimmed = url.trim();
  const parsed = parseDataUrl(trimmed);
  const validated =
    parsed.declaredMime.startsWith('image/')
      ? await prepareImageBuffer(parsed.buffer, parsed.declaredMime, trimmed)
      : await prepareDocumentBuffer(parsed.buffer, parsed.declaredMime, trimmed);
  const storage = createUploadStorageProvider();
  if (storage.name !== 's3') {
    throw new Error('UPLOAD_STORAGE_DRIVER doit être s3 ou r2 pour migrer.');
  }
  const stored = await storage.store(validated);
  return stored.publicUrl;
}

type Stat = { table: string; field: string; inlineCount: number; inlineBytes: number; migrated: number };

const stats: Stat[] = [];

function bump(table: string, field: string, url: string | null | undefined, migrated = false) {
  if (!isInline(url)) return;
  let row = stats.find((s) => s.table === table && s.field === field);
  if (!row) {
    row = { table, field, inlineCount: 0, inlineBytes: 0, migrated: 0 };
    stats.push(row);
  }
  row.inlineCount += 1;
  row.inlineBytes += inlineBytes(url!);
  if (migrated) row.migrated += 1;
}

async function migrateScalar(
  table: string,
  field: string,
  id: string,
  url: string | null | undefined,
  update: (next: string) => Promise<void>,
): Promise<void> {
  if (!isInline(url)) return;
  if (!migrate) {
    bump(table, field, url);
    return;
  }
  const next = await uploadInline(url!);
  await update(next);
  bump(table, field, url, true);
}

async function migrateMembers() {
  const rows = await prisma.member.findMany({
    select: {
      id: true,
      cniFrontUrl: true,
      cniBackUrl: true,
      boatLicenseFrontUrl: true,
      boatLicenseBackUrl: true,
      airbusBadgePhotoUrl: true,
    },
  });
  for (const row of rows) {
    for (const field of [
      'cniFrontUrl',
      'cniBackUrl',
      'boatLicenseFrontUrl',
      'boatLicenseBackUrl',
      'airbusBadgePhotoUrl',
    ] as const) {
      const url = row[field];
      await migrateScalar('Member', field, row.id, url, (next) =>
        prisma.member.update({ where: { id: row.id }, data: { [field]: next } }),
      );
    }
  }
}

async function migrateBoatPhotos() {
  const rows = await prisma.boatPhoto.findMany({ select: { id: true, url: true } });
  for (const row of rows) {
    await migrateScalar('BoatPhoto', 'url', row.id, row.url, (next) =>
      prisma.boatPhoto.update({ where: { id: row.id }, data: { url: next } }),
    );
  }
}

async function migrateAnnouncementPhotos() {
  const rows = await prisma.announcementPhoto.findMany({ select: { id: true, url: true } });
  for (const row of rows) {
    await migrateScalar('AnnouncementPhoto', 'url', row.id, row.url, (next) =>
      prisma.announcementPhoto.update({ where: { id: row.id }, data: { url: next } }),
    );
  }
}

async function migratePartners() {
  const rows = await prisma.partner.findMany({ select: { id: true, logoUrl: true } });
  for (const row of rows) {
    await migrateScalar('Partner', 'logoUrl', row.id, row.logoUrl, (next) =>
      prisma.partner.update({ where: { id: row.id }, data: { logoUrl: next } }),
    );
  }
}

async function migrateUsers() {
  const rows = await prisma.user.findMany({ select: { id: true, avatarUrl: true } });
  for (const row of rows) {
    await migrateScalar('User', 'avatarUrl', row.id, row.avatarUrl, (next) =>
      prisma.user.update({ where: { id: row.id }, data: { avatarUrl: next } }),
    );
  }
}

async function migrateCompanySignature() {
  const row = await prisma.companySettings.findUnique({
    where: { id: 'company_settings' },
    select: { contractOperatorSignatureDataUrl: true },
  });
  if (!row) return;
  await migrateScalar('CompanySettings', 'contractOperatorSignatureDataUrl', 'company_settings', row.contractOperatorSignatureDataUrl, (next) =>
    prisma.companySettings.update({
      where: { id: 'company_settings' },
      data: { contractOperatorSignatureDataUrl: next },
    }),
  );
}

async function migrateRentalContracts() {
  const rows = await prisma.rentalContract.findMany({
    select: { id: true, clientSignatureDataUrl: true, operatorSignatureDataUrl: true },
  });
  for (const row of rows) {
    for (const field of ['clientSignatureDataUrl', 'operatorSignatureDataUrl'] as const) {
      const url = row[field];
      await migrateScalar('RentalContract', field, row.id, url, (next) =>
        prisma.rentalContract.update({ where: { id: row.id }, data: { [field]: next } }),
      );
    }
  }
}

async function migrateBoatLegalDocs() {
  const rows = await prisma.boat.findMany({ select: { id: true, detailsJson: true } });
  const keys = ['assurance', 'contratGestion', 'carteCirculation', 'annexe240'] as const;
  for (const row of rows) {
    if (!row.detailsJson?.trim()) continue;
    let parsed: { legalite?: Record<string, { fileUrl?: string }> };
    try {
      parsed = JSON.parse(row.detailsJson) as typeof parsed;
    } catch {
      continue;
    }
    const legalite = parsed.legalite;
    if (!legalite || typeof legalite !== 'object') continue;
    let changed = false;
    const nextLegalite = { ...legalite };
    for (const key of keys) {
      const doc = legalite[key];
      const url = typeof doc?.fileUrl === 'string' ? doc.fileUrl : null;
      if (!isInline(url)) continue;
      bump('Boat.detailsJson', `legalite.${key}.fileUrl`, url);
      if (migrate) {
        const nextUrl = await uploadInline(url!);
        nextLegalite[key] = { ...doc, fileUrl: nextUrl };
        changed = true;
        bump('Boat.detailsJson', `legalite.${key}.fileUrl`, url, true);
      }
    }
    if (changed) {
      await prisma.boat.update({
        where: { id: row.id },
        data: { detailsJson: JSON.stringify({ ...parsed, legalite: nextLegalite }) },
      });
    }
  }
}

function printReport() {
  if (stats.length === 0) {
    console.log('Aucun média inline trouvé.');
    return;
  }
  let totalCount = 0;
  let totalBytes = 0;
  let totalMigrated = 0;
  console.log('\n--- Inventaire médias inline ---');
  for (const s of stats.sort((a, b) => a.table.localeCompare(b.table))) {
    const mb = (s.inlineBytes / (1024 * 1024)).toFixed(2);
    console.log(
      `${s.table}.${s.field}: ${s.inlineCount} fichier(s), ~${mb} Mo${migrate ? `, migrés: ${s.migrated}` : ''}`,
    );
    totalCount += s.inlineCount;
    totalBytes += s.inlineBytes;
    totalMigrated += s.migrated;
  }
  console.log(
    `\nTotal: ${totalCount} fichier(s), ~${(totalBytes / (1024 * 1024)).toFixed(2)} Mo` +
      (migrate ? `, ${totalMigrated} migré(s)` : ''),
  );
  if (!migrate) {
    console.log('\nMode inventaire uniquement. Relancez avec --migrate pour uploader vers S3/R2.');
  }
}

async function main() {
  const driver = (process.env.UPLOAD_STORAGE_DRIVER ?? 'inline').toLowerCase();
  if (migrate && driver !== 's3' && driver !== 'r2') {
    console.error('Migration impossible : définir UPLOAD_STORAGE_DRIVER=s3 (ou r2) et les variables S3_*.');
    process.exit(1);
  }

  console.log(migrate ? 'Migration inline → S3/R2…' : 'Inventaire des médias inline (dry-run)…');

  await migrateMembers();
  await migrateBoatPhotos();
  await migrateAnnouncementPhotos();
  await migratePartners();
  await migrateUsers();
  await migrateCompanySignature();
  await migrateRentalContracts();
  await migrateBoatLegalDocs();

  printReport();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
