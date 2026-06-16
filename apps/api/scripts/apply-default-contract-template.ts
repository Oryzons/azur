/**
 * Remplit le(s) contrat(s) actif(s) avec le texte standard (CGV, annulation, justificatifs).
 * Usage: npx tsx scripts/apply-default-contract-template.ts [contractId]
 */
import { DEFAULT_BRAND_NAME } from '@bleu-calanque/shared';
import { PrismaClient } from '@prisma/client';
import { serializeDefaultTermsForTemplate } from '../src/rental-contracts/rental-contract-default-terms';

const prisma = new PrismaClient();

async function applyToContract(id: string) {
  const existing = await prisma.contract.findUnique({ where: { id } });
  if (!existing) {
    console.error(`Contrat introuvable: ${id}`);
    return;
  }
  const company = await prisma.companySettings.findUnique({ where: { id: 'company_settings' } });
  const brand = company?.brandName ?? DEFAULT_BRAND_NAME;
  const defaults = serializeDefaultTermsForTemplate(brand);

  let requiredDocuments = existing.requiredDocuments;
  try {
    const parsed = JSON.parse(existing.requiredDocuments || '[]') as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      requiredDocuments = JSON.stringify(defaults.requiredDocuments);
    }
  } catch {
    requiredDocuments = JSON.stringify(defaults.requiredDocuments);
  }

  const updated = await prisma.contract.update({
    where: { id },
    data: {
      name: existing.name === 'Nouveau contrat' ? `Contrat location ${DEFAULT_BRAND_NAME}` : existing.name,
      title: existing.title?.trim() ? existing.title : 'Contrat de location',
      description: defaults.description,
      cancellationTerms: defaults.cancellationTerms,
      rentalTerms: defaults.rentalTerms,
      requiredDocuments,
      active: true,
    },
  });

  const linked = await prisma.reservationRentalContract.updateMany({
    where: { contractTemplateId: null },
    data: { contractTemplateId: id },
  });

  console.log(`Contrat mis à jour: ${updated.name} (${updated.id})`);
  console.log(`  annulation: ${updated.cancellationTerms.length} car.`);
  console.log(`  location: ${updated.rentalTerms.length} car.`);
  console.log(`  réservations sans modèle reliées: ${linked.count}`);
}

async function main() {
  const argId = process.argv[2];
  if (argId) {
    await applyToContract(argId);
    return;
  }
  const active = await prisma.contract.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } });
  if (active.length === 0) {
    console.error('Aucun contrat actif.');
    return;
  }
  for (const c of active) {
    await applyToContract(c.id);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
