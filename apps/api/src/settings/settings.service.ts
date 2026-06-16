import {
  DEFAULT_BRAND_NAME,
  DEFAULT_COMPANY_ADDRESS_LINE,
  DEFAULT_COMPANY_CITY,
  DEFAULT_COMPANY_COUNTRY,
  DEFAULT_COMPANY_POSTAL_CODE,
  DEFAULT_RENTAL_ARRIVAL_LOCATION,
  DEFAULT_RENTAL_DEPARTURE_LOCATION,
  filterContractRequiredDocuments,
  signatureDataUrlSchema,
} from '@bleu-calanque/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { parseRequiredDocuments } from '../rental-contracts/rental-contract-field-resolvers';
import { PartnerKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuditAction, AuditEntity } from '../common/audit/audit.constants';
import { entityIdNameSnapshot } from '../common/audit/audit-snapshots';
import { SecureMediaService } from '../common/media/secure-media.service';
import { validateInput } from '../common/validation/validate-input';
import type {
  BankSettingsDto,
  BookingSettingsDto,
  CompanySettingsDto,
  CreateContractDto,
  CreatePartnerDto,
  EmailSettingsDto,
  NauticManagerSettingsDto,
  NotificationsSettingsDto,
  PublicSiteSettingsDto,
  SeoSettingsDto,
  UpdateContractDto,
  UpdatePartnerDto,
  UpdateSettingsDto,
} from './settings.dto';

const PARTNER_LINKED_OFFERING_SET = new Set(['BOAT_LICENSE', 'FLUVIAL', 'BOAT_RENTAL']);

function toLinkedOfferingsJson(input: string[] | undefined): string {
  if (!input?.length) return '["BOAT_LICENSE"]';
  const uniq: string[] = [];
  for (const x of input) {
    const v = String(x).toUpperCase();
    if (PARTNER_LINKED_OFFERING_SET.has(v) && !uniq.includes(v)) uniq.push(v);
  }
  if (uniq.length === 0) return '["BOAT_LICENSE"]';
  return JSON.stringify(uniq);
}

const COMPANY_ID = 'company_settings';
const BANK_ID = 'bank_settings';
const NOTIF_ID = 'notifications_settings';
const BOOKING_ID = 'booking_settings';
const EMAIL_ID = 'email_settings';
const PUBLIC_SITE_ID = 'public_site_settings';
const SEO_ID = 'seo_settings';
const NAUTIC_ID = 'nautic_manager_settings';

const COMPANY_DEFAULTS = {
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
  addressLine: DEFAULT_COMPANY_ADDRESS_LINE,
  city: DEFAULT_COMPANY_CITY,
  postalCode: DEFAULT_COMPANY_POSTAL_CODE,
  country: DEFAULT_COMPANY_COUNTRY,
  contactEmail: '',
  contactPhone: '',
  publicSiteUrl: '',
  brandName: DEFAULT_BRAND_NAME,
  adsVatRatePercent: 20,
  vatBasePercent: 100,
  vatPercent: 20,
  departureLocation: DEFAULT_RENTAL_DEPARTURE_LOCATION,
  arrivalLocation: DEFAULT_RENTAL_ARRIVAL_LOCATION,
  contactOpeningHours: 'Lundi – vendredi : 9h – 18h\nSamedi : 9h – 12h',
};

export type OwnerContactInfo = {
  brandName: string;
  legalName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  professionalPhone: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  addressFormatted: string | null;
  publicSiteUrl: string | null;
  openingHours: string | null;
};

const BANK_DEFAULTS = { accountHolder: '', iban: '', bic: '', bankName: '' };

const NOTIF_DEFAULTS = {
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
};

const BOOKING_DEFAULTS = {
  defaultNavalBase: DEFAULT_RENTAL_DEPARTURE_LOCATION,
  departureLocation: DEFAULT_RENTAL_DEPARTURE_LOCATION,
  arrivalLocation: DEFAULT_RENTAL_ARRIVAL_LOCATION,
  requireDeposit: true,
  depositDefaultAmount: '1500',
  paymentsOnlineEnabled: true,
};

const EMAIL_DEFAULTS = {
  fromName: DEFAULT_BRAND_NAME,
  fromEmail: '',
  replyToEmail: '',
  confirmationsEnabled: true,
};

const PUBLIC_SITE_DEFAULTS = {
  publicSiteUrl: '',
  brandName: DEFAULT_BRAND_NAME,
  contactEmail: '',
  contactPhone: '',
  addressLine: DEFAULT_COMPANY_ADDRESS_LINE,
  city: DEFAULT_COMPANY_CITY,
  postalCode: DEFAULT_COMPANY_POSTAL_CODE,
  country: DEFAULT_COMPANY_COUNTRY,
  departureLocation: DEFAULT_RENTAL_DEPARTURE_LOCATION,
  arrivalLocation: DEFAULT_RENTAL_ARRIVAL_LOCATION,
};

const SEO_DEFAULTS = {
  metaTitle: `Location bateau — ${DEFAULT_BRAND_NAME}`,
  metaDescription: 'Réservez votre bateau en quelques clics.',
  ogImageUrl: '',
};

const NAUTIC_DEFAULTS = {
  enabled: false,
  baseUrl: '',
  apiKey: '',
  webhookSecret: '',
  syncOwners: true,
  syncBoats: true,
  syncReservations: true,
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: SecureMediaService,
  ) {}

  async getAll() {
    const [company, bank, notif, booking, email, publicSite, seo, nautic, partners, contracts] = await Promise.all([
      this.prisma.companySettings.findUnique({ where: { id: COMPANY_ID } }),
      this.prisma.bankSettings.findUnique({ where: { id: BANK_ID } }),
      this.prisma.notificationsSettings.findUnique({ where: { id: NOTIF_ID } }),
      this.prisma.bookingSettings.findUnique({ where: { id: BOOKING_ID } }),
      this.prisma.emailSettings.findUnique({ where: { id: EMAIL_ID } }),
      this.prisma.publicSiteSettings.findUnique({ where: { id: PUBLIC_SITE_ID } }),
      this.prisma.seoSettings.findUnique({ where: { id: SEO_ID } }),
      this.prisma.nauticManagerSettings.findUnique({ where: { id: NAUTIC_ID } }),
      this.prisma.partner.findMany({ orderBy: { createdAt: 'desc' } }),
      this.listContracts(),
    ]);

    return {
      company: company ?? { id: COMPANY_ID, ...COMPANY_DEFAULTS, updatedAt: new Date() },
      bank: bank ?? { id: BANK_ID, ...BANK_DEFAULTS, updatedAt: new Date() },
      notifications: notif ?? { id: NOTIF_ID, ...NOTIF_DEFAULTS, updatedAt: new Date() },
      booking: booking ?? { id: BOOKING_ID, ...BOOKING_DEFAULTS, updatedAt: new Date() },
      email: email ?? { id: EMAIL_ID, ...EMAIL_DEFAULTS, updatedAt: new Date() },
      publicSite: publicSite ?? { id: PUBLIC_SITE_ID, ...PUBLIC_SITE_DEFAULTS, updatedAt: new Date() },
      seo: seo ?? { id: SEO_ID, ...SEO_DEFAULTS, updatedAt: new Date() },
      nauticManager: nautic ?? { id: NAUTIC_ID, ...NAUTIC_DEFAULTS, updatedAt: new Date() },
      partners,
      contracts,
    };
  }

  async update(input: UpdateSettingsDto) {
    const sections: string[] = [];
    if (input.company) {
      await this.upsertCompany(input.company);
      sections.push('company');
    }
    if (input.bank) {
      await this.upsertBank(input.bank);
      sections.push('bank');
    }
    if (input.notifications) {
      await this.upsertNotifications(input.notifications);
      sections.push('notifications');
    }
    if (input.booking) {
      await this.upsertBooking(input.booking);
      sections.push('booking');
    }
    if (input.email) {
      await this.upsertEmail(input.email);
      sections.push('email');
    }
    if (input.publicSite) {
      await this.upsertPublicSite(input.publicSite);
      sections.push('publicSite');
    }
    if (input.seo) {
      await this.upsertSeo(input.seo);
      sections.push('seo');
    }
    if (input.nauticManager) {
      await this.upsertNautic(input.nauticManager);
      sections.push('nauticManager');
    }
    if (sections.length) {
      await this.audit.log({
        action: AuditAction.UPDATE,
        entity: AuditEntity.SETTINGS,
        entityId: 'global',
        newData: { sections },
      });
    }
    return this.getAll();
  }

  async getOwnerContact(): Promise<OwnerContactInfo> {
    const row = await this.prisma.companySettings.findUnique({ where: { id: COMPANY_ID } });
    const c = row ?? { id: COMPANY_ID, ...COMPANY_DEFAULTS, updatedAt: new Date() };
    const contactPhone = (c.contactPhone || c.professionalPhone || '').trim();
    const professionalPhone = (c.professionalPhone || '').trim();
    const addressParts = [
      c.addressLine?.trim(),
      [c.postalCode?.trim(), c.city?.trim()].filter(Boolean).join(' '),
      c.country?.trim(),
    ].filter(Boolean) as string[];
    const openingHours = (c.contactOpeningHours || '').trim();
    return {
      brandName: (c.brandName || c.tradeName || DEFAULT_BRAND_NAME).trim(),
      legalName: (c.legalName || '').trim(),
      contactEmail: c.contactEmail?.trim() || null,
      contactPhone: contactPhone || null,
      professionalPhone: professionalPhone || null,
      addressLine: c.addressLine?.trim() || null,
      postalCode: c.postalCode?.trim() || null,
      city: c.city?.trim() || null,
      country: c.country?.trim() || null,
      addressFormatted: addressParts.length ? addressParts.join('\n') : null,
      publicSiteUrl: c.publicSiteUrl?.trim() || null,
      openingHours: openingHours || null,
    };
  }

  private async upsertCompany(c: CompanySettingsDto) {
    const existing = await this.prisma.companySettings.findUnique({ where: { id: COMPANY_ID } });
    const patch = stripUndefined(c);
    if (c.contractOperatorSignatureDataUrl !== undefined) {
      patch.contractOperatorSignatureDataUrl = await this.processOperatorSignatureUrl(
        c.contractOperatorSignatureDataUrl,
        existing?.contractOperatorSignatureDataUrl,
      );
    }
    const data = { ...COMPANY_DEFAULTS, ...patch };
    await this.prisma.companySettings.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, ...data },
      update: patch,
    });
  }

  /** Valide et stocke la signature exploitant (PNG canvas → image compressée). */
  private async processOperatorSignatureUrl(
    incoming: string | null | undefined,
    existingUrl: string | null | undefined,
  ): Promise<string | null> {
    if (incoming == null || !incoming.trim()) return null;
    const trimmed = incoming.trim();
    validateInput(signatureDataUrlSchema, trimmed);
    const kept = existingUrl?.trim() ?? '';
    if (trimmed === kept && (trimmed.startsWith('https://') || trimmed.startsWith('data:image/'))) {
      return trimmed;
    }
    return (await this.media.processOptionalImageUrl(trimmed)) ?? null;
  }

  /** Logo partenaire : compression + stockage sécurisé. */
  private async processPartnerLogoUrl(
    incoming: string | null | undefined,
    existingUrl: string | null | undefined,
  ): Promise<string | null> {
    if (incoming == null || !incoming.trim()) return null;
    const trimmed = incoming.trim();
    const kept = existingUrl?.trim() ?? '';
    if (trimmed === kept && (trimmed.startsWith('https://') || trimmed.startsWith('data:image/'))) {
      return trimmed;
    }
    return (await this.media.processOptionalImageUrl(trimmed)) ?? null;
  }
  private async upsertBank(b: BankSettingsDto) {
    const data = { ...BANK_DEFAULTS, ...stripUndefined(b) };
    await this.prisma.bankSettings.upsert({
      where: { id: BANK_ID },
      create: { id: BANK_ID, ...data },
      update: stripUndefined(b),
    });
  }
  private async upsertNotifications(n: NotificationsSettingsDto) {
    const data = { ...NOTIF_DEFAULTS, ...stripUndefined(n) };
    await this.prisma.notificationsSettings.upsert({
      where: { id: NOTIF_ID },
      create: { id: NOTIF_ID, ...data },
      update: stripUndefined(n),
    });
  }
  private async upsertBooking(b: BookingSettingsDto) {
    const data = { ...BOOKING_DEFAULTS, ...stripUndefined(b) };
    await this.prisma.bookingSettings.upsert({
      where: { id: BOOKING_ID },
      create: { id: BOOKING_ID, ...data },
      update: stripUndefined(b),
    });
  }
  private async upsertEmail(e: EmailSettingsDto) {
    const data = { ...EMAIL_DEFAULTS, ...stripUndefined(e) };
    await this.prisma.emailSettings.upsert({
      where: { id: EMAIL_ID },
      create: { id: EMAIL_ID, ...data },
      update: stripUndefined(e),
    });
  }
  private async upsertPublicSite(p: PublicSiteSettingsDto) {
    const data = { ...PUBLIC_SITE_DEFAULTS, ...stripUndefined(p) };
    await this.prisma.publicSiteSettings.upsert({
      where: { id: PUBLIC_SITE_ID },
      create: { id: PUBLIC_SITE_ID, ...data },
      update: stripUndefined(p),
    });
  }
  private async upsertSeo(s: SeoSettingsDto) {
    const data = { ...SEO_DEFAULTS, ...stripUndefined(s) };
    await this.prisma.seoSettings.upsert({
      where: { id: SEO_ID },
      create: { id: SEO_ID, ...data },
      update: stripUndefined(s),
    });
  }
  private async upsertNautic(n: NauticManagerSettingsDto) {
    const data = { ...NAUTIC_DEFAULTS, ...stripUndefined(n) };
    await this.prisma.nauticManagerSettings.upsert({
      where: { id: NAUTIC_ID },
      create: { id: NAUTIC_ID, ...data },
      update: stripUndefined(n),
    });
  }

  // Partners
  listPartners() {
    return this.prisma.partner.findMany({ orderBy: { createdAt: 'desc' } });
  }
  async createPartner(input: CreatePartnerDto) {
    const name = (input.name ?? '').trim();
    if (!name) throw new BadRequestException('Nom requis.');
    const kind = (input.kind as PartnerKind | undefined) ?? PartnerKind.OTHER;
    const linkedOfferingsJson = toLinkedOfferingsJson(input.linkedOfferings);
    const logoUrl = await this.processPartnerLogoUrl(input.logoUrl, null);
    const partner = await this.prisma.partner.create({
      data: {
        name,
        kind,
        linkedOfferingsJson,
        description: input.description ?? '',
        logoUrl: logoUrl ?? '',
        price: input.price ?? '',
        active: input.active ?? true,
        contactName: input.contactName ?? '',
        contactEmail: input.contactEmail ?? '',
        contactPhone: input.contactPhone ?? '',
        note: input.note ?? '',
      },
    });
    await this.audit.logCreate(AuditEntity.PARTNER, partner.id, entityIdNameSnapshot(partner));
    return partner;
  }
  async updatePartner(id: string, input: UpdatePartnerDto) {
    const existing = await this.prisma.partner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Partenaire introuvable.');
    const logoUrl =
      input.logoUrl !== undefined
        ? await this.processPartnerLogoUrl(input.logoUrl, existing.logoUrl)
        : existing.logoUrl;
    const partner = await this.prisma.partner.update({
      where: { id },
      data: {
        name: input.name !== undefined ? input.name.trim() : existing.name,
        kind: input.kind !== undefined ? (input.kind as PartnerKind) : existing.kind,
        linkedOfferingsJson:
          input.linkedOfferings !== undefined
            ? toLinkedOfferingsJson(input.linkedOfferings)
            : existing.linkedOfferingsJson,
        description: input.description !== undefined ? input.description : existing.description,
        logoUrl: logoUrl ?? '',
        price: input.price !== undefined ? input.price : existing.price,
        contactName: input.contactName !== undefined ? input.contactName : existing.contactName,
        contactEmail: input.contactEmail !== undefined ? input.contactEmail : existing.contactEmail,
        contactPhone: input.contactPhone !== undefined ? input.contactPhone : existing.contactPhone,
        note: input.note !== undefined ? input.note : existing.note,
        active: input.active !== undefined ? input.active : existing.active,
      },
    });
    await this.audit.logUpdate(AuditEntity.PARTNER, id, entityIdNameSnapshot(existing), entityIdNameSnapshot(partner));
    return partner;
  }
  async removePartner(id: string) {
    const existing = await this.prisma.partner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Partenaire introuvable.');
    await this.prisma.partner.delete({ where: { id } });
    await this.audit.logDelete(AuditEntity.PARTNER, id, entityIdNameSnapshot(existing));
    return { ok: true as const };
  }

  // Contracts
  async listContracts() {
    const rows = await this.prisma.contract.findMany({ orderBy: { createdAt: 'desc' } });
    const grouped = await this.prisma.reservationRentalContract.groupBy({
      by: ['contractTemplateId'],
      where: { contractTemplateId: { not: null } },
      _count: { _all: true },
    });
    const countByTemplate = new Map(
      grouped.map((g) => [g.contractTemplateId!, g._count._all]),
    );
    return rows.map((row) => ({
      ...row,
      requiredDocuments: JSON.stringify(parseRequiredDocuments(row.requiredDocuments)),
      linkedReservationsCount: countByTemplate.get(row.id) ?? 0,
    }));
  }

  async getDefaultContractTemplateTexts() {
    const company = await this.prisma.companySettings.findUnique({ where: { id: 'company_settings' } });
    const brand = company?.brandName ?? DEFAULT_BRAND_NAME;
    const { serializeDefaultTermsForTemplate } = await import(
      '../rental-contracts/rental-contract-default-terms'
    );
    return serializeDefaultTermsForTemplate(brand);
  }

  async applyDefaultContractTemplate(id: string) {
    const existing = await this.prisma.contract.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contrat introuvable.');
    const defaults = await this.getDefaultContractTemplateTexts();
    let requiredDocuments: string[] | undefined;
    try {
      const parsed = JSON.parse(existing.requiredDocuments || '[]') as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        requiredDocuments = defaults.requiredDocuments;
      }
    } catch {
      requiredDocuments = defaults.requiredDocuments;
    }

    return this.updateContract(id, {
      name: existing.name === 'Nouveau contrat' ? `Contrat location ${DEFAULT_BRAND_NAME}` : existing.name,
      title: existing.title?.trim() ? existing.title : 'Contrat de location',
      description: defaults.description,
      cancellationTerms: defaults.cancellationTerms,
      rentalTerms: defaults.rentalTerms,
      requiredDocuments,
      active: true,
    });
  }
  private normalizeRequiredDocumentsJson(docs: string[] | undefined): string {
    return JSON.stringify(filterContractRequiredDocuments(docs ?? []));
  }

  async createContract(input: CreateContractDto) {
    const name = (input.name ?? '').trim();
    if (!name) throw new BadRequestException('Nom requis.');
    const contract = await this.prisma.contract.create({
      data: {
        name,
        title: (input.title ?? '').trim(),
        description: input.description ?? '',
        requiredDocuments: this.normalizeRequiredDocumentsJson(input.requiredDocuments),
        cancellationTerms: input.cancellationTerms ?? '',
        rentalTerms: input.rentalTerms ?? '',
        active: input.active ?? true,
      },
    });
    await this.audit.logCreate(AuditEntity.CONTRACT, contract.id, entityIdNameSnapshot(contract));
    return contract;
  }
  async updateContract(id: string, input: UpdateContractDto) {
    const existing = await this.prisma.contract.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contrat introuvable.');
    const contract = await this.prisma.contract.update({
      where: { id },
      data: {
        name: (input.name ?? existing.name).trim(),
        title: (input.title ?? existing.title).trim(),
        description: input.description !== undefined ? input.description : existing.description,
        requiredDocuments:
          input.requiredDocuments !== undefined
            ? this.normalizeRequiredDocumentsJson(input.requiredDocuments)
            : existing.requiredDocuments,
        cancellationTerms:
          input.cancellationTerms !== undefined ? input.cancellationTerms : existing.cancellationTerms,
        rentalTerms: input.rentalTerms !== undefined ? input.rentalTerms : existing.rentalTerms,
        active: input.active ?? existing.active,
      },
    });
    await this.audit.logUpdate(AuditEntity.CONTRACT, id, entityIdNameSnapshot(existing), entityIdNameSnapshot(contract));
    return contract;
  }
  async removeContract(id: string) {
    const existing = await this.prisma.contract.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contrat introuvable.');
    await this.prisma.contract.delete({ where: { id } });
    await this.audit.logDelete(AuditEntity.CONTRACT, id, entityIdNameSnapshot(existing));
    return { ok: true as const };
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(o ?? {}) as Array<keyof T>) {
    const v = (o as any)[k];
    if (v !== undefined) (out as any)[k] = v;
  }
  return out;
}
