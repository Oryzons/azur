import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Civility,
  ClientType,
  ExtraBillingUnit,
  ExtraPriceKind,
  PaymentChannel,
  ReservationRefund,
  ReservationStatus,
} from '@prisma/client';
import {
  UserRole,
  type AuthUser,
  cancelReservationSchema,
  createReservationRefundSchema,
  type CreateReservationRefundInput,
  reservationResolutionSchema,
  type ReservationResolutionInput,
} from '@bleu-calanque/shared';
import { OwnerScopeService } from '../common/auth/owner-scope.service';
import { InternalNotificationsService } from '../internal-notifications/internal-notifications.service';
import { ReservationNotificationsService } from '../notifications/reservation-notifications.service';
import {
  isReservationLocked,
  type ReservationLockContext,
  type UpsertReservationInput,
  normalizeAirbusBadge,
  upsertReservationSchema,
} from '@bleu-calanque/shared';
import { couponRequiresAirbusBadge } from '../coupons/airbus-coupon.util';
import { EntityChecksService } from '../common/validation/entity-checks';
import { validateInput } from '../common/validation/validate-input';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuditAction, AuditEntity } from '../common/audit/audit.constants';
import { refundsAuditSnapshot, reservationAuditSnapshot } from '../common/audit/audit-snapshots';
import type { UpsertReservationDto } from './reservations.dto';
import { computeReservationTotalDueCents } from '../pricing/reservation-pricing';
import { mapReservationExtrasForPricing } from '../pricing/reservation-pricing-map';
import { computeBoatSlotCatalogEuros } from '../pricing/catalog-location-pricing';
import { CouponsService } from '../coupons/coupons.service';
import { MemberCreditsService } from '../member-credits/member-credits.service';
import { RentalContractsService } from '../rental-contracts/rental-contracts.service';

function parseDateOrNull(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entities: EntityChecksService,
    private readonly audit: AuditService,
    private readonly notifications: ReservationNotificationsService,
    private readonly internalNotifications: InternalNotificationsService,
    private readonly ownerScope: OwnerScopeService,
    private readonly coupons: CouponsService,
    private readonly memberCredits: MemberCreditsService,
    private readonly rentalContracts: RentalContractsService,
  ) {}

  private readonly reservationInclude = {
    boat: true,
    refunds: { orderBy: { refundedAt: 'asc' as const } },
    checkFlowSubmissions: { select: { kind: true } },
    rentalContract: {
      select: {
        signedAt: true,
        contractSignEmailSentAt: true,
        contractSignedEmailSentAt: true,
        signedReservationSnapshotSha256: true,
        contractLocked: true,
      },
    },
  } as const;

  private lockContextFromReservation(row: {
    endAt: Date;
    paymentCapturedAt: Date | null;
    status: ReservationStatus;
    checkFlowSubmissions?: { kind: string }[];
  }): ReservationLockContext {
    const subs = row.checkFlowSubmissions ?? [];
    return {
      endAt: row.endAt,
      paymentCapturedAt: row.paymentCapturedAt,
      status: row.status,
      checkInDone: subs.some((s) => s.kind === 'CHECK_IN'),
      checkOutDone: subs.some((s) => s.kind === 'CHECK_OUT'),
    };
  }

  private async assertReservationEditable(id: string): Promise<void> {
    const row = await this.prisma.reservation.findUnique({
      where: { id },
      select: {
        endAt: true,
        paymentCapturedAt: true,
        status: true,
        checkFlowSubmissions: { select: { kind: true } },
      },
    });
    if (!row) throw new NotFoundException('Réservation introuvable.');
    if (isReservationLocked(this.lockContextFromReservation(row))) {
      throw new BadRequestException(
        'Cette réservation est clôturée (payée, terminée, check-in et check-out effectués) et ne peut plus être modifiée.',
      );
    }
  }

  private mapReservationForApi<T extends Record<string, unknown>>(row: T): T {
    const contract = row.rentalContract as
      | {
          signedAt: Date | null;
          contractSignEmailSentAt: Date | null;
          contractSignedEmailSentAt: Date | null;
          signedReservationSnapshotSha256: string | null;
          contractLocked: boolean;
          status?: unknown;
        }
      | null
      | undefined;
    if (!contract || contract.status) return row;
    const extras = Array.isArray(row.extras)
      ? (row.extras as { extraId: string; quantity: number }[])
          .map((e) => ({ extraId: e.extraId, quantity: e.quantity }))
          .sort((a, b) => a.extraId.localeCompare(b.extraId))
      : [];
    const boat = row.boat as { id: string; name: string; detailsJson: string | null } | undefined;
    const snapshotRow = {
      ...(row as object),
      extras,
      boat: boat ?? { id: String(row.boatId ?? ''), name: '', detailsJson: null },
    };
    const dataStale = this.rentalContracts.contractDataStaleForReservation(
      snapshotRow as import('../rental-contracts/rental-contract-snapshot').ReservationContractSnapshotSource,
      contract,
    );
    const meta = this.rentalContracts.buildAdminContractMeta(
      {
        paymentCapturedAt: row.paymentCapturedAt as Date | null,
        status: row.status as import('@prisma/client').ReservationStatus,
      },
      contract,
      { dataStale },
    );
    return {
      ...row,
      rentalContract: {
        signedAt: contract.signedAt,
        contractSignEmailSentAt: contract.contractSignEmailSentAt,
        contractSignedEmailSentAt: contract.contractSignedEmailSentAt,
        contractLocked: contract.contractLocked,
        signed: meta.signed,
        contractDataStale: meta.contractDataStale,
        status: meta.status,
      },
    } as T;
  }

  async list(user: AuthUser) {
    const where =
      user.role === UserRole.OWNER
        ? { boat: { ownerMemberId: await this.ownerScope.requireOwnerMemberId(user) } }
        : {};
    const rows = await this.prisma.reservation.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: {
        extras: { select: { extraId: true, quantity: true }, orderBy: { extraId: 'asc' } },
        boat: { select: { id: true, name: true, detailsJson: true } },
        refunds: { orderBy: { refundedAt: 'asc' } },
        checkFlowSubmissions: { select: { kind: true } },
        rentalContract: {
          select: {
            signedAt: true,
            contractSignEmailSentAt: true,
            contractSignedEmailSentAt: true,
            signedReservationSnapshotSha256: true,
            contractLocked: true,
          },
        },
      },
    });
    return rows.map((row) => this.mapReservationForApi(row));
  }

  private parseBody(raw: UpsertReservationDto): UpsertReservationInput {
    return validateInput(upsertReservationSchema, raw);
  }

  private async assertRelations(input: UpsertReservationInput): Promise<void> {
    await this.entities.assertBoatExists(input.boatId);
    if (input.clientMemberId) {
      await this.entities.assertMemberExists(input.clientMemberId);
    }
    const extraIds = (input.extras ?? []).map((e) => e.extraId);
    await this.entities.assertExtrasExist(extraIds);
    await this.entities.assertCouponCodeValid(input.couponCode);
    await this.assertAirbusBadgeIfRequired(input);
  }

  private async assertAirbusBadgeIfRequired(input: UpsertReservationInput): Promise<void> {
    const code = input.couponCode?.replaceAll(/\s+/g, '').toUpperCase() || '';
    if (!code) return;
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon || !couponRequiresAirbusBadge(coupon)) return;
    const badge = normalizeAirbusBadge(input.airbusBadge);
    if (!badge) {
      throw new BadRequestException('Le numéro de badge Airbus est requis pour ce coupon.');
    }
  }

  private async resolveAirbusBadgeForSave(input: UpsertReservationInput): Promise<string | null> {
    const code = input.couponCode?.replaceAll(/\s+/g, '').toUpperCase() || '';
    if (!code) return null;
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon || !couponRequiresAirbusBadge(coupon)) return null;
    return normalizeAirbusBadge(input.airbusBadge);
  }

  private async syncMemberAirbusBadge(memberId: string | null | undefined, badge: string | null): Promise<void> {
    if (!memberId?.trim() || !badge) return;
    await this.prisma.member.update({
      where: { id: memberId },
      data: { airbusBadge: badge },
    });
  }

  private buildReservationData(
    input: UpsertReservationInput,
    existingStatus?: ReservationStatus,
    airbusBadge?: string | null,
  ) {
    const start = parseDateOrNull(input.start);
    const end = parseDateOrNull(input.end);
    if (!start || !end) throw new BadRequestException('Dates start/end invalides.');

    return {
      boatId: input.boatId,
      title: input.title,
      startAt: start,
      endAt: end,
      color: input.color ?? null,
      detailsJson: input.detailsJson ?? null,
      clientMemberId: input.clientMemberId ?? null,
      clientType: (input.clientType ?? null) as ClientType | null,
      civility: (input.civility ?? null) as Civility | null,
      clientEmail: input.clientEmail?.trim().toLowerCase() || null,
      clientFirstName: input.clientFirstName ?? null,
      clientLastName: input.clientLastName ?? null,
      clientPhone: input.clientPhone ?? null,
      clientBirthDate: parseDateOrNull(input.clientBirthDate ?? null),
      clientAddress: input.clientAddress ?? null,
      clientPostalCode: input.clientPostalCode ?? null,
      clientCity: input.clientCity ?? null,
      clientCountry: input.clientCountry ?? null,
      passengerCount: input.passengerCount ?? null,
      hasChildren: Boolean(input.hasChildren ?? false),
      childrenCount: input.childrenCount ?? null,
      internalNote: input.internalNote ?? null,
      paymentChannel: (input.paymentChannel ?? 'ONLINE') as PaymentChannel,
      rentalPriceCents: input.rentalPriceCents ?? null,
      depositAmountCents: input.depositAmountCents ?? null,
      discountPercent: input.discountPercent ?? null,
      couponCode: input.couponCode?.replaceAll(/\s+/g, '').toUpperCase() || null,
      airbusBadge: airbusBadge ?? null,
      installments: input.installments ?? null,
      settlementNote: input.settlementNote ?? null,
      paymentCapturedAt: parseDateOrNull(input.paymentCapturedAt ?? null),
      depositCapturedAt: parseDateOrNull(input.depositCapturedAt ?? null),
      confirmationEmailSentAt: parseDateOrNull(input.confirmationEmailSentAt ?? null),
      totalDueCents: input.totalDueCents ?? null,
      cancelledAt: parseDateOrNull(input.cancelledAt ?? null),
      status: (input.status ?? existingStatus ?? 'PENDING_PAYMENT') as ReservationStatus,
    };
  }

  async create(raw: UpsertReservationDto) {
    const input = this.parseBody(raw);
    await this.assertRelations(input);
    const airbusBadge = await this.resolveAirbusBadgeForSave(input);
    const data = this.buildReservationData(input, undefined, airbusBadge);

    const created = await this.prisma.reservation.create({ data });
    await this.syncMemberAirbusBadge(input.clientMemberId, airbusBadge);

    if (input.extras?.length) {
      await this.prisma.reservationExtra.createMany({
        data: input.extras.map((x) => ({
          reservationId: created.id,
          extraId: x.extraId,
          quantity: x.quantity ?? 1,
        })),
      });
    }

    if (input.refunds?.length) {
      await this.prisma.reservationRefund.createMany({
        data: input.refunds.map((r) => ({
          reservationId: created.id,
          amountCents: Math.round(r.amount * 100),
          note: r.note ?? null,
          refundedAt: parseDateOrNull(r.at ?? null) ?? new Date(),
        })),
      });
    }

    let full = await this.prisma.reservation.findUnique({
      where: { id: created.id },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });

    if (full) {
      full = await this.syncComputedTotalDueCents(full);
      await this.coupons.recordRedemptionForReservation({
        couponCode: full.couponCode,
        clientMemberId: full.clientMemberId,
        clientEmail: full.clientEmail,
        startAt: full.startAt,
      });
      await this.internalNotifications.emitReservationChangeNotifications(null, full);
      await this.audit.logCreate(AuditEntity.RESERVATION, full.id, reservationAuditSnapshot(full));
      if (full.refunds.length) {
        await this.audit.log({
          action: AuditAction.REFUND,
          entity: AuditEntity.RESERVATION,
          entityId: full.id,
          newData: { refunds: refundsAuditSnapshot(full.refunds) },
        });
      }
    }

    return this.maybeSendConfirmationAndRefetch(full);
  }

  async sendConfirmationEmail(id: string) {
    await this.assertReservationEditable(id);
    let existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });
    if (!existing) throw new NotFoundException('Réservation introuvable.');
    if (!existing.paymentCapturedAt) {
      existing = await this.syncComputedTotalDueCents(existing);
    }
    await this.notifications.sendConfirmationEmail(id);
    return this.prisma.reservation.findUnique({
      where: { id },
      include: { extras: true, refunds: { orderBy: { refundedAt: 'asc' } } },
    });
  }

  async sendContractEmail(id: string) {
    await this.assertReservationEditable(id);
    const existing = await this.prisma.reservation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Réservation introuvable.');
    const result = await this.notifications.trySendContractSignEmail(id, { force: true });
    if (!result.sent) {
      const contract = await this.prisma.reservationRentalContract.findUnique({ where: { reservationId: id } });
      if (contract?.signedAt) {
        throw new BadRequestException('Le contrat est déjà signé.');
      }
      if (!existing.paymentCapturedAt && existing.status !== 'RESERVED_PAID') {
        throw new BadRequestException(
          'Paiement non confirmé : le mail de signature n’est envoyé qu’après encaissement (ou sync. Stripe).',
        );
      }
      throw new BadRequestException('Impossible d’envoyer l’email de signature (email client ou Resend).');
    }
    return { sent: true };
  }

  /** Vérifie côté Stripe toutes les résas en attente de paiement (sans webhook). */
  async syncPendingStripePayments(): Promise<{ synced: string[] }> {
    if (!this.notifications.isStripeConfigured()) {
      return { synced: [] };
    }
    const pending = await this.prisma.reservation.findMany({
      where: {
        status: 'PENDING_PAYMENT',
        paymentChannel: 'ONLINE',
        stripeCheckoutSessionId: { not: null },
      },
      select: { id: true, stripeCheckoutSessionId: true },
    });
    const synced: string[] = [];
    for (const row of pending) {
      if (!row.stripeCheckoutSessionId) continue;
      try {
        const ok = await this.notifications.confirmPaymentFromCheckoutSession(row.stripeCheckoutSessionId);
        if (ok) synced.push(row.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur inconnue';
        this.logger.warn(`Sync Stripe échouée (${row.id}): ${msg}`);
      }
    }
    return { synced };
  }

  /** Rattrapage si le webhook Stripe n’a pas été reçu (ex. dev local sans `stripe listen`). */
  private parseRefundBody(raw: unknown): CreateReservationRefundInput {
    return validateInput(createReservationRefundSchema, raw);
  }

  private refundableCapCents(reservation: {
    totalDueCents: number | null;
    rentalPriceCents: number | null;
  }): number {
    return reservation.totalDueCents ?? reservation.rentalPriceCents ?? 0;
  }

  private computeRefundStatus(
    reservation: { totalDueCents: number | null; rentalPriceCents: number | null },
    refunds: Pick<ReservationRefund, 'amountCents'>[],
  ): ReservationStatus {
    const totalRefunded = refunds.reduce((sum, r) => sum + r.amountCents, 0);
    const cap = this.refundableCapCents(reservation);
    if (cap > 0 && totalRefunded >= cap - 1) return 'REFUNDED';
    return 'PARTIALLY_REFUNDED';
  }

  private async syncComputedTotalDueCents<
    T extends {
      id: string;
      rentalPriceCents: number | null;
      discountPercent: number | null;
      couponCode: string | null;
      clientMemberId: string | null;
      clientEmail: string | null;
      startAt: Date;
      endAt: Date;
      paymentCapturedAt: Date | null;
      totalDueCents: number | null;
      extras: {
        quantity: number;
        extra: { priceKind: ExtraPriceKind; priceValue: number; billingUnit: ExtraBillingUnit };
      }[];
    },
  >(reservation: T) {
    if (reservation.paymentCapturedAt) return reservation;

    const computed = await computeReservationTotalDueCents(this.prisma, {
      rentalPriceCents: reservation.rentalPriceCents,
      discountPercent: reservation.discountPercent,
      couponCode: reservation.couponCode,
      clientMemberId: reservation.clientMemberId,
      clientEmail: reservation.clientEmail,
      startAt: reservation.startAt,
      endAt: reservation.endAt,
      extras: mapReservationExtrasForPricing(reservation.extras),
    });

    const grossCents = computed;
    if (grossCents <= 0) {
      return this.prisma.reservation.update({
        where: { id: reservation.id },
        data: { totalDueCents: 0 },
        include: { extras: { include: { extra: true } }, ...this.reservationInclude },
      });
    }

    const alreadyApplied = await this.memberCredits.appliedCentsForReservation(reservation.id);
    const creditsAvailable = await this.memberCredits.availableCreditsCents(
      reservation.clientMemberId,
      reservation.clientEmail,
    );
    const additionalToApply = Math.min(
      creditsAvailable,
      Math.max(0, grossCents - alreadyApplied),
    );

    if (additionalToApply > 0) {
      await this.memberCredits.applyCreditsToReservation({
        reservationId: reservation.id,
        memberId: reservation.clientMemberId,
        clientEmail: reservation.clientEmail,
        maxCents: additionalToApply,
      });
    }

    const finalTotal = Math.max(0, grossCents - alreadyApplied - additionalToApply);
    const stored = reservation.totalDueCents;
    const creditUsed = alreadyApplied + additionalToApply;

    if (stored === finalTotal && additionalToApply === 0) return reservation;

    const data: {
      totalDueCents: number;
      paymentCapturedAt?: Date;
      status?: 'RESERVED_PAID';
    } = { totalDueCents: finalTotal };

    if (finalTotal < 50 && creditUsed > 0 && !reservation.paymentCapturedAt) {
      data.paymentCapturedAt = new Date();
      data.status = 'RESERVED_PAID';
    }

    return this.prisma.reservation.update({
      where: { id: reservation.id },
      data,
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });
  }

  private adminStatusFromPrisma(status: ReservationStatus): string {
    const map: Record<ReservationStatus, string> = {
      PENDING_PAYMENT: 'pending_payment',
      RESERVED_PAID: 'reserved_paid',
      CANCELLED: 'cancelled',
      REFUNDED: 'refunded',
      PARTIALLY_REFUNDED: 'partially_refunded',
    };
    return map[status] ?? 'pending_payment';
  }

  private buildDetailsJsonWithRefunds(
    detailsJson: string | null,
    refunds: ReservationRefund[],
    status: ReservationStatus,
  ): string | null {
    let details: Record<string, unknown> = {};
    if (detailsJson?.trim()) {
      try {
        const parsed = JSON.parse(detailsJson) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') details = parsed;
      } catch {
        details = {};
      }
    }
    details.refunds = refunds.map((r) => ({
      id: r.id,
      amount: Math.round(r.amountCents) / 100,
      at: r.refundedAt.toISOString(),
      ...(r.note ? { note: r.note } : {}),
    }));
    details.status = this.adminStatusFromPrisma(status);
    return JSON.stringify(details);
  }

  /** Remboursement client (Stripe si paiement en ligne) + enregistrement BDD + notification interne. */
  async issueRefund(id: string, raw: unknown) {
    const input = this.parseRefundBody(raw);
    const amountCents = Math.round(input.amount * 100);
    if (amountCents < 1) throw new BadRequestException('Montant invalide.');

    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: this.reservationInclude,
    });
    if (!existing) throw new NotFoundException('Réservation introuvable.');

    const paidOnline =
      existing.paymentChannel === PaymentChannel.ONLINE && existing.paymentCapturedAt != null;

    let capCents = this.refundableCapCents(existing);
    if (paidOnline && existing.stripeCheckoutSessionId && this.notifications.isStripeConfigured()) {
      const stripeRemaining = await this.notifications.getStripeRefundableCents(
        existing.stripeCheckoutSessionId,
      );
      if (stripeRemaining != null) {
        capCents = capCents > 0 ? Math.min(capCents, stripeRemaining) : stripeRemaining;
      }
    }

    const alreadyRefunded = existing.refunds.reduce((sum, r) => sum + r.amountCents, 0);
    const remainingCents = Math.max(0, capCents - alreadyRefunded);
    if (capCents > 0 && amountCents > remainingCents) {
      throw new BadRequestException(
        `Montant trop élevé (reste remboursable : ${(remainingCents / 100).toFixed(2)} €).`,
      );
    }

    if (paidOnline) {
      if (!existing.stripeCheckoutSessionId) {
        throw new BadRequestException('Aucune session Stripe associée à cette réservation.');
      }
      if (!this.notifications.isStripeConfigured()) {
        throw new BadRequestException('Stripe n’est pas configuré (STRIPE_SECRET_KEY).');
      }
      await this.notifications.refundStripeCheckoutPayment(existing.stripeCheckoutSessionId, amountCents);
    }

    await this.prisma.reservationRefund.create({
      data: {
        reservationId: id,
        amountCents,
        note: input.note?.trim() ? input.note.trim() : null,
      },
    });

    const full = await this.prisma.reservation.findUnique({
      where: { id },
      include: this.reservationInclude,
    });
    if (!full) throw new NotFoundException('Réservation introuvable.');

    const newStatus = this.computeRefundStatus(full, full.refunds);
    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: newStatus,
        detailsJson: this.buildDetailsJsonWithRefunds(full.detailsJson, full.refunds, newStatus),
      },
      include: this.reservationInclude,
    });

    if (!updated) throw new NotFoundException('Réservation introuvable.');

    await this.internalNotifications.emitReservationChangeNotifications(existing, updated);

    if (existing.status !== updated.status) {
      await this.audit.logStatusChange(
        AuditEntity.RESERVATION,
        id,
        existing.status,
        updated.status,
        { title: updated.title },
      );
    }

    await this.audit.log({
      action: AuditAction.REFUND,
      entity: AuditEntity.RESERVATION,
      entityId: id,
      oldData: { refunds: refundsAuditSnapshot(existing.refunds) },
      newData: { refunds: refundsAuditSnapshot(updated.refunds) },
    });

    return updated;
  }

  /** Résolution client : déplacement, avoir ou remboursement. */
  async resolveReservation(id: string, raw: unknown) {
    const input = validateInput(reservationResolutionSchema, raw) as ReservationResolutionInput;

    switch (input.type) {
      case 'refund':
        return this.resolveAsRefund(id, input);
      case 'store_credit':
        return this.resolveAsStoreCredit(id, input);
      case 'move':
        return this.resolveAsMove(id, input);
    }
  }

  private parseSlotFromInput(dateIso: string, startTime: string, endTime: string): { start: Date; end: Date } {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const day = new Date(`${dateIso}T00:00:00.000`);
    const start = new Date(day);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(day);
    end.setHours(eh, em, 0, 0);
    if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1);
    return { start, end };
  }

  private async collectedAmountCents(reservationId: string): Promise<number> {
    return this.memberCredits.collectedCentsOnReservation(reservationId);
  }

  private slotParamsFromDates(start: Date, end: Date): {
    dateIso: string;
    startTime: string;
    endTime: string;
  } {
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      dateIso: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
      endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
    };
  }

  private scheduleChanged(
    existing: { boatId: string; startAt: Date; endAt: Date },
    boatId: string,
    start: Date,
    end: Date,
  ): boolean {
    return (
      existing.boatId !== boatId ||
      existing.startAt.getTime() !== start.getTime() ||
      existing.endAt.getTime() !== end.getTime()
    );
  }

  private mergeCatalogInDetailsJson(
    detailsJson: string | null,
    rentalEuros: number,
    depositEuros: number | null,
  ): string | null {
    if (!detailsJson?.trim()) return detailsJson;
    try {
      const parsed = JSON.parse(detailsJson) as Record<string, unknown>;
      parsed.rentalPrice = rentalEuros.toFixed(2).replace('.', ',');
      if (depositEuros != null) {
        parsed.depositAmount = depositEuros.toFixed(2).replace('.', ',');
      }
      return JSON.stringify(parsed);
    } catch {
      return detailsJson;
    }
  }

  private async applyCatalogPricingForSchedule(
    boatId: string,
    start: Date,
    end: Date,
    existing: {
      discountPercent: number | null;
      couponCode: string | null;
      clientMemberId: string | null;
      clientEmail: string | null;
      depositAmountCents: number | null;
      detailsJson: string | null;
      extras: {
        quantity: number;
        extra: { priceKind: ExtraPriceKind; priceValue: number; billingUnit: ExtraBillingUnit };
      }[];
    },
  ): Promise<{
    rentalPriceCents: number;
    depositAmountCents: number | null;
    totalDueCents: number;
    detailsJson: string | null;
  }> {
    const { dateIso, startTime, endTime } = this.slotParamsFromDates(start, end);
    const catalog = await computeBoatSlotCatalogEuros(
      this.prisma,
      boatId,
      dateIso,
      startTime,
      endTime,
    );
    if (catalog.rentalEuros == null) {
      throw new BadRequestException('Tarif catalogue indisponible pour ce créneau.');
    }

    const rentalPriceCents = Math.round(catalog.rentalEuros * 100);
    const depositAmountCents =
      catalog.depositEuros != null
        ? Math.round(catalog.depositEuros * 100)
        : existing.depositAmountCents;

    const totalDueCents = await computeReservationTotalDueCents(this.prisma, {
      rentalPriceCents,
      discountPercent: existing.discountPercent,
      couponCode: existing.couponCode,
      clientMemberId: existing.clientMemberId,
      clientEmail: existing.clientEmail,
      startAt: start,
      endAt: end,
      extras: mapReservationExtrasForPricing(existing.extras),
    });

    const detailsJson = this.mergeCatalogInDetailsJson(
      existing.detailsJson,
      catalog.rentalEuros,
      catalog.depositEuros,
    );

    return {
      rentalPriceCents,
      depositAmountCents,
      totalDueCents: totalDueCents > 0 ? totalDueCents : rentalPriceCents,
      detailsJson,
    };
  }

  private async reconcileScheduleChangePayment(
    id: string,
    existing: {
      paymentCapturedAt: Date | null;
      clientMemberId: string | null;
      clientEmail: string | null;
    },
    newCatalogNetCents: number,
    options?: {
      notifyClient?: boolean;
      creditLowerDifference?: boolean;
      hadSignedContract?: boolean;
    },
  ): Promise<{
    deltaCents: number;
    supplementPaymentUrl: string | null;
    creditCents: number;
    emailSent: boolean;
    remainingDueCents: number;
  }> {
    const notifyClient = options?.notifyClient !== false;
    const creditLowerDifference = options?.creditLowerDifference !== false;
    const hadSigned = Boolean(options?.hadSignedContract);

    const collected = existing.paymentCapturedAt
      ? await this.collectedAmountCents(id)
      : 0;
    const delta = newCatalogNetCents - collected;
    const remainingDueCents = Math.max(0, delta);

    await this.prisma.reservation.update({
      where: { id },
      data: {
        totalDueCents: remainingDueCents,
        ...(remainingDueCents < 50 && existing.paymentCapturedAt
          ? { paymentLinkUrl: null, stripeCheckoutSessionId: null }
          : {}),
      },
    });

    let supplementUrl: string | null = null;
    let creditCents = 0;
    let emailSent = false;

    if (delta > 50 && existing.paymentCapturedAt) {
      supplementUrl = await this.notifications.createSupplementCheckoutSession(id, delta);
    } else if (delta < -50 && creditLowerDifference && existing.paymentCapturedAt) {
      const { memberId, clientEmail } = this.memberCredits.clientKey(
        existing.clientMemberId,
        existing.clientEmail,
      );
      creditCents = -delta;
      await this.memberCredits.issueCredit({
        memberId,
        clientEmail,
        sourceReservationId: id,
        amountCents: creditCents,
        note: 'Différence suite au changement de créneau ou de bateau',
      });
    }

    if (notifyClient) {
      try {
        if (hadSigned) {
          const refreshed = await this.rentalContracts.refreshSignedContractAfterScheduleChange(id);
          if (refreshed) {
            const signedMail = await this.rentalContracts.sendSignedContractEmail(id, { force: true });
            emailSent = signedMail.sent;
          }
        }
        if (delta > 50) {
          const moveMail = await this.notifications.sendMoveResolutionEmail(id, delta, supplementUrl);
          emailSent = emailSent || moveMail.sent;
        } else if (creditCents > 0) {
          const creditMail = await this.notifications.sendStoreCreditEmail(id, creditCents);
          emailSent = emailSent || creditMail.sent;
        } else if (!hadSigned) {
          const moveMail = await this.notifications.sendMoveResolutionEmail(id, 0, null);
          emailSent = moveMail.sent;
        } else {
          const moveMail = await this.notifications.sendMoveResolutionEmail(id, 0, null);
          emailSent = emailSent || moveMail.sent;
        }
      } catch (err) {
        this.logger.warn(
          `Email suite changement créneau non envoyé (${id}): ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return {
      deltaCents: delta,
      supplementPaymentUrl: supplementUrl,
      creditCents,
      emailSent,
      remainingDueCents,
    };
  }

  private async resolveAsRefund(
    id: string,
    input: Extract<ReservationResolutionInput, { type: 'refund' }>,
  ) {
    const updated = await this.issueRefund(id, { amount: input.amount, note: input.note });
    if (input.notifyClient !== false) {
      try {
        await this.notifications.sendRefundEmail(id, Math.round(input.amount * 100));
      } catch (err) {
        this.logger.warn(`Email remboursement non envoyé (${id}): ${err instanceof Error ? err.message : err}`);
      }
    }
    return { kind: 'refund' as const, reservation: updated, emailSent: input.notifyClient !== false };
  }

  private async resolveAsStoreCredit(
    id: string,
    input: Extract<ReservationResolutionInput, { type: 'store_credit' }>,
  ) {
    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });
    if (!existing) throw new NotFoundException('Réservation introuvable.');
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Cette réservation est déjà annulée.');
    }

    const paid = existing.paymentCapturedAt
      ? await this.collectedAmountCents(id)
      : 0;
    const alreadyRefunded = existing.refunds.reduce((sum, r) => sum + r.amountCents, 0);
    const defaultCents = Math.max(0, paid - alreadyRefunded);
    const amountCents = input.amount != null ? Math.round(input.amount * 100) : defaultCents;
    if (amountCents < 1) throw new BadRequestException('Montant avoir invalide.');

    const { memberId, clientEmail } = this.memberCredits.clientKey(
      existing.clientMemberId,
      existing.clientEmail,
    );

    const cancelledAt = new Date();
    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt,
        detailsJson: this.mergeCancellationInDetailsJson(
          existing.detailsJson,
          input.note ?? 'Avoir client',
          cancelledAt,
        ),
      },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });

    await this.memberCredits.issueCredit({
      memberId,
      clientEmail,
      sourceReservationId: id,
      amountCents,
      note: input.note ?? null,
    });

    await this.internalNotifications.emitReservationChangeNotifications(existing, updated);
    await this.audit.logStatusChange(
      AuditEntity.RESERVATION,
      id,
      existing.status,
      'CANCELLED',
      { title: updated.title, resolution: 'store_credit', amountCents },
    );

    let emailSent = false;
    if (input.notifyClient !== false) {
      try {
        const result = await this.notifications.sendStoreCreditEmail(id, amountCents);
        emailSent = result.sent;
      } catch (err) {
        this.logger.warn(`Email avoir non envoyé (${id}): ${err instanceof Error ? err.message : err}`);
      }
    }

    return { kind: 'store_credit' as const, reservation: updated, creditCents: amountCents, emailSent };
  }

  private async resolveAsMove(
    id: string,
    input: Extract<ReservationResolutionInput, { type: 'move' }>,
  ) {
    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });
    if (!existing) throw new NotFoundException('Réservation introuvable.');

    await this.entities.assertBoatExists(input.boatId);
    const { start, end } = this.parseSlotFromInput(input.dateIso, input.startTime, input.endTime);

    const hadSigned = Boolean(existing.rentalContract?.signedAt);
    const pricing = await this.applyCatalogPricingForSchedule(input.boatId, start, end, existing);

    await this.prisma.reservation.update({
      where: { id },
      data: {
        boatId: input.boatId,
        startAt: start,
        endAt: end,
        rentalPriceCents: pricing.rentalPriceCents,
        depositAmountCents: pricing.depositAmountCents,
        detailsJson: pricing.detailsJson,
      },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });

    const paid = existing.paymentCapturedAt ? await this.collectedAmountCents(id) : 0;
    const payment = await this.reconcileScheduleChangePayment(id, existing, pricing.totalDueCents, {
      notifyClient: input.notifyClient,
      creditLowerDifference: input.creditLowerDifference,
      hadSignedContract: hadSigned,
    });

    const refreshed = await this.prisma.reservation.findUnique({
      where: { id },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });
    const updated = refreshed!;

    await this.internalNotifications.emitReservationChangeNotifications(existing, updated);

    return {
      kind: 'move' as const,
      reservation: updated,
      newTotalCents: pricing.totalDueCents,
      paidCents: paid,
      deltaCents: payment.deltaCents,
      supplementPaymentUrl: payment.supplementPaymentUrl,
      creditCents: payment.creditCents,
      emailSent: payment.emailSent,
      remainingDueCents: payment.remainingDueCents,
    };
  }

  private mergeCancellationInDetailsJson(
    detailsJson: string | null,
    reason: string | undefined,
    cancelledAt: Date,
  ): string | null {
    let details: Record<string, unknown> = {};
    if (detailsJson?.trim()) {
      try {
        const parsed = JSON.parse(detailsJson) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') details = parsed;
      } catch {
        details = {};
      }
    }
    details.status = 'cancelled';
    details.cancelledAt = cancelledAt.toISOString();
    if (reason?.trim()) {
      details.cancellationReason = reason.trim();
    } else {
      delete details.cancellationReason;
    }
    return JSON.stringify(details);
  }

  async cancel(id: string, raw: unknown) {
    const input = validateInput(cancelReservationSchema, raw);
    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: this.reservationInclude,
    });
    if (!existing) throw new NotFoundException('Réservation introuvable.');
    if (existing.status === 'CANCELLED' || existing.cancelledAt) {
      throw new BadRequestException('Cette réservation est déjà annulée.');
    }

    const cancelledAt = new Date();
    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt,
        detailsJson: this.mergeCancellationInDetailsJson(
          existing.detailsJson,
          input.reason,
          cancelledAt,
        ),
      },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });

    await this.internalNotifications.emitReservationChangeNotifications(existing, updated);
    await this.audit.logStatusChange(
      AuditEntity.RESERVATION,
      id,
      existing.status,
      'CANCELLED',
      { title: updated.title, reason: input.reason?.trim() || null },
    );

    let emailSent = false;
    let emailError: string | null = null;
    if (input.notifyClient !== false) {
      try {
        const result = await this.notifications.sendCancellationEmail(id, input.reason);
        emailSent = result.sent;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Envoi email impossible';
        emailError = msg;
        this.logger.warn(`Email annulation non envoyé (${id}): ${msg}`);
      }
    }

    return { reservation: updated, emailSent, emailError };
  }

  private mergeRestoreInDetailsJson(
    detailsJson: string | null,
    status: ReservationStatus,
    paymentCapturedAt: Date | null,
  ): string | null {
    let details: Record<string, unknown> = {};
    if (detailsJson?.trim()) {
      try {
        const parsed = JSON.parse(detailsJson) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') details = parsed;
      } catch {
        details = {};
      }
    }
    details.status = this.adminStatusFromPrisma(status);
    details.cancelledAt = null;
    delete details.cancellationReason;
    if (paymentCapturedAt) {
      details.paymentCapturedAt = paymentCapturedAt.toISOString();
    }
    return JSON.stringify(details);
  }

  async restore(id: string) {
    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });
    if (!existing) throw new NotFoundException('Réservation introuvable.');
    if (existing.status !== 'CANCELLED' && !existing.cancelledAt) {
      throw new BadRequestException('Cette réservation n’est pas annulée.');
    }

    const nextStatus: ReservationStatus = existing.paymentCapturedAt ? 'RESERVED_PAID' : 'PENDING_PAYMENT';
    const totalDueCents = await computeReservationTotalDueCents(this.prisma, {
      rentalPriceCents: existing.rentalPriceCents,
      discountPercent: existing.discountPercent,
      couponCode: existing.couponCode,
      clientMemberId: existing.clientMemberId,
      clientEmail: existing.clientEmail,
      startAt: existing.startAt,
      endAt: existing.endAt,
      extras: mapReservationExtrasForPricing(existing.extras),
    });

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: nextStatus,
        cancelledAt: null,
        totalDueCents: totalDueCents > 0 ? totalDueCents : existing.totalDueCents,
        detailsJson: this.mergeRestoreInDetailsJson(
          existing.detailsJson,
          nextStatus,
          existing.paymentCapturedAt,
        ),
      },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });

    const couponRecorded = await this.coupons.recordRedemptionForReservation({
      couponCode: existing.couponCode,
      clientMemberId: existing.clientMemberId,
      clientEmail: existing.clientEmail,
      startAt: existing.startAt,
    });

    await this.internalNotifications.emitReservationChangeNotifications(existing, updated);
    await this.audit.logStatusChange(
      AuditEntity.RESERVATION,
      id,
      existing.status,
      nextStatus,
      { title: updated.title, couponRedemptionRestored: couponRecorded.recorded },
    );

    return { reservation: updated, couponRedemptionRestored: couponRecorded.recorded };
  }

  async syncStripePayment(id: string) {
    await this.assertReservationEditable(id);
    const existing = await this.prisma.reservation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Réservation introuvable.');
    if (!existing.stripeCheckoutSessionId) {
      throw new BadRequestException('Aucune session Stripe associée à cette réservation.');
    }
    const ok = await this.notifications.confirmPaymentFromCheckoutSession(existing.stripeCheckoutSessionId);
    if (!ok) {
      throw new BadRequestException('Paiement non confirmé côté Stripe pour cette session.');
    }
    await this.rentalContracts.ensureForReservation(id);
    const full = await this.prisma.reservation.findUnique({
      where: { id },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });
    return full ? this.mapReservationForApi(full) : full;
  }

  private async maybeSendConfirmationAndRefetch(reservation: {
    id: string;
    paymentChannel: PaymentChannel;
    clientEmail: string | null;
  } | null) {
    if (
      !reservation ||
      reservation.paymentChannel !== PaymentChannel.ONLINE ||
      !reservation.clientEmail?.trim()
    ) {
      return reservation;
    }
    try {
      await this.notifications.sendConfirmationEmail(reservation.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      this.logger.warn(`Email confirmation non envoyé (${reservation.id}): ${msg}`);
    }

    const refetched = await this.prisma.reservation.findUnique({
      where: { id: reservation.id },
      include: { extras: true, refunds: { orderBy: { refundedAt: 'asc' } } },
    });
    if (
      refetched?.paymentCapturedAt &&
      refetched.paymentChannel === PaymentChannel.ONLINE
    ) {
      try {
        await this.notifications.trySendContractSignEmail(refetched.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur inconnue';
        this.logger.warn(`Email contrat non envoyé (${reservation.id}): ${msg}`);
      }
    }
    return refetched ?? reservation;
  }

  async update(id: string, raw: UpsertReservationDto) {
    await this.assertReservationEditable(id);
    const input = this.parseBody(raw);
    await this.assertRelations(input);

    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });
    if (!existing) throw new NotFoundException('Réservation introuvable.');

    const start = parseDateOrNull(input.start);
    const end = parseDateOrNull(input.end);
    if (!start || !end) throw new BadRequestException('Dates start/end invalides.');

    const scheduleChanged = this.scheduleChanged(existing, input.boatId, start, end);
    const hadSigned = Boolean(existing.rentalContract?.signedAt);

    const airbusBadge = await this.resolveAirbusBadgeForSave(input);
    const data = this.buildReservationData(input, existing.status, airbusBadge);
    const previousRefunds = existing.refunds;

    let catalogNetAfterScheduleChange: number | null = null;
    if (scheduleChanged) {
      const pricing = await this.applyCatalogPricingForSchedule(
        input.boatId,
        start,
        end,
        existing,
      );
      catalogNetAfterScheduleChange = pricing.totalDueCents;
      data.rentalPriceCents = pricing.rentalPriceCents;
      data.depositAmountCents = pricing.depositAmountCents;
      data.detailsJson = pricing.detailsJson ?? data.detailsJson;
    }

    await this.prisma.reservation.update({ where: { id }, data });
    await this.syncMemberAirbusBadge(input.clientMemberId, airbusBadge);

    await this.prisma.reservationExtra.deleteMany({ where: { reservationId: id } });
    if (input.extras?.length) {
      await this.prisma.reservationExtra.createMany({
        data: input.extras.map((x) => ({
          reservationId: id,
          extraId: x.extraId,
          quantity: x.quantity ?? 1,
        })),
      });
    }

    await this.prisma.reservationRefund.deleteMany({ where: { reservationId: id } });
    if (input.refunds?.length) {
      await this.prisma.reservationRefund.createMany({
        data: input.refunds.map((r) => ({
          reservationId: id,
          amountCents: Math.round(r.amount * 100),
          note: r.note ?? null,
          refundedAt: parseDateOrNull(r.at ?? null) ?? new Date(),
        })),
      });
    }

    let full = await this.prisma.reservation.findUnique({
      where: { id },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });

    if (full) {
      if (scheduleChanged && catalogNetAfterScheduleChange != null) {
        await this.reconcileScheduleChangePayment(id, existing, catalogNetAfterScheduleChange, {
          hadSignedContract: hadSigned,
        });
        const refreshed = await this.prisma.reservation.findUnique({
          where: { id },
          include: { extras: { include: { extra: true } }, ...this.reservationInclude },
        });
        if (refreshed) full = refreshed;
      } else {
        full = await this.syncComputedTotalDueCents(full);
      }

      await this.coupons.recordRedemptionForReservation({
        couponCode: full.couponCode,
        clientMemberId: full.clientMemberId,
        clientEmail: full.clientEmail,
        startAt: full.startAt,
      });
      await this.internalNotifications.emitReservationChangeNotifications(existing, full);
      if (existing.status !== full.status) {
        await this.audit.logStatusChange(
          AuditEntity.RESERVATION,
          id,
          existing.status,
          full.status,
          { title: full.title },
        );
      } else {
        await this.audit.logUpdate(
          AuditEntity.RESERVATION,
          id,
          reservationAuditSnapshot(existing),
          reservationAuditSnapshot(full),
        );
      }

      const refundsChanged =
        input.refunds?.length !== undefined &&
        JSON.stringify(refundsAuditSnapshot(previousRefunds)) !==
          JSON.stringify(refundsAuditSnapshot(full.refunds));
      if (refundsChanged && full.refunds.length) {
        await this.audit.log({
          action: AuditAction.REFUND,
          entity: AuditEntity.RESERVATION,
          entityId: id,
          oldData: { refunds: refundsAuditSnapshot(previousRefunds) },
          newData: { refunds: refundsAuditSnapshot(full.refunds) },
        });
      }
    }

    return full ? this.mapReservationForApi(full) : full;
  }

  async remove(id: string) {
    await this.assertReservationEditable(id);
    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: this.reservationInclude,
    });
    if (!existing) throw new NotFoundException('Réservation introuvable.');

    try {
      await this.internalNotifications.emitReservationChangeNotifications(existing, null);
      await this.prisma.reservation.delete({ where: { id } });
      await this.audit.logDelete(AuditEntity.RESERVATION, id, reservationAuditSnapshot(existing));
      return { ok: true as const };
    } catch {
      throw new NotFoundException('Réservation introuvable.');
    }
  }

  async clearAll() {
    const count = await this.prisma.reservation.count();
    await this.prisma.reservation.deleteMany({});
    await this.audit.log({
      action: AuditAction.CLEAR_ALL,
      entity: AuditEntity.RESERVATION,
      oldData: { deletedCount: count },
    });
    return { ok: true as const };
  }
}
