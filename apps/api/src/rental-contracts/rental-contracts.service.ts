import { BadRequestException, Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentChannel,
  ReservationStatus,
  type Prisma,
  type ReservationRentalContract,
} from '@prisma/client';
import { validateInput } from '../common/validation/validate-input';
import { PrismaService } from '../prisma/prisma.service';
import { ResendMailService } from '../notifications/resend-mail.service';
import { HtmlToPdfService } from './html-to-pdf.service';
import type { Env } from '../config/env';
import { buildRentalContractHtml, type RentalContractViewModel } from './rental-contract-html';
import { buildMockPreviewViewModel } from './rental-contract-preview-mock';
import {
  buildPassengerSummary,
  contractDisplayOrNotSet,
  parseBoatDetailsJson,
  parseRequiredDocuments,
  parseReservationContractFields,
  resolveIdentityForContract,
  resolveLicenseForContract,
} from './rental-contract-field-resolvers';
import { assertSignedHtmlIntegrity, hashSignedContractHtml } from './rental-contract-integrity';
import { resolveContractDocumentChecklist } from './rental-contract-document-checklist';
import {
  buildReservationContractSnapshot,
  hashReservationContractSnapshot,
  reservationSnapshotInclude,
  type ReservationContractSnapshotSource,
} from './rental-contract-snapshot';
import {
  DEFAULT_BRAND_NAME,
  buildDocumentPaymentLines,
  buildDocumentPaymentObligations,
  documentPaymentBalanceCents,
  isPaymentMethod,
  isReservationPaidForContract,
  resolveRentalContractStatus,
  resolveRentalLocations,
  resolveStoreCreditAppliedCents,
} from '@bleu-calanque/shared';
import { MemberCreditsService } from '../member-credits/member-credits.service';
import { InternalNotificationsService } from '../internal-notifications/internal-notifications.service';
import { ReservationNotificationsService } from '../notifications/reservation-notifications.service';
import { computeReservationGrandTotalCents, reservationPricingInputFromRow } from '../pricing/reservation-pricing';
import { mapReservationExtrasForPricing } from '../pricing/reservation-pricing-map';
import { computeExtraLineCents, extraDocumentLabel, rentalDaysBetween } from '@bleu-calanque/shared';
import { CouponDiscountKind } from '@prisma/client';
import {
  buildRentalContractSignedEmailHtml,
  buildRentalContractSignedEmailText,
} from '../notifications/templates/rental-contract-signed-email';

export type RentalContractPublicSummary = {
  brandName: string;
  contractNumber: number;
  clientName: string;
  clientEmail: string;
  boatName: string;
  boatModel: string;
  startLabel: string;
  endLabel: string;
  baseLabel: string;
  totalLabel: string;
  depositLabel: string | null;
  pricingLines: { description: string; amountLabel: string }[];
  paymentItems: { label: string; methodLabel: string; amountLabel: string; paid: boolean }[];
  balanceDueLabel: string | null;
  paid: boolean;
};
import { z } from 'zod';
import { optionalDocumentUrlSchema, signatureDataUrlSchema } from '@bleu-calanque/shared';
import { couponRequiresAirbusBadge } from '../coupons/airbus-coupon.util';
import { SecureMediaService } from '../common/media/secure-media.service';

const signBodySchema = z.object({
  clientSignature: signatureDataUrlSchema,
  cniFrontUrl: optionalDocumentUrlSchema,
  cniBackUrl: optionalDocumentUrlSchema,
  boatLicenseFrontUrl: optionalDocumentUrlSchema,
  boatLicenseBackUrl: optionalDocumentUrlSchema,
  airbusBadgePhotoUrl: optionalDocumentUrlSchema,
});

type MemberDocumentUrls = {
  cniFrontUrl: string | null;
  cniBackUrl: string | null;
  boatLicenseFrontUrl: string | null;
  boatLicenseBackUrl: string | null;
  airbusBadgePhotoUrl: string | null;
};

const operatorSignBodySchema = z.object({
  operatorSignature: signatureDataUrlSchema,
});

const reservationInclude = {
  boat: { include: { ownerMember: true } },
  extras: { include: { extra: true } },
  installmentPlan: { orderBy: { sequence: 'asc' as const } },
  clientMember: {
    select: {
      cniFrontUrl: true,
      cniBackUrl: true,
      boatLicenseFrontUrl: true,
      boatLicenseBackUrl: true,
      airbusBadgePhotoUrl: true,
    },
  },
} satisfies Prisma.ReservationInclude;

type ReservationFull = Prisma.ReservationGetPayload<{ include: typeof reservationInclude }>;

@Injectable()
export class RentalContractsService {
  private readonly logger = new Logger(RentalContractsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly mail: ResendMailService,
    private readonly htmlToPdf: HtmlToPdfService,
    @Inject(forwardRef(() => ReservationNotificationsService))
    private readonly reservationNotifications: ReservationNotificationsService,
    private readonly internalNotifications: InternalNotificationsService,
    private readonly media: SecureMediaService,
    private readonly memberCredits: MemberCreditsService,
  ) {}

  /** Rattrape le paiement Stripe avant lecture / signature du contrat (webhook manquant). */
  private async syncStripePaymentIfNeeded(reservation: ReservationFull): Promise<ReservationFull> {
    if (isReservationPaidForContract(reservation)) return reservation;
    if (reservation.paymentChannel !== PaymentChannel.ONLINE) return reservation;
    const sessionId = reservation.stripeCheckoutSessionId?.trim();
    if (!sessionId) return reservation;
    try {
      const ok = await this.reservationNotifications.confirmPaymentFromCheckoutSession(sessionId);
      if (!ok) return reservation;
      const refreshed = await this.prisma.reservation.findUnique({
        where: { id: reservation.id },
        include: reservationInclude,
      });
      return refreshed ?? reservation;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Sync Stripe contrat (${reservation.id}): ${msg}`);
      return reservation;
    }
  }

  private async loadContractRowByToken(token: string) {
    return this.prisma.reservationRentalContract.findUnique({
      where: { signToken: token },
      include: { reservation: { include: reservationInclude } },
    });
  }

  private resolveSignBlockedReason(
    reservation: ReservationFull,
    operatorSignatureReady: boolean,
    signedAt: Date | null,
  ): string | null {
    if (signedAt) return null;
    if (!isReservationPaidForContract(reservation)) {
      if (reservation.paymentChannel === PaymentChannel.ONLINE) {
        return 'Le paiement en ligne doit être confirmé avant la signature du contrat. Utilisez le bouton « Payer » ci-dessous, puis revenez sur cette page.';
      }
      return `Le paiement de la location doit être enregistré par la base avant la signature du contrat. Contactez ${DEFAULT_BRAND_NAME}.`;
    }
    if (!operatorSignatureReady) {
      return "La validation par l'équipe est en cours. Réessayez dans quelques instants ou contactez la base.";
    }
    return null;
  }

  private shouldRequireAirbusBadge(reservation: ReservationFull): boolean {
    const code = reservation.couponCode?.trim().replaceAll(/\s+/g, '').toUpperCase() || '';
    if (!code) return false;
    const coupon = { code };
    return couponRequiresAirbusBadge(coupon as any);
  }

  private ensureDocumentsProvidedForSignature(
    requiredLabels: string[],
    checklist: { label: string; status: 'provided' | 'missing' }[],
    opts: { requireAirbusBadge: boolean },
  ): string | null {
    const identityMissing = checklist.some(
      (i) => i.status === 'missing' && /identit|passeport|\bcni\b|titre de s/i.test(i.label),
    );
    if (identityMissing) {
      return 'Veuillez téléverser la photo recto et verso de votre pièce d’identité avant de signer.';
    }

    const licenseMissing = checklist.some(
      (i) => i.status === 'missing' && /permis|certificat/i.test(i.label),
    );
    if (licenseMissing) {
      return 'Veuillez téléverser la photo recto et verso de votre permis bateau (ou certificat côtier) avant de signer.';
    }

    if (opts.requireAirbusBadge) {
      const labelHasBadge = requiredLabels.some((l) => /airbus|badge/i.test(l));
      const badgeMissing = labelHasBadge
        ? checklist.some((i) => i.status === 'missing' && /airbus|badge/i.test(i.label))
        : true;
      if (badgeMissing) {
        return 'Veuillez téléverser une photo de votre badge Airbus avant de signer.';
      }
    }

    return null;
  }

  private async resolveSignDocumentUrls(
    body: z.infer<typeof signBodySchema>,
    member: MemberDocumentUrls | null,
  ): Promise<MemberDocumentUrls> {
    const pick = async (incoming: string | null | undefined, existing: string | null) => {
      if (incoming != null && String(incoming).trim()) {
        return this.media.processOptionalDocumentUrl(incoming);
      }
      return existing?.trim() ? existing : null;
    };
    return {
      cniFrontUrl: await pick(body.cniFrontUrl, member?.cniFrontUrl ?? null),
      cniBackUrl: await pick(body.cniBackUrl, member?.cniBackUrl ?? null),
      boatLicenseFrontUrl: await pick(body.boatLicenseFrontUrl, member?.boatLicenseFrontUrl ?? null),
      boatLicenseBackUrl: await pick(body.boatLicenseBackUrl, member?.boatLicenseBackUrl ?? null),
      airbusBadgePhotoUrl: await pick(body.airbusBadgePhotoUrl, member?.airbusBadgePhotoUrl ?? null),
    };
  }

  private validateSignDocumentUrls(docs: MemberDocumentUrls, requireAirbusBadge: boolean): void {
    if (!docs.cniFrontUrl?.trim() || !docs.cniBackUrl?.trim()) {
      throw new BadRequestException(
        'Pièce d’identité : photos recto et verso requises avant signature.',
      );
    }
    if (!docs.boatLicenseFrontUrl?.trim() || !docs.boatLicenseBackUrl?.trim()) {
      throw new BadRequestException(
        'Permis bateau : photos recto et verso requises avant signature.',
      );
    }
    if (requireAirbusBadge && !docs.airbusBadgePhotoUrl?.trim()) {
      throw new BadRequestException('Photo du badge Airbus requise avant signature.');
    }
  }

  private async persistMemberDocuments(
    reservation: ReservationFull,
    docs: MemberDocumentUrls,
  ): Promise<void> {
    const memberId = reservation.clientMemberId?.trim();
    const memberEmail = reservation.clientEmail?.trim()?.toLowerCase() || '';
    try {
      if (memberId) {
        await this.prisma.member.update({ where: { id: memberId }, data: docs });
        return;
      }
      if (memberEmail.includes('@')) {
        const m = await this.prisma.member.findUnique({ where: { email: memberEmail } });
        if (m) await this.prisma.member.update({ where: { id: m.id }, data: docs });
      }
    } catch (err) {
      this.logger.warn(
        `Maj photos justificatifs client ignorée (${reservation.id}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private publicAppUrl(): string {
    const base =
      this.config.get('PUBLIC_APP_URL', { infer: true }) ??
      this.config.get('ADMIN_URL', { infer: true }) ??
      'http://localhost:5173';
    return base.replace(/\/$/, '');
  }

  signUrl(token: string): string {
    return `${this.publicAppUrl()}/contrat/signer?token=${encodeURIComponent(token)}`;
  }

  contractPdfDownloadUrl(token: string): string {
    return `${this.publicAppUrl()}/contrat/telecharger?token=${encodeURIComponent(token)}`;
  }

  private async companyRow() {
    return this.prisma.companySettings.findUnique({ where: { id: 'company_settings' } });
  }

  private resolveOperatorSignature(
    contract: { operatorSignatureDataUrl: string | null },
    company: { contractOperatorSignatureDataUrl: string | null } | null,
  ): string | null {
    return contract.operatorSignatureDataUrl ?? company?.contractOperatorSignatureDataUrl ?? null;
  }

  private async seedOperatorSignatureIfNeeded(
    contract: ReservationRentalContract,
  ): Promise<ReservationRentalContract> {
    if (contract.operatorSignatureDataUrl) return contract;
    const company = await this.companyRow();
    const auto = company?.contractOperatorSignatureDataUrl;
    if (!auto) return contract;
    return this.prisma.reservationRentalContract.update({
      where: { id: contract.id },
      data: { operatorSignatureDataUrl: auto },
    });
  }

  async ensureForReservation(reservationId: string) {
    const existing = await this.prisma.reservationRentalContract.findUnique({
      where: { reservationId },
    });
    if (existing) {
      let row = existing;
      if (!existing.contractTemplateId) {
        const template = await this.prisma.contract.findFirst({
          where: { active: true },
          orderBy: { createdAt: 'desc' },
        });
        if (template) {
          row = await this.prisma.reservationRentalContract.update({
            where: { id: existing.id },
            data: { contractTemplateId: template.id },
          });
        }
      }
      if (!row.signedAt) {
        row = await this.seedOperatorSignatureIfNeeded(row);
      }
      return row;
    }

    const max = await this.prisma.reservationRentalContract.aggregate({ _max: { contractNumber: true } });
    const contractNumber = Math.max(1_000_000, (max._max.contractNumber ?? 999_999) + 1);

    const template = await this.prisma.contract.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });

    const created = await this.prisma.reservationRentalContract.create({
      data: {
        reservationId,
        contractNumber,
        contractTemplateId: template?.id ?? null,
      },
    });
    return this.seedOperatorSignatureIfNeeded(created);
  }

  async setOperatorSignature(reservationId: string, raw: unknown) {
    const body = validateInput(operatorSignBodySchema, raw);
    const row = await this.prisma.reservationRentalContract.findUnique({ where: { reservationId } });
    if (!row) throw new NotFoundException('Contrat introuvable pour cette réservation.');
    if (row.signedAt || row.contractLocked) {
      throw new BadRequestException('Le contrat est déjà signé — la signature exploitant ne peut plus être modifiée.');
    }
    return this.prisma.reservationRentalContract.update({
      where: { id: row.id },
      data: { operatorSignatureDataUrl: body.operatorSignature },
    });
  }

  private async loadReservationForSnapshot(reservationId: string) {
    return this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: reservationSnapshotInclude,
    });
  }

  private computeSnapshotSha256(
    reservation: NonNullable<Awaited<ReturnType<RentalContractsService['loadReservationForSnapshot']>>>,
  ): string {
    return hashReservationContractSnapshot(buildReservationContractSnapshot(reservation));
  }

  /** Vrai si les données réservation ne correspondent plus au snapshot signé. */
  async isReservationContractDataStale(reservationId: string): Promise<boolean> {
    const contract = await this.prisma.reservationRentalContract.findUnique({
      where: { reservationId },
      select: { signedAt: true, signedReservationSnapshotSha256: true },
    });
    if (!contract?.signedAt || !contract.signedReservationSnapshotSha256) return false;
    const reservation = await this.loadReservationForSnapshot(reservationId);
    if (!reservation) return false;
    const current = this.computeSnapshotSha256(reservation);
    return current !== contract.signedReservationSnapshotSha256;
  }

  contractDataStaleForReservation(
    reservation: ReservationContractSnapshotSource,
    contract: { signedAt: Date | null; signedReservationSnapshotSha256: string | null },
  ): boolean {
    if (!contract.signedAt || !contract.signedReservationSnapshotSha256) return false;
    const current = hashReservationContractSnapshot(buildReservationContractSnapshot(reservation));
    return current !== contract.signedReservationSnapshotSha256;
  }

  buildAdminContractMeta(
    reservation: {
      paymentCapturedAt: Date | null;
      status: ReservationStatus;
    },
    contract: {
      signedAt: Date | null;
      contractSignEmailSentAt: Date | null;
      contractSignedEmailSentAt: Date | null;
      signedReservationSnapshotSha256: string | null;
      contractLocked: boolean;
    } | null,
    opts?: { dataStale?: boolean },
  ) {
    if (!contract) {
      return {
        signed: false,
        contractLocked: false,
        contractSignEmailSentAt: null as string | null,
        contractSignedEmailSentAt: null as string | null,
        contractDataStale: false,
        status: resolveRentalContractStatus({
          signedAt: null,
          contractSignEmailSentAt: null,
          paymentCapturedAt: reservation.paymentCapturedAt,
          apiStatus: reservation.status,
        }),
      };
    }
    const status = resolveRentalContractStatus({
      signedAt: contract.signedAt,
      contractSignEmailSentAt: contract.contractSignEmailSentAt,
      paymentCapturedAt: reservation.paymentCapturedAt,
      apiStatus: reservation.status,
    });
    return {
      signed: Boolean(contract.signedAt),
      contractLocked: contract.contractLocked,
      contractSignEmailSentAt: contract.contractSignEmailSentAt?.toISOString() ?? null,
      contractSignedEmailSentAt: contract.contractSignedEmailSentAt?.toISOString() ?? null,
      contractDataStale: Boolean(opts?.dataStale),
      status,
    };
  }

  /** Bloque la modification des données contractuelles de la réservation. */
  async assertReservationContractUnlocked(reservationId: string): Promise<void> {
    const row = await this.prisma.reservationRentalContract.findUnique({
      where: { reservationId },
      select: { signedAt: true, contractLocked: true },
    });
    if (row?.signedAt || row?.contractLocked) {
      throw new BadRequestException(
        'Contrat signé : les données de réservation liées au contrat ne peuvent plus être modifiées.',
      );
    }
  }

  /**
   * Met à jour le PDF/HTML du contrat déjà signé (nouveau bateau, dates, tarif)
   * sans demander une nouvelle signature client.
   */
  async refreshSignedContractAfterScheduleChange(reservationId: string): Promise<boolean> {
    const row = await this.prisma.reservationRentalContract.findUnique({
      where: { reservationId },
      include: { reservation: { include: reservationInclude } },
    });
    if (!row?.signedAt || !row.clientSignatureDataUrl) return false;

    const operatorSignature = this.resolveOperatorSignature(row, await this.companyRow());
    if (!operatorSignature) return false;

    const vm = await this.buildViewModel(row.reservation, row, {
      clientSignature: row.clientSignatureDataUrl,
      operatorSignature,
      signedAt: row.signedAt,
    });
    const signedHtml = buildRentalContractHtml(vm);
    const signedHtmlSha256 = hashSignedContractHtml(signedHtml);
    const snapshotReservation = await this.loadReservationForSnapshot(reservationId);
    const signedReservationSnapshotSha256 = snapshotReservation
      ? this.computeSnapshotSha256(snapshotReservation)
      : row.signedReservationSnapshotSha256;

    await this.prisma.reservationRentalContract.update({
      where: { id: row.id },
      data: {
        signedHtml,
        signedHtmlSha256,
        signedReservationSnapshotSha256,
        contractLocked: true,
      },
    });
    return true;
  }

  /**
   * Réinitialise la signature client (usage exceptionnel — plus utilisé au déplacement).
   * Conserve la signature opérateur et le numéro de contrat.
   */
  async resetClientSignatureAfterReservationChange(reservationId: string): Promise<boolean> {
    const row = await this.prisma.reservationRentalContract.findUnique({
      where: { reservationId },
      select: { signedAt: true, contractLocked: true, signedHtml: true },
    });
    if (!row?.signedAt && !row?.contractLocked && !row?.signedHtml) return false;

    await this.prisma.reservationRentalContract.update({
      where: { reservationId },
      data: {
        signedAt: null,
        signedHtml: null,
        signedHtmlSha256: null,
        signedReservationSnapshotSha256: null,
        contractLocked: false,
        clientSignatureDataUrl: null,
        contractSignedEmailSentAt: null,
        contractTemplateVersionAt: null,
      },
    });
    return true;
  }

  async getPublicByToken(token: string) {
    let row = await this.loadContractRowByToken(token);
    if (!row) throw new NotFoundException('Contrat introuvable.');
    const reservation = await this.syncStripePaymentIfNeeded(row.reservation);
    row = { ...row, reservation };

    const company = await this.companyRow();
    const operatorSignatureReady = Boolean(this.resolveOperatorSignature(row, company));
    const requireAirbusBadge = this.shouldRequireAirbusBadge(reservation);
    const templateRow =
      row.contractTemplateId != null
        ? await this.prisma.contract.findUnique({ where: { id: row.contractTemplateId } })
        : await this.prisma.contract.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } });
    const template = this.templateForContract(templateRow);
    const requiredLabels = requireAirbusBadge
      ? Array.from(new Set([...template.requiredDocuments, 'Badge Airbus']))
      : template.requiredDocuments;

    const vm = await this.buildViewModel(reservation, { ...row, contractTemplateId: templateRow?.id ?? row.contractTemplateId });
    const paid = isReservationPaidForContract(reservation);
    const baseBlocked = this.resolveSignBlockedReason(
      reservation,
      operatorSignatureReady,
      row.signedAt,
    );
    const checklist = resolveContractDocumentChecklist({
      requiredLabels,
      detailsJson: reservation.detailsJson,
      member: reservation.clientMember,
    });
    const docsBlocked = this.ensureDocumentsProvidedForSignature(requiredLabels, checklist, {
      requireAirbusBadge,
    });

    const canSign = !row.signedAt && paid && operatorSignatureReady && !baseBlocked;
    const signBlockedReason = baseBlocked ?? docsBlocked;
    return {
      contractNumber: row.contractNumber,
      signed: Boolean(row.signedAt),
      signedAt: row.signedAt?.toISOString() ?? null,
      operatorSignatureReady,
      paid,
      paymentRequired: !paid && !row.signedAt,
      canSign,
      signBlockedReason,
      pdfDownloadUrl: row.signedAt ? this.contractPdfDownloadUrl(token) : null,
      signedEmailSent: Boolean(row.contractSignedEmailSentAt),
      summary: this.buildPublicSummary(vm, paid),
      requiredDocuments: requiredLabels,
      documentChecklist: checklist,
      documentPhotos: {
        hasCniFront: Boolean(reservation.clientMember?.cniFrontUrl?.trim()),
        hasCniBack: Boolean(reservation.clientMember?.cniBackUrl?.trim()),
        hasBoatLicenseFront: Boolean(reservation.clientMember?.boatLicenseFrontUrl?.trim()),
        hasBoatLicenseBack: Boolean(reservation.clientMember?.boatLicenseBackUrl?.trim()),
        hasAirbusBadgePhoto: Boolean(reservation.clientMember?.airbusBadgePhotoUrl?.trim()),
        requireAirbusBadge,
      },
      reservation: {
        id: reservation.id,
        boatName: reservation.boat.name,
        paid,
        paymentChannel: reservation.paymentChannel,
        paymentUrl: reservation.paymentLinkUrl,
      },
    };
  }

  private buildPublicSummary(vm: RentalContractViewModel, paid: boolean): RentalContractPublicSummary {
    const base = [vm.company.addressLine, vm.company.postalCode, vm.company.city].filter(Boolean).join(', ');
    const balanceDueLabel = vm.balanceDue !== '0,00 €' && vm.balanceDue !== '—' ? vm.balanceDue : null;

    return {
      brandName: vm.company.brandName,
      contractNumber: vm.contractNumber,
      clientName: vm.locataire.name,
      clientEmail: vm.locataire.email,
      boatName: vm.bateau.name,
      boatModel: vm.bateau.brandModel,
      startLabel: vm.location.start,
      endLabel: vm.location.end,
      baseLabel: base || '—',
      totalLabel: vm.pricingTotal.ttc,
      depositLabel: vm.bateau.deposit !== '—' ? vm.bateau.deposit : null,
      pricingLines: vm.pricingLines.map((l) => ({
        description: l.description,
        amountLabel: l.ttc,
      })),
      paymentItems: vm.paymentObligations.map((p) => ({
        label: p.label,
        methodLabel: p.methodLabel,
        amountLabel: p.amount,
        paid: p.paid,
      })),
      balanceDueLabel,
      paid,
    };
  }

  async signByToken(token: string, raw: unknown) {
    const body = validateInput(signBodySchema, raw);
    let row = await this.loadContractRowByToken(token);
    if (!row) throw new NotFoundException('Contrat introuvable.');
    const reservation = await this.syncStripePaymentIfNeeded(row.reservation);
    row = { ...row, reservation };

    const requireAirbusBadge = this.shouldRequireAirbusBadge(reservation);

    if (!isReservationPaidForContract(reservation)) {
      throw new BadRequestException(
        reservation.paymentChannel === PaymentChannel.ONLINE
          ? 'Paiement non confirmé : réglez la location en ligne avant de signer le contrat.'
          : 'Paiement non enregistré : contactez la base pour valider votre règlement avant signature.',
      );
    }

    const pdfDownloadUrl = this.contractPdfDownloadUrl(token);

    if (row.signedAt) {
      return {
        signed: true,
        contractNumber: row.contractNumber,
        alreadySigned: true,
        signedEmailSent: Boolean(row.contractSignedEmailSentAt),
        pdfDownloadUrl,
      };
    }

    const company = await this.companyRow();
    const operatorSignature = this.resolveOperatorSignature(row, company);
    if (!operatorSignature) {
      throw new BadRequestException(
        "Signature exploitant requise avant la signature client. Contactez la base nautique.",
      );
    }

    const existingMemberDocs: MemberDocumentUrls | null = reservation.clientMember
      ? {
          cniFrontUrl: reservation.clientMember.cniFrontUrl,
          cniBackUrl: reservation.clientMember.cniBackUrl,
          boatLicenseFrontUrl: reservation.clientMember.boatLicenseFrontUrl,
          boatLicenseBackUrl: reservation.clientMember.boatLicenseBackUrl,
          airbusBadgePhotoUrl: reservation.clientMember.airbusBadgePhotoUrl,
        }
      : null;

    const docs = await this.resolveSignDocumentUrls(body, existingMemberDocs);
    this.validateSignDocumentUrls(docs, requireAirbusBadge);
    await this.persistMemberDocuments(reservation, docs);

    const refreshed = await this.prisma.reservation.findUnique({
      where: { id: reservation.id },
      include: reservationInclude,
    });
    if (refreshed) row = { ...row, reservation: refreshed };

    const templateRow =
      row.contractTemplateId != null
        ? await this.prisma.contract.findUnique({ where: { id: row.contractTemplateId } })
        : await this.prisma.contract.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } });
    const template = this.templateForContract(templateRow);
    const requiredLabels = requireAirbusBadge
      ? Array.from(new Set([...template.requiredDocuments, 'Badge Airbus']))
      : template.requiredDocuments;
    const checklist = resolveContractDocumentChecklist({
      requiredLabels,
      detailsJson: row.reservation.detailsJson,
      member: docs,
    });
    const docsBlocked = this.ensureDocumentsProvidedForSignature(requiredLabels, checklist, {
      requireAirbusBadge,
    });
    if (docsBlocked) throw new BadRequestException(docsBlocked);

    const clientSignatureStored = await this.media.processOptionalImageUrl(body.clientSignature);
    if (!clientSignatureStored) {
      throw new BadRequestException('Signature client invalide.');
    }

    const signedAt = new Date();
    const vm = await this.buildViewModel(
      row.reservation,
      row,
      {
        clientSignature: clientSignatureStored,
        operatorSignature,
        signedAt,
      },
    );
    const signedHtml = buildRentalContractHtml(vm);
    const signedHtmlSha256 = hashSignedContractHtml(signedHtml);
    const snapshotReservation = await this.loadReservationForSnapshot(row.reservationId);
    const signedReservationSnapshotSha256 = snapshotReservation
      ? this.computeSnapshotSha256(snapshotReservation)
      : null;

    await this.prisma.reservationRentalContract.update({
      where: { id: row.id },
      data: {
        clientSignatureDataUrl: clientSignatureStored,
        operatorSignatureDataUrl: operatorSignature,
        signedAt,
        signedHtml,
        signedHtmlSha256,
        contractTemplateVersionAt: templateRow?.updatedAt ?? null,
        contractLocked: true,
        signedReservationSnapshotSha256,
      },
    });

    let signedEmailSent = false;
    try {
      const mailResult = await this.sendSignedContractEmail(row.reservationId);
      signedEmailSent = mailResult.sent;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Email contrat signé non envoyé (${row.reservationId}): ${msg}`);
    }

    try {
      await this.internalNotifications.createFromRentalContractSigned(row.reservationId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Notification interne contrat signé (${row.reservationId}): ${msg}`);
    }

    return {
      signed: true,
      contractNumber: row.contractNumber,
      alreadySigned: false,
      signedEmailSent,
      pdfDownloadUrl,
    };
  }

  async sendSignedContractEmail(reservationId: string, opts?: { force?: boolean }): Promise<{ sent: boolean }> {
    const row = await this.prisma.reservationRentalContract.findUnique({
      where: { reservationId },
      include: { reservation: { include: reservationInclude } },
    });
    if (!row?.signedAt || !row.signedHtml) {
      throw new BadRequestException('Aucun contrat signé pour cette réservation.');
    }
    assertSignedHtmlIntegrity(row.signedHtml, row.signedHtmlSha256);

    if (row.contractSignedEmailSentAt && !opts?.force) {
      return { sent: false };
    }

    const email = row.reservation.clientEmail?.trim();
    if (!email?.includes('@')) {
      throw new BadRequestException('Email client manquant.');
    }
    if (!this.mail.isConfigured()) {
      throw new BadRequestException('RESEND_API_KEY non configuré.');
    }

    const company = await this.companyRow();
    const brand = company?.brandName ?? DEFAULT_BRAND_NAME;
    const vm = await this.buildViewModel(row.reservation, row, {
      clientSignature: row.clientSignatureDataUrl ?? undefined,
      operatorSignature: row.operatorSignatureDataUrl ?? undefined,
      signedAt: row.signedAt,
    });
    const pdf = await this.htmlToPdf.fromHtml(row.signedHtml);
    const downloadUrl = this.contractPdfDownloadUrl(row.signToken);
    const emailSettings = await this.prisma.emailSettings.findUnique({ where: { id: 'email_settings' } });

    const templateData = {
      brandName: brand,
      clientFirstName: row.reservation.clientFirstName ?? '',
      contractNumber: row.contractNumber,
      boatName: row.reservation.boat.name,
      startLabel: vm.location.start,
      endLabel: vm.location.end,
      totalLabel: vm.pricingTotal.ttc,
      downloadUrl,
    };

    await this.mail.send({
      to: email,
      subject: `Votre contrat de location signé — n°${row.contractNumber}`,
      html: buildRentalContractSignedEmailHtml(templateData),
      text: buildRentalContractSignedEmailText(templateData),
      replyTo: emailSettings?.replyToEmail ?? company?.contactEmail ?? undefined,
      fromName: emailSettings?.fromName ?? brand,
      attachments: [
        {
          filename: `contrat-location-${row.contractNumber}.pdf`,
          content: pdf,
        },
      ],
    });

    await this.prisma.reservationRentalContract.update({
      where: { id: row.id },
      data: { contractSignedEmailSentAt: new Date() },
    });

    return { sent: true };
  }

  async getSignedPdfByToken(token: string): Promise<{ pdf: Buffer; contractNumber: number; filename: string }> {
    const row = await this.prisma.reservationRentalContract.findUnique({
      where: { signToken: token },
    });
    if (!row?.signedHtml || !row.signedAt) {
      throw new NotFoundException('Contrat signé introuvable.');
    }
    assertSignedHtmlIntegrity(row.signedHtml, row.signedHtmlSha256);
    const pdf = await this.htmlToPdf.fromHtml(row.signedHtml);
    return {
      pdf,
      contractNumber: row.contractNumber,
      filename: `contrat-location-${row.contractNumber}.pdf`,
    };
  }

  async getSignedHtmlForReservation(reservationId: string): Promise<{ html: string; contractNumber: number }> {
    const row = await this.prisma.reservationRentalContract.findUnique({
      where: { reservationId },
    });
    if (!row?.signedHtml || !row.signedAt) {
      throw new NotFoundException('Aucun contrat signé pour cette réservation.');
    }
    assertSignedHtmlIntegrity(row.signedHtml, row.signedHtmlSha256);
    return { html: row.signedHtml, contractNumber: row.contractNumber };
  }

  async getSignedPdfForReservation(reservationId: string): Promise<{ pdf: Buffer; contractNumber: number }> {
    const { html, contractNumber } = await this.getSignedHtmlForReservation(reservationId);
    const pdf = await this.htmlToPdf.fromHtml(html);
    return { pdf, contractNumber };
  }

  /**
   * PDF téléchargeable admin : version signée archivée si elle existe,
   * sinon brouillon régénéré à partir des données actuelles de la réservation.
   */
  async getContractPdfForReservation(reservationId: string): Promise<{
    pdf: Buffer;
    contractNumber: number;
    filename: string;
    kind: 'signed' | 'preview';
  }> {
    const row = await this.prisma.reservationRentalContract.findUnique({
      where: { reservationId },
    });
    if (row?.signedHtml && row.signedAt) {
      try {
        assertSignedHtmlIntegrity(row.signedHtml, row.signedHtmlSha256);
        const pdf = await this.htmlToPdf.fromHtml(row.signedHtml);
        return {
          pdf,
          contractNumber: row.contractNumber,
          filename: `contrat-location-${row.contractNumber}.pdf`,
          kind: 'signed',
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `PDF signé illisible pour ${reservationId}, repli sur brouillon : ${msg}`,
        );
      }
    }
    const preview = await this.getPreviewPdfForReservation(reservationId);
    return {
      pdf: preview.pdf,
      contractNumber: preview.contractNumber,
      filename: `contrat-location-${preview.contractNumber}.pdf`,
      kind: 'preview',
    };
  }

  /** Aperçu PDF brouillon à partir des données réelles de la réservation (non archivé). */
  async getPreviewPdfForReservation(
    reservationId: string,
  ): Promise<{ pdf: Buffer; filename: string; contractNumber: number }> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: reservationInclude,
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable.');

    const contract = await this.ensureForReservation(reservationId);
    const company = await this.companyRow();
    const operatorSignature = this.resolveOperatorSignature(contract, company);

    const vm = await this.buildViewModel(reservation, contract, {
      operatorSignature: operatorSignature ?? undefined,
    });
    const html = buildRentalContractHtml(vm, { draft: true });
    const pdf = await this.htmlToPdf.fromHtml(html);

    return {
      pdf,
      contractNumber: contract.contractNumber,
      filename: `apercu-contrat-${contract.contractNumber}.pdf`,
    };
  }

  /** Aperçu PDF brouillon d’un modèle (données fictives + CGV du modèle). */
  async getPreviewPdfForTemplate(
    contractTemplateId: string,
  ): Promise<{ pdf: Buffer; filename: string }> {
    const template = await this.prisma.contract.findUnique({ where: { id: contractTemplateId } });
    if (!template) throw new NotFoundException('Modèle de contrat introuvable.');

    const company = await this.companyRow();
    const vm = buildMockPreviewViewModel(company, {
      title: template.title,
      rentalTerms: template.rentalTerms,
      cancellationTerms: template.cancellationTerms,
      requiredDocuments: parseRequiredDocuments(template.requiredDocuments),
    });
    const html = buildRentalContractHtml(vm, { draft: true });
    const pdf = await this.htmlToPdf.fromHtml(html);
    const slug = template.name.replace(/[^\w.-]+/g, '-').slice(0, 40) || 'modele';

    return {
      pdf,
      filename: `apercu-${slug}.pdf`,
    };
  }

  async sendSignContractEmail(
    reservationId: string,
    opts?: { force?: boolean },
  ): Promise<{ sent: boolean; signUrl: string }> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { boat: true },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable.');
    const email = reservation.clientEmail?.trim();
    if (!email?.includes('@')) throw new BadRequestException('Email client manquant.');

    const contract = await this.ensureForReservation(reservationId);
    const signUrl = this.signUrl(contract.signToken);
    if (contract.signedAt) {
      return { sent: false, signUrl };
    }
    if (!isReservationPaidForContract(reservation)) {
      throw new BadRequestException(
        'Envoi du contrat impossible : le paiement doit être confirmé avant la signature.',
      );
    }
    if (contract.contractSignEmailSentAt && !opts?.force) {
      return { sent: false, signUrl };
    }

    const company = await this.prisma.companySettings.findUnique({ where: { id: 'company_settings' } });
    const brand = company?.brandName ?? DEFAULT_BRAND_NAME;

    if (!this.mail.isConfigured()) {
      throw new BadRequestException('RESEND_API_KEY non configuré.');
    }

    await this.mail.send({
      to: email,
      subject: `Signature du contrat de location — ${reservation.boat.name}`,
      html: `<p>Bonjour ${reservation.clientFirstName ?? ''} ${reservation.clientLastName ?? ''},</p>
        <p>Merci pour votre paiement. Pour finaliser votre dossier, veuillez signer votre contrat de location :</p>
        <p><a href="${signUrl}" style="display:inline-block;background:#416B9F;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Signer le contrat</a></p>
        <p style="color:#64748b;font-size:13px;">Contrat n°${contract.contractNumber}</p>
        <p>${brand}</p>`,
      text: `Signez votre contrat : ${signUrl}`,
      fromName: brand,
    });

    await this.prisma.reservationRentalContract.update({
      where: { id: contract.id },
      data: { contractSignEmailSentAt: new Date() },
    });

    return { sent: true, signUrl };
  }

  private formatDt(d: Date) {
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private euros(cents: number | null | undefined) {
    if (cents == null) return '—';
    return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
  }

  private formatEurosSigned(ttc: number): string {
    const abs = Math.abs(ttc);
    const formatted = `${abs.toFixed(2).replace('.', ',')} €`;
    return ttc < -0.005 ? `−${formatted}` : formatted;
  }

  private vatFromTtc(ttc: number, rate = 20) {
    const ht = ttc / (1 + rate / 100);
    const vat = ttc - ht;
    return { ht, vat, ttc };
  }

  private parseReservationDetails(json: string | null) {
    if (!json) return null;
    try {
      return JSON.parse(json) as {
        clientFirstName?: string;
        clientLastName?: string;
        civility?: string;
      };
    } catch {
      return null;
    }
  }

  private parseInstallmentMethodsFromDetails(json: string | null) {
    if (!json) return null;
    try {
      const parsed = JSON.parse(json) as { installmentMethods?: unknown };
      if (!Array.isArray(parsed.installmentMethods)) return null;
      const methods = parsed.installmentMethods.filter(isPaymentMethod);
      return methods.length > 0 ? methods : null;
    } catch {
      return null;
    }
  }

  private templateForContract(templateRow: {
    title: string;
    rentalTerms: string;
    cancellationTerms: string;
    requiredDocuments: string;
  } | null) {
    if (!templateRow) {
      return {
        title: 'Contrat de location',
        rentalTerms: '',
        cancellationTerms: '',
        requiredDocuments: [] as string[],
      };
    }
    return {
      title: templateRow.title,
      rentalTerms: templateRow.rentalTerms,
      cancellationTerms: templateRow.cancellationTerms,
      requiredDocuments: parseRequiredDocuments(templateRow.requiredDocuments),
    };
  }

  /** Format contractuel : « Prénom NOM » (nom de famille en majuscules). */
  private formatContractPartyName(first?: string | null, last?: string | null): string {
    const f = (first ?? '').trim();
    const l = (last ?? '').trim();
    if (!f && !l) return '';
    if (!f) return l.toUpperCase();
    if (!l) return f;
    return `${f} ${l.toUpperCase()}`;
  }

  private resolveLocataireName(
    r: Pick<ReservationFull, 'clientFirstName' | 'clientLastName' | 'detailsJson' | 'civility'>,
  ): string {
    const details = this.parseReservationDetails(r.detailsJson);
    const name = this.formatContractPartyName(
      r.clientFirstName ?? details?.clientFirstName,
      r.clientLastName ?? details?.clientLastName,
    );
    if (!name) return '—';
    const civ = (r.civility ?? details?.civility ?? '').trim();
    return civ ? `${civ} ${name}` : name;
  }

  private async buildViewModel(
    r: ReservationFull,
    contract: {
      contractNumber: number;
      contractTemplateId: string | null;
      operatorSignatureDataUrl?: string | null;
    },
    signatures?: { clientSignature?: string; operatorSignature?: string; signedAt?: Date },
  ): Promise<RentalContractViewModel> {
    const [company, booking] = await Promise.all([
      this.prisma.companySettings.findUnique({ where: { id: 'company_settings' } }),
      this.prisma.bookingSettings.findUnique({ where: { id: 'booking_settings' } }),
    ]);
    const { departure: departurePlace, arrival: arrivalPlace } = resolveRentalLocations({ company, booking });
    const templateRow =
      contract.contractTemplateId != null
        ? await this.prisma.contract.findUnique({ where: { id: contract.contractTemplateId } })
        : await this.prisma.contract.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } });

    const contractFields = parseReservationContractFields(r.detailsJson);
    const details = r.detailsJson ? (JSON.parse(r.detailsJson) as { settlementNote?: string }) : {};
    const boatDetails = parseBoatDetailsJson(r.boat.detailsJson);
    const member = r.clientMember;
    const identity = resolveIdentityForContract(contractFields, member);
    const license = resolveLicenseForContract(contractFields, member, r.clientCountry);
    const passengers = buildPassengerSummary({
      passengerCount: r.passengerCount,
      hasChildren: r.hasChildren,
      childrenCount: r.childrenCount,
    });
    const owner = r.boat.ownerMember;
    const ownerNameFormatted = owner
      ? this.formatContractPartyName(owner.firstName, owner.lastName)
      : '';
    const ownerName = ownerNameFormatted || '—';
    const locataireName = this.resolveLocataireName(r);
    const conducteurName = this.formatContractPartyName(
      r.clientFirstName ?? this.parseReservationDetails(r.detailsJson)?.clientFirstName,
      r.clientLastName ?? this.parseReservationDetails(r.detailsJson)?.clientLastName,
    );
    const conducteurDisplay = conducteurName
      ? (() => {
          const civ = (r.civility ?? this.parseReservationDetails(r.detailsJson)?.civility ?? '').trim();
          return civ ? `${civ} ${conducteurName}` : conducteurName;
        })()
      : '—';
    const template = this.templateForContract(templateRow);
    const requireAirbusBadge = this.shouldRequireAirbusBadge(r);
    const requiredLabels = requireAirbusBadge
      ? Array.from(new Set([...template.requiredDocuments, 'Badge Airbus']))
      : template.requiredDocuments;
    const documentChecklist = resolveContractDocumentChecklist({
      requiredLabels,
      detailsJson: r.detailsJson,
      member: r.clientMember,
    });

    const rentalCents = r.rentalPriceCents ?? 0;
    const rental = this.vatFromTtc(rentalCents / 100);
    const pricingLines: RentalContractViewModel['pricingLines'] = [
      {
        description: `Location ${r.boat.name}`,
        ht: `${rental.ht.toFixed(2).replace('.', ',')} €`,
        vatPct: '20 %',
        vat: `${rental.vat.toFixed(2).replace('.', ',')} €`,
        ttc: `${rental.ttc.toFixed(2).replace('.', ',')} €`,
      },
    ];

    const rentalDays = rentalDaysBetween(r.startAt, r.endAt);
    let extrasTotal = 0;
    for (const line of r.extras) {
      const cents = computeExtraLineCents(
        rentalCents,
        {
          quantity: line.quantity,
          extra: {
            priceKind: line.extra.priceKind,
            priceValue: line.extra.priceValue,
            billingUnit: line.extra.billingUnit,
          },
        },
        rentalDays,
      );
      extrasTotal += cents;
      if (cents > 0) {
        const ex = this.vatFromTtc(cents / 100, line.extra.vatRate ?? 20);
        pricingLines.push({
          description: extraDocumentLabel(line.extra.name, line.extra.paymentChannel),
          ht: `${ex.ht.toFixed(2).replace('.', ',')} €`,
          vatPct: `${line.extra.vatRate ?? 20} %`,
          vat: `${ex.vat.toFixed(2).replace('.', ',')} €`,
          ttc: `${ex.ttc.toFixed(2).replace('.', ',')} €`,
        });
      }
    }

    let subtotalCents = rentalCents + extrasTotal;
    if (r.discountPercent && r.discountPercent > 0) {
      const manualDiscCents = Math.round((subtotalCents * r.discountPercent) / 100);
      subtotalCents -= manualDiscCents;
      const manualDisc = this.vatFromTtc(manualDiscCents / 100);
      pricingLines.push({
        description: `Remise manuelle ${r.discountPercent} %`,
        ht: this.formatEurosSigned(-manualDisc.ht),
        vatPct: '20 %',
        vat: this.formatEurosSigned(-manualDisc.vat),
        ttc: this.formatEurosSigned(-manualDisc.ttc),
      });
    }

    const { pricing: priced, coupon: effectiveCoupon } = await computeReservationGrandTotalCents(
      this.prisma,
      reservationPricingInputFromRow(r, mapReservationExtrasForPricing(r.extras)),
    );
    const recordedCredit = await this.memberCredits.appliedCentsForReservation(r.id);
    const storeCreditCents = resolveStoreCreditAppliedCents(
      priced.payableOnlineCents,
      r.totalDueCents,
      recordedCredit,
    );
    const netPayableOnlineCents = Math.max(0, priced.payableOnlineCents - storeCreditCents);
    const totalCents = Math.max(0, priced.grandTotalCents - storeCreditCents);

    if (r.couponCode?.trim() && priced.couponDiscountOnRentalCents > 0) {
      const code = r.couponCode.trim();
      let couponDetail = '';
      if (effectiveCoupon) {
        const kindLabel =
          effectiveCoupon.discountKind === CouponDiscountKind.PERCENT
            ? `−${effectiveCoupon.discountValue} %`
            : `−${effectiveCoupon.discountValue.toFixed(2).replace('.', ',')} €`;
        couponDetail = ` (${kindLabel})`;
        if (effectiveCoupon.tier === 'degraded') {
          couponDetail += ' · palier réduit';
        }
      }
      const couponDisc = this.vatFromTtc(priced.couponDiscountOnRentalCents / 100);
      pricingLines.push({
        description: `Coupon ${code}${couponDetail} · sur location uniquement`,
        ht: this.formatEurosSigned(-couponDisc.ht),
        vatPct: '20 %',
        vat: this.formatEurosSigned(-couponDisc.vat),
        ttc: this.formatEurosSigned(-couponDisc.ttc),
      });
    }

    if (storeCreditCents > 0) {
      const credit = this.vatFromTtc(storeCreditCents / 100);
      pricingLines.push({
        description: 'Avoir client',
        ht: this.formatEurosSigned(-credit.ht),
        vatPct: '20 %',
        vat: this.formatEurosSigned(-credit.vat),
        ttc: this.formatEurosSigned(-credit.ttc),
      });
    }

    const total = this.vatFromTtc(totalCents / 100);
    let sumHt = 0;
    let sumVat = 0;
    for (const line of pricingLines) {
      const parseSigned = (s: string) => {
        const neg = s.includes('−') || s.startsWith('-');
        const n = Number.parseFloat(s.replace(/[^\d,]/g, '').replace(',', '.'));
        if (!Number.isFinite(n)) return 0;
        return neg ? -n : n;
      };
      sumHt += parseSigned(line.ht);
      sumVat += parseSigned(line.vat);
    }

    const detailsMethods = this.parseInstallmentMethodsFromDetails(r.detailsJson);
    const paymentDocInput = {
      paymentChannel: r.paymentChannel,
      paymentCapturedAt: r.paymentCapturedAt,
      settlementNote: details.settlementNote ?? r.settlementNote,
      totalDueCents: netPayableOnlineCents,
      storeCreditAppliedCents: storeCreditCents,
      installmentPlan: r.installmentPlan.map((p) => ({
        sequence: p.sequence,
        label: p.label,
        amountCents: p.amountCents,
        method: p.method,
        status: p.status,
        paidAt: p.paidAt,
      })),
      fallbackMethod: detailsMethods?.[0] ?? null,
    };
    const payments: RentalContractViewModel['payments'] = buildDocumentPaymentLines(paymentDocInput).map(
      (line) => ({
        date: line.paidAt ? this.formatDt(line.paidAt) : '—',
        method: line.methodLabel,
        amount: this.euros(line.amountCents),
      }),
    );
    const paymentObligations: RentalContractViewModel['paymentObligations'] =
      buildDocumentPaymentObligations(paymentDocInput).map((o) => ({
        label: o.label,
        methodLabel: o.methodLabel,
        amount: this.euros(o.amountCents),
        paid: o.paid,
      }));

    const balance = documentPaymentBalanceCents(paymentDocInput, priced.grandTotalCents);

    const addressParts = [r.clientAddress, r.clientPostalCode, r.clientCity, r.clientCountry].filter(Boolean);

    return {
      contractNumber: contract.contractNumber,
      company: {
        brandName: company?.brandName ?? DEFAULT_BRAND_NAME,
        legalName: company?.legalName ?? company?.brandName ?? DEFAULT_BRAND_NAME,
        siret: company?.siret ?? '',
        contactPhone: company?.contactPhone ?? '',
        addressLine: company?.addressLine ?? '',
        postalCode: company?.postalCode ?? '',
        city: company?.city ?? '',
        country: company?.country ?? 'FRANCE',
      },
      template,
      documentTitle: template.title,
      introLegalName: company?.legalName ?? company?.brandName ?? DEFAULT_BRAND_NAME,
      locataire: {
        name: locataireName,
        address: addressParts.join(', ') || '—',
        birthDate: r.clientBirthDate ? this.formatDt(r.clientBirthDate).slice(0, 10) : '—',
        phone: r.clientPhone ?? '—',
        email: r.clientEmail ?? '—',
        idType: identity.idType,
        idNumber: identity.idNumber,
      },
      conducteur: {
        name: conducteurDisplay === '—' ? contractDisplayOrNotSet(null) : conducteurDisplay,
        licenseType: license.licenseType,
        licenseNumber: license.licenseNumber,
        licenseCountry: license.licenseCountry,
        licenseYear: contractDisplayOrNotSet(contractFields.licenseYear),
      },
      bateau: {
        name: r.boat.name,
        registration: contractDisplayOrNotSet(
          boatDetails?.registrationNormalized ?? boatDetails?.registrationNumber,
        ),
        maxPassengers: r.boat.maxPassengers,
        yearBuilt: contractDisplayOrNotSet(boatDetails?.constructionYear),
        renovationYear: contractDisplayOrNotSet(boatDetails?.renovationYear),
        armement: contractDisplayOrNotSet(boatDetails?.armementLabel),
        authorizedNavigationZone: contractDisplayOrNotSet(boatDetails?.authorizedNavigationZone),
        safetyEquipment: contractDisplayOrNotSet(boatDetails?.safetyEquipmentLabel),
        brandModel: `${r.boat.brand} ${r.boat.model}`.trim() || '—',
        deposit: this.euros(r.depositAmountCents ?? r.boat.depositAmountCents),
        depositMode:
          r.paymentChannel === PaymentChannel.ONLINE ? 'Empreinte carte (en ligne)' : 'Paiement hors ligne',
        ownerName: ownerName === '—' ? contractDisplayOrNotSet(null) : ownerName,
        insuranceCompany: contractDisplayOrNotSet(boatDetails?.insuranceCompany),
        insurancePolicyNumber: contractDisplayOrNotSet(boatDetails?.insurancePolicyNumber),
        insurance: boatDetails?.assuranceSummary ?? contractDisplayOrNotSet(null),
      },
      documentChecklist,
      location: {
        departurePlace,
        arrivalPlace,
        startAt: this.formatDt(r.startAt),
        endAt: this.formatDt(r.endAt),
        start: `${this.formatDt(r.startAt)} — ${departurePlace}`,
        end: `${this.formatDt(r.endAt)} — ${arrivalPlace}`,
        type: 'Bateau seul',
        priceWithoutExtras: this.euros(r.rentalPriceCents),
        comment: (details.settlementNote ?? '').trim(),
        passengers: passengers.label,
      },
      pricingLines,
      pricingTotal: {
        description: 'Total TTC après remises',
        ht: `${sumHt.toFixed(2).replace('.', ',')} €`,
        vatPct: '',
        vat: `${sumVat.toFixed(2).replace('.', ',')} €`,
        ttc: `${total.ttc.toFixed(2).replace('.', ',')} €`,
      },
      payments,
      paymentObligations,
      balanceDue: this.euros(balance),
      clientSignatureImg: signatures?.clientSignature ?? null,
      operatorSignatureImg:
        signatures?.operatorSignature ??
        contract.operatorSignatureDataUrl ??
        company?.contractOperatorSignatureDataUrl ??
        null,
      signedAtLabel: signatures?.signedAt ? this.formatDt(signatures.signedAt) : null,
      operatorSignedAtLabel: signatures?.signedAt ? this.formatDt(signatures.signedAt) : null,
    };
  }
}
