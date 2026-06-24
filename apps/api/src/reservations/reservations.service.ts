import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Civility,
  ClientType,
  ExtraBillingUnit,
  ExtraPriceKind,
  PaymentChannel,
  PaymentMethod,
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
  normalizeBoatLicenseType,
  upsertReservationSchema,
  computeInstallmentAmounts,
  clampDepositPercent,
  installmentLabel,
  DEFAULT_DEPOSIT_PERCENT,
  countsTowardCouponUsage,
  paymentMethodLabel,
  readDetailsPaymentCents,
  resolveStripeGrossPaidCents,
} from '@bleu-calanque/shared';
import { couponRequiresAirbusBadge } from '../coupons/airbus-coupon.util';
import { EntityChecksService } from '../common/validation/entity-checks';
import { validateInput } from '../common/validation/validate-input';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuditAction, AuditEntity } from '../common/audit/audit.constants';
import { refundsAuditSnapshot, reservationAuditSnapshot } from '../common/audit/audit-snapshots';
import type { UpsertReservationDto, SettleSupplementDto } from './reservations.dto';
import { computeReservationTotalDueCents, computeReservationGrandTotalCents, reservationPricingInputFromRow } from '../pricing/reservation-pricing';
import { mapReservationExtrasForPricing } from '../pricing/reservation-pricing-map';
import { computeBoatSlotCatalogEuros } from '../pricing/catalog-location-pricing';
import { CouponsService } from '../coupons/coupons.service';
import { MemberCreditsService } from '../member-credits/member-credits.service';
import { RentalContractsService } from '../rental-contracts/rental-contracts.service';
import { parseReservationContractFields } from '../rental-contracts/rental-contract-field-resolvers';
import { ExtrasService } from '../extras/extras.service';
import { isStripeChargeAlreadyRefunded } from '../common/stripe/stripe-error-message';

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
    private readonly extras: ExtrasService,
  ) {}

  private readonly reservationInclude = {
    boat: true,
    refunds: { orderBy: { refundedAt: 'asc' as const } },
    installmentPlan: { orderBy: { sequence: 'asc' as const } },
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
    if (!contract || contract.status) return this.applyVirtualPaymentCoherence(row);
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
    return this.applyVirtualPaymentCoherence({
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
    } as T);
  }

  /** Expose une baseline CB dans detailsJson si Stripe l'a enregistrée (affichage admin cohérent). */
  private applyVirtualPaymentCoherence<T extends Record<string, unknown>>(row: T): T {
    if (!row.paymentCapturedAt) return row;
    const detailsPayment = readDetailsPaymentCents(
      typeof row.detailsJson === 'string' ? row.detailsJson : null,
    );
    const stripeGross = resolveStripeGrossPaidCents({
      stripeNetCents: row.stripeNetCents as number | null | undefined,
      stripeFeeCents: row.stripeFeeCents as number | null | undefined,
    });
    const baseline =
      detailsPayment.onlinePaidBaselineCents >= 50
        ? detailsPayment.onlinePaidBaselineCents
        : stripeGross;
    if (baseline < 50) return row;

    let details: Record<string, unknown> = {};
    if (typeof row.detailsJson === 'string' && row.detailsJson.trim()) {
      try {
        const parsed = JSON.parse(row.detailsJson) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') details = parsed;
      } catch {
        details = {};
      }
    }
    if (Number(details.onlinePaidBaselineCents) >= 50) return row;
    return {
      ...row,
      detailsJson: JSON.stringify({ ...details, onlinePaidBaselineCents: baseline }),
    } as T;
  }

  private readSupplementPaidFromDetails(detailsJson: string | null): number {
    return readDetailsPaymentCents(detailsJson).supplementPaidCents;
  }

  /** Données minimales pour l’espace propriétaire (date + horaires, sans client ni paiement). */
  private mapReservationForOwnerApi(row: Record<string, unknown>) {
    const boat = row.boat as { id: string; name: string; detailsJson?: string | null } | null | undefined;
    return {
      id: row.id,
      boatId: row.boatId,
      title: 'Location',
      startAt: row.startAt,
      endAt: row.endAt,
      color: '#64748B',
      status: ReservationStatus.RESERVED_PAID,
      boat: boat ? { id: boat.id, name: boat.name, detailsJson: null } : undefined,
      extras: [],
      refunds: [],
      installmentPlan: [],
      checkFlowSubmissions: [],
      rentalContract: null,
      clientMemberId: null,
      clientType: null,
      civility: null,
      clientEmail: null,
      clientFirstName: null,
      clientLastName: null,
      clientPhone: null,
      clientBirthDate: null,
      clientAddress: null,
      clientPostalCode: null,
      clientCity: null,
      clientCountry: null,
      passengerCount: null,
      hasChildren: false,
      childrenCount: null,
      internalNote: null,
      paymentChannel: PaymentChannel.ONLINE,
      rentalPriceCents: null,
      depositAmountCents: null,
      discountPercent: null,
      couponCode: null,
      airbusBadge: null,
      installments: null,
      depositPercent: null,
      settlementNote: null,
      paymentCapturedAt: null,
      depositCapturedAt: null,
      detailsJson: null,
    };
  }

  async list(user: AuthUser) {
    const where =
      user.role === UserRole.OWNER
        ? {
            boat: { ownerMemberId: await this.ownerScope.requireOwnerMemberId(user) },
            cancelledAt: null,
            status: { not: ReservationStatus.CANCELLED },
          }
        : {};
    const rows = await this.prisma.reservation.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: {
        extras: { select: { extraId: true, quantity: true }, orderBy: { extraId: 'asc' } },
        boat: { select: { id: true, name: true, detailsJson: true } },
        refunds: { orderBy: { refundedAt: 'asc' } },
        installmentPlan: { orderBy: { sequence: 'asc' } },
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
    const withCredits = await this.attachStoreCreditAppliedCents(rows);
    return withCredits.map((row) =>
      user.role === UserRole.OWNER
        ? this.mapReservationForOwnerApi(row as Record<string, unknown>)
        : this.mapReservationForApi(row),
    );
  }

  private async mapReservationRowForApi<
    T extends Record<string, unknown> & { id: string },
  >(row: T | null): Promise<(T & { storeCreditAppliedCents: number }) | null> {
    if (!row) return null;
    const [enriched] = await this.attachStoreCreditAppliedCents([row]);
    return this.mapReservationForApi(enriched);
  }

  private async attachStoreCreditAppliedCents<T extends { id: string }>(
    rows: T[],
  ): Promise<(T & { storeCreditAppliedCents: number })[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const grouped = await this.prisma.memberCreditUsage.groupBy({
      by: ['reservationId'],
      where: { reservationId: { in: ids } },
      _sum: { amountCents: true },
    });
    const byId = new Map(grouped.map((g) => [g.reservationId, g._sum.amountCents ?? 0]));
    return rows.map((row) => ({
      ...row,
      storeCreditAppliedCents: byId.get(row.id) ?? 0,
    }));
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

  private async syncMemberContractFields(
    memberId: string | null | undefined,
    detailsJson: string | null,
  ): Promise<void> {
    if (!memberId?.trim() || !detailsJson?.trim()) return;
    const fields = parseReservationContractFields(detailsJson);
    const data: Record<string, string> = {};
    if (fields.clientIdType?.trim()) data.clientIdType = fields.clientIdType.trim();
    if (fields.clientIdNumber?.trim()) data.clientIdNumber = fields.clientIdNumber.trim();
    if (fields.licenseType?.trim()) {
      data.licenseType = normalizeBoatLicenseType(fields.licenseType) ?? fields.licenseType.trim();
    }
    if (fields.licenseNumber?.trim()) data.licenseNumber = fields.licenseNumber.trim();
    if (fields.licenseCountry?.trim()) data.licenseCountry = fields.licenseCountry.trim();
    if (fields.licenseYear?.trim()) data.licenseYear = fields.licenseYear.trim();
    if (Object.keys(data).length === 0) return;
    await this.prisma.member.update({
      where: { id: memberId },
      data,
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
      depositPercent: input.depositPercent ?? null,
      settlementNote: input.settlementNote ?? null,
      paymentCapturedAt: parseDateOrNull(input.paymentCapturedAt ?? null),
      depositCapturedAt: parseDateOrNull(input.depositCapturedAt ?? null),
      confirmationEmailSentAt: parseDateOrNull(input.confirmationEmailSentAt ?? null),
      totalDueCents: input.totalDueCents ?? null,
      cancelledAt: parseDateOrNull(input.cancelledAt ?? null),
      status: (input.status ?? existingStatus ?? 'PENDING_PAYMENT') as ReservationStatus,
    };
  }

  private async assertExtrasStockForInput(
    input: UpsertReservationInput,
    excludeReservationId?: string,
  ): Promise<void> {
    const start = parseDateOrNull(input.start);
    const end = parseDateOrNull(input.end);
    if (!start || !end) return;
    await this.extras.assertStockForSlot({
      startAt: start,
      endAt: end,
      excludeReservationId,
      items: input.extras ?? [],
    });
  }

  async create(raw: UpsertReservationDto) {
    const input = this.parseBody(raw);
    await this.assertRelations(input);
    await this.assertExtrasStockForInput(input);
    const airbusBadge = await this.resolveAirbusBadgeForSave(input);
    const data = this.buildReservationData(input, undefined, airbusBadge);

    const created = await this.prisma.reservation.create({ data });
    await this.syncMemberAirbusBadge(input.clientMemberId, airbusBadge);
    await this.syncMemberContractFields(input.clientMemberId, input.detailsJson ?? null);

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
      await this.syncInstallmentPlan(full.id, {
        installments: input.installments ?? null,
        depositPercent: input.depositPercent ?? null,
        methods: input.installmentMethods as PaymentMethod[] | undefined,
      });
      const refetchedPlan = await this.prisma.reservation.findUnique({
        where: { id: full.id },
        include: { extras: { include: { extra: true } }, ...this.reservationInclude },
      });
      if (refetchedPlan) full = refetchedPlan;
      await this.syncCouponRedemptionForReservation(full);
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

  async settleInstallment(id: string, sequence: number, paid: boolean) {
    if (sequence !== 1 && sequence !== 2) {
      throw new BadRequestException('Numéro d’échéance invalide.');
    }
    const existing = await this.prisma.reservation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Réservation introuvable.');
    await this.notifications.setInstallmentPaid(id, sequence, paid);
    const full = await this.prisma.reservation.findUnique({
      where: { id },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });
    return this.mapReservationRowForApi(full);
  }

  async settleSupplement(id: string, input: SettleSupplementDto) {
    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });
    if (!existing) throw new NotFoundException('Réservation introuvable.');
    if (!existing.paymentCapturedAt) {
      throw new BadRequestException('La réservation n’est pas encore payée.');
    }

    const newCatalogNet = await computeReservationTotalDueCents(
      this.prisma,
      reservationPricingInputFromRow(
        existing,
        mapReservationExtrasForPricing(existing.extras, { onlineOnly: true }),
      ),
    );
    const collected = await this.collectedAmountCents(id);
    const supplementDue = Math.max(0, newCatalogNet - collected);
    const remainingStored = Math.max(0, existing.totalDueCents ?? 0);
    const outstanding = supplementDue >= 50 ? supplementDue : remainingStored;

    if (outstanding < 50) {
      throw new BadRequestException('Aucun supplément en attente.');
    }

    const method = input.method ?? PaymentMethod.ONLINE;

    if (!input.paid) {
      await this.prisma.reservation.update({
        where: { id },
        data: {
          totalDueCents: outstanding,
          paymentLinkUrl: null,
          stripeCheckoutSessionId: null,
        },
      });
      const full = await this.prisma.reservation.findUnique({
        where: { id },
        include: { extras: { include: { extra: true } }, ...this.reservationInclude },
      });
      return this.mapReservationRowForApi(full);
    }

    if (method === PaymentMethod.ONLINE) {
      await this.notifications.createSupplementCheckoutSession(id, outstanding);
      const full = await this.prisma.reservation.findUnique({
        where: { id },
        include: { extras: { include: { extra: true } }, ...this.reservationInclude },
      });
      return this.mapReservationRowForApi(full);
    }

    const amountLabel = `${(outstanding / 100).toFixed(2).replace('.', ',')} €`;
    const note = this.appendSettlementNote(
      existing.settlementNote,
      `Supplément extras ${amountLabel} — ${paymentMethodLabel(method)}`,
    );
    const prevSupplement = this.readSupplementPaidCents(existing.detailsJson);
    await this.prisma.reservation.update({
      where: { id },
      data: {
        totalDueCents: 0,
        paymentLinkUrl: null,
        stripeCheckoutSessionId: null,
        settlementNote: note,
        detailsJson: this.mergeDetailsJsonField(existing.detailsJson, {
          supplementPaidCents: prevSupplement + outstanding,
        }),
      },
    });
    const contract = await this.prisma.reservationRentalContract.findUnique({
      where: { reservationId: id },
      select: { signedAt: true },
    });
    if (contract?.signedAt) {
      try {
        await this.rentalContracts.refreshSignedContractAfterScheduleChange(id);
      } catch (err) {
        this.logger.warn(
          `Contrat signé non actualisé après supplément (${id}): ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    const full = await this.prisma.reservation.findUnique({
      where: { id },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });
    return this.mapReservationRowForApi(full);
  }

  async settleOfflineDue(id: string, input: SettleSupplementDto) {
    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });
    if (!existing) throw new NotFoundException('Réservation introuvable.');

    const offlineDue = await this.computeOfflineDueCents(existing);
    const offlinePaid = this.readOfflinePaidCents(existing.detailsJson);
    const outstanding = Math.max(0, offlineDue - offlinePaid);

    if (!input.paid) {
      if (offlinePaid < 1) {
        throw new BadRequestException('Aucun règlement sur place à annuler.');
      }
      await this.prisma.reservation.update({
        where: { id },
        data: {
          detailsJson: this.mergeDetailsJsonField(existing.detailsJson, { offlinePaidCents: 0 }),
        },
      });
      const full = await this.prisma.reservation.findUnique({
        where: { id },
        include: { extras: { include: { extra: true } }, ...this.reservationInclude },
      });
      return this.mapReservationRowForApi(full);
    }

    if (outstanding < 50) {
      throw new BadRequestException('Aucun extra sur place en attente.');
    }

    const method = input.method ?? PaymentMethod.CASH;
    const amountLabel = `${(outstanding / 100).toFixed(2).replace('.', ',')} €`;
    const note = this.appendSettlementNote(
      existing.settlementNote,
      `Extras sur place ${amountLabel} — ${paymentMethodLabel(method)}`,
    );
    await this.prisma.reservation.update({
      where: { id },
      data: {
        detailsJson: this.mergeDetailsJsonField(existing.detailsJson, { offlinePaidCents: offlineDue }),
        settlementNote: note,
      },
    });
    const full = await this.prisma.reservation.findUnique({
      where: { id },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });
    return this.mapReservationRowForApi(full);
  }

  async sendSupplementPaymentEmail(id: string) {
    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });
    if (!existing) throw new NotFoundException('Réservation introuvable.');
    if (!existing.paymentCapturedAt) {
      throw new BadRequestException('La réservation n’est pas encore payée.');
    }

    const newCatalogNet = await computeReservationTotalDueCents(
      this.prisma,
      reservationPricingInputFromRow(
        existing,
        mapReservationExtrasForPricing(existing.extras, { onlineOnly: true }),
      ),
    );
    const collected = await this.collectedAmountCents(id);
    const supplementDue = Math.max(0, newCatalogNet - collected);
    const remainingStored = Math.max(0, existing.totalDueCents ?? 0);
    const outstanding = supplementDue >= 50 ? supplementDue : remainingStored;

    if (outstanding < 50) {
      throw new BadRequestException('Aucun supplément en attente.');
    }

    let paymentUrl = existing.paymentLinkUrl;
    if (!paymentUrl?.trim()) {
      paymentUrl = await this.notifications.createSupplementCheckoutSession(id, outstanding);
    }
    const mail = await this.notifications.sendSupplementDueEmail(id, outstanding, paymentUrl);
    const full = await this.prisma.reservation.findUnique({
      where: { id },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });
    return { sent: mail.sent, paymentLinkUrl: paymentUrl, reservation: this.mapReservationRowForApi(full) };
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
  async syncStripeFees(): Promise<{ updated: number }> {
    return this.notifications.syncMissingStripeFees();
  }

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

  /** Montant déjà encaissé (toutes échéances réglées, Stripe + espèces). */
  private totalPaidCents(reservation: {
    paymentCapturedAt: Date | null;
    totalDueCents: number | null;
    rentalPriceCents: number | null;
    installmentPlan: { status: string; amountCents: number }[];
  }): number {
    const paidInstallments = reservation.installmentPlan.filter((p) => p.status === 'PAID');
    if (paidInstallments.length > 0) {
      return paidInstallments.reduce((sum, p) => sum + p.amountCents, 0);
    }
    if (!reservation.paymentCapturedAt) return 0;
    return this.refundableCapCents(reservation);
  }

  private computeRefundStatus(
    reservation: {
      totalDueCents: number | null;
      rentalPriceCents: number | null;
      paymentCapturedAt: Date | null;
      installmentPlan: { status: string; amountCents: number }[];
    },
    refunds: Pick<ReservationRefund, 'amountCents'>[],
  ): ReservationStatus {
    const totalRefunded = refunds.reduce((sum, r) => sum + r.amountCents, 0);
    const cap = this.totalPaidCents(reservation) || this.refundableCapCents(reservation);
    if (cap > 0 && totalRefunded >= cap - 1) return 'REFUNDED';
    return 'PARTIALLY_REFUNDED';
  }

  /** Importe en BDD les remboursements Stripe déjà effectués mais non enregistrés (statut partiel/total). */
  async syncStripeRefunds(id: string): Promise<{ importedCents: number; status: ReservationStatus | null }> {
    if (!this.notifications.isStripeConfigured()) {
      return { importedCents: 0, status: null };
    }

    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: this.reservationInclude,
    });
    if (!existing) throw new NotFoundException('Réservation introuvable.');

    const stripeRefundedCents = await this.notifications.getStripeTotalRefundedCents(id);
    const dbRefundedCents = existing.refunds.reduce((sum, r) => sum + r.amountCents, 0);
    const delta = stripeRefundedCents - dbRefundedCents;
    if (delta < 1) {
      return { importedCents: 0, status: existing.status };
    }

    await this.prisma.reservationRefund.create({
      data: {
        reservationId: id,
        amountCents: delta,
        note: 'Synchronisé depuis Stripe',
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
        detailsJson: this.buildDetailsJsonWithRefunds(full.detailsJson, full.refunds, newStatus, {
          cancelledAt: full.cancelledAt,
        }),
      },
      include: this.reservationInclude,
    });

    await this.syncCouponRedemptionForReservation(updated);
    await this.internalNotifications.emitReservationChangeNotifications(existing, updated);

    if (existing.status !== newStatus) {
      await this.audit.logStatusChange(AuditEntity.RESERVATION, id, existing.status, newStatus, {
        title: updated.title,
        source: 'stripe_refund_sync',
      });
    }

    return { importedCents: delta, status: newStatus };
  }

  private async syncComputedTotalDueCents<
    T extends {
      id: string;
      createdAt: Date;
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

    const computed = await computeReservationTotalDueCents(
      this.prisma,
      reservationPricingInputFromRow(reservation, mapReservationExtrasForPricing(reservation.extras, { onlineOnly: true })),
    );

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

  /**
   * Recrée/maj le plan d'échéances (1re = acompte, 2e = solde) d'une réservation.
   * - installments !== 2 → supprime les échéances (paiement unique géré ailleurs).
   * - installments === 2 → upsert des 2 échéances selon depositPercent + modes choisis.
   * Les échéances déjà payées (PAID) ne sont jamais modifiées.
   */
  private async syncInstallmentPlan(
    reservationId: string,
    opts: { installments: number | null; depositPercent: number | null; methods?: PaymentMethod[] },
  ): Promise<void> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        totalDueCents: true,
        depositPercent: true,
        paymentChannel: true,
        installmentPlan: { orderBy: { sequence: 'asc' } },
      },
    });
    if (!reservation) return;

    if (opts.installments !== 2) {
      if (reservation.installmentPlan.length > 0) {
        await this.prisma.reservationInstallment.deleteMany({ where: { reservationId } });
      }
      return;
    }

    const total = reservation.totalDueCents ?? 0;
    const pct = clampDepositPercent(opts.depositPercent ?? reservation.depositPercent ?? DEFAULT_DEPOSIT_PERCENT);
    const { depositCents, balanceCents } = computeInstallmentAmounts(total, pct);
    const amounts = [depositCents, balanceCents];

    const defaultMethod: PaymentMethod =
      reservation.paymentChannel === PaymentChannel.OFFLINE ? PaymentMethod.CASH : PaymentMethod.ONLINE;

    for (let i = 0; i < 2; i++) {
      const sequence = i + 1;
      const existing = reservation.installmentPlan.find((p) => p.sequence === sequence);
      const method =
        opts.methods?.[i] ?? (existing?.method as PaymentMethod | undefined) ?? defaultMethod;

      if (existing) {
        if (existing.status === 'PAID') continue;
        await this.prisma.reservationInstallment.update({
          where: { id: existing.id },
          data: {
            amountCents: amounts[i],
            method,
            label: installmentLabel(sequence, 2),
          },
        });
      } else {
        await this.prisma.reservationInstallment.create({
          data: {
            reservationId,
            sequence,
            label: installmentLabel(sequence, 2),
            amountCents: amounts[i],
            method,
            status: 'PENDING',
          },
        });
      }
    }
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
    cancellation?: { cancelledAt: Date | null },
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
    const cancelledAt = cancellation?.cancelledAt ?? null;
    if (cancelledAt) {
      details.cancelledAt = cancelledAt.toISOString();
    }
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

    const stripeTargets = paidOnline
      ? await this.notifications.getStripeRefundTargetsForReservation(existing)
      : [];

    const paidTotalCents = this.totalPaidCents(existing);
    let capCents = this.refundableCapCents(existing);
    if (paidTotalCents > 0) {
      capCents = capCents > 0 ? Math.min(capCents, paidTotalCents) : paidTotalCents;
    }

    const stripeRefundableTotal = stripeTargets.reduce((sum, t) => sum + t.refundableCents, 0);

    const alreadyRefunded = existing.refunds.reduce((sum, r) => sum + r.amountCents, 0);
    const remainingCents = Math.max(0, capCents - alreadyRefunded);
    if (capCents > 0 && amountCents > remainingCents) {
      throw new BadRequestException(
        `Montant trop élevé (reste remboursable : ${(remainingCents / 100).toFixed(2)} €).`,
      );
    }

    if (paidOnline) {
      const stripeRefundCents = Math.min(amountCents, stripeRefundableTotal);
      const manualRefundCents = amountCents - stripeRefundCents;

      if (stripeRefundCents > 0) {
        if (!this.notifications.isStripeConfigured()) {
          throw new BadRequestException('Stripe n’est pas configuré (STRIPE_SECRET_KEY).');
        }
        if (stripeTargets.length === 0) {
          throw new BadRequestException(
            'Aucun encaissement Stripe remboursable détecté pour l’acompte en ligne. Utilisez « Synchroniser Stripe » si le client a payé par CB. La part espèces/chèque se rembourse hors Stripe (enregistrement seul).',
          );
        }
        let left = stripeRefundCents;
        let stripeProcessedCents = 0;
        for (const target of stripeTargets) {
          if (left <= 0) break;
          const chunk = Math.min(left, target.refundableCents);
          try {
            await this.notifications.refundStripePaymentTarget(target, chunk);
            stripeProcessedCents += chunk;
            left -= chunk;
          } catch (err) {
            if (isStripeChargeAlreadyRefunded(err)) {
              // Tentative précédente ou remboursement manuel sur Stripe — poursuivre le solde hors ligne.
              stripeProcessedCents += chunk;
              left -= chunk;
              continue;
            }
            throw err;
          }
        }
        if (left > 0) {
          throw new BadRequestException(
            `Montant Stripe remboursable insuffisant (manque ${(left / 100).toFixed(2)} € sur la part CB).`,
          );
        }
      }

    }

    const refundNoteParts = [input.note?.trim()].filter(Boolean) as string[];
    if (paidOnline) {
      const stripePart = Math.min(amountCents, stripeRefundableTotal);
      const manualPart = amountCents - stripePart;
      if (stripePart > 0 && manualPart > 0) {
        refundNoteParts.push(
          `Remb. Stripe ${(stripePart / 100).toFixed(2)} € + hors ligne ${(manualPart / 100).toFixed(2)} €`,
        );
      }
    }

    await this.prisma.reservationRefund.create({
      data: {
        reservationId: id,
        amountCents,
        note: refundNoteParts.length > 0 ? refundNoteParts.join(' — ') : null,
      },
    });

    const full = await this.prisma.reservation.findUnique({
      where: { id },
      include: this.reservationInclude,
    });
    if (!full) throw new NotFoundException('Réservation introuvable.');

    const newStatus = this.computeRefundStatus(full, full.refunds);
    const shouldCancel = input.cancelReservation === true;
    const cancelledAt =
      existing.cancelledAt ?? (shouldCancel ? new Date() : null);
    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: newStatus,
        ...(cancelledAt && !existing.cancelledAt ? { cancelledAt } : {}),
        detailsJson: this.buildDetailsJsonWithRefunds(full.detailsJson, full.refunds, newStatus, {
          cancelledAt,
        }),
      },
      include: this.reservationInclude,
    });

    if (!updated) throw new NotFoundException('Réservation introuvable.');

    await this.syncCouponRedemptionForReservation(updated);
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

  private async collectedAmountCents(
    reservationId: string,
    opts?: { previousCatalogNetCents?: number },
  ): Promise<number> {
    let collected = await this.memberCredits.collectedCentsOnReservation(reservationId);
    if (collected >= 50) return collected;
    if ((opts?.previousCatalogNetCents ?? 0) >= 50) {
      return opts!.previousCatalogNetCents!;
    }

    const row = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        stripeCheckoutSessionId: true,
        detailsJson: true,
        paymentCapturedAt: true,
      },
    });
    if (!row?.paymentCapturedAt) return collected;

    const sessionAmount = await this.notifications.getCheckoutSessionPaidCents(
      row.stripeCheckoutSessionId,
    );
    if (sessionAmount >= 50) {
      await this.ensureOnlinePaidBaseline(reservationId, row.detailsJson, sessionAmount);
      collected = Math.max(collected, sessionAmount);
    }
    return collected;
  }

  private async ensureOnlinePaidBaseline(
    reservationId: string,
    detailsJson: string | null,
    baselineCents: number,
  ): Promise<void> {
    if (baselineCents < 50) return;
    let details: Record<string, unknown> = {};
    if (detailsJson?.trim()) {
      try {
        const parsed = JSON.parse(detailsJson) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') details = parsed;
      } catch {
        details = {};
      }
    }
    const existing = Number(details.onlinePaidBaselineCents);
    if (Number.isFinite(existing) && existing >= 50) return;

    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        detailsJson: JSON.stringify({ ...details, onlinePaidBaselineCents: baselineCents }),
      },
    });
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

  private extrasPricingSignature(extras: { extraId: string; quantity: number }[]): string {
    return [...extras]
      .sort((a, b) => a.extraId.localeCompare(b.extraId))
      .map((e) => `${e.extraId}:${e.quantity}`)
      .join('|');
  }

  private normalizeCouponCode(code: string | null | undefined): string {
    return (code ?? '').trim().replaceAll(/\s+/g, '').toUpperCase();
  }

  private catalogPricingChanged(
    existing: {
      discountPercent: number | null;
      couponCode: string | null;
      rentalPriceCents: number | null;
      extras: { extraId: string; quantity: number }[];
    },
    input: UpsertReservationInput,
    data: { discountPercent: number | null; couponCode: string | null; rentalPriceCents: number | null },
    scheduleChanged: boolean,
  ): boolean {
    if (scheduleChanged) return true;
    if (
      this.extrasPricingSignature(
        existing.extras.map((e) => ({ extraId: e.extraId, quantity: e.quantity })),
      ) !==
      this.extrasPricingSignature(
        (input.extras ?? []).map((e) => ({
          extraId: e.extraId,
          quantity: e.quantity ?? 1,
        })),
      )
    ) {
      return true;
    }
    if ((data.discountPercent ?? null) !== (existing.discountPercent ?? null)) return true;
    if (this.normalizeCouponCode(data.couponCode) !== this.normalizeCouponCode(existing.couponCode)) {
      return true;
    }
    if ((data.rentalPriceCents ?? null) !== (existing.rentalPriceCents ?? null)) return true;
    return false;
  }

  private readSupplementPaidCents(detailsJson: string | null): number {
    if (!detailsJson?.trim()) return 0;
    try {
      const parsed = JSON.parse(detailsJson) as { supplementPaidCents?: unknown };
      const n = Number(parsed?.supplementPaidCents);
      return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
    } catch {
      return 0;
    }
  }

  private readOfflinePaidCents(detailsJson: string | null): number {
    if (!detailsJson?.trim()) return 0;
    try {
      const parsed = JSON.parse(detailsJson) as { offlinePaidCents?: unknown };
      const n = Number(parsed?.offlinePaidCents);
      return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
    } catch {
      return 0;
    }
  }

  private mergeDetailsJsonField(
    detailsJson: string | null,
    patch: Record<string, unknown>,
  ): string {
    let details: Record<string, unknown> = {};
    if (detailsJson?.trim()) {
      try {
        const parsed = JSON.parse(detailsJson) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') details = parsed;
      } catch {
        details = {};
      }
    }
    return JSON.stringify({ ...details, ...patch });
  }

  private async computeOfflineDueCents(
    reservation: {
      id: string;
      createdAt: Date;
      rentalPriceCents: number | null;
      discountPercent: number | null;
      couponCode: string | null;
      clientMemberId: string | null;
      clientEmail: string | null;
      startAt: Date;
      endAt: Date;
      extras: {
        quantity: number;
        extra: { priceKind: ExtraPriceKind; priceValue: number; billingUnit: ExtraBillingUnit; paymentChannel?: unknown };
      }[];
    },
  ): Promise<number> {
    const { pricing } = await computeReservationGrandTotalCents(
      this.prisma,
      reservationPricingInputFromRow(
        reservation,
        mapReservationExtrasForPricing(reservation.extras as Parameters<typeof mapReservationExtrasForPricing>[0]),
      ),
    );
    return Math.max(0, pricing.grandTotalCents - pricing.payableOnlineCents);
  }

  private appendSettlementNote(existing: string | null, line: string): string {
    const prev = existing?.trim() ?? '';
    return prev ? `${prev}\n${line}` : line;
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
      id: string;
      createdAt: Date;
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

    const totalDueCents = await computeReservationTotalDueCents(
      this.prisma,
      reservationPricingInputFromRow(
        { ...existing, rentalPriceCents, startAt: start, endAt: end },
        mapReservationExtrasForPricing(existing.extras, { onlineOnly: true }),
      ),
    );

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
      autoCreateSupplementCheckout?: boolean;
      /** Catalogue en ligne avant modification (extras retirés/ajoutés). */
      previousCatalogNetCents?: number;
    },
  ): Promise<{
    deltaCents: number;
    supplementPaymentUrl: string | null;
    creditCents: number;
    emailSent: boolean;
    remainingDueCents: number;
  }> {
    const notifyClient = options?.notifyClient === true;
    const creditLowerDifference = options?.creditLowerDifference !== false;
    const hadSigned = Boolean(options?.hadSignedContract);
    const autoCreateSupplementCheckout = options?.autoCreateSupplementCheckout === true;

    const collected = existing.paymentCapturedAt
      ? await this.collectedAmountCents(id, {
          previousCatalogNetCents: options?.previousCatalogNetCents,
        })
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

    if (collected >= 50 && existing.paymentCapturedAt) {
      const row = await this.prisma.reservation.findUnique({
        where: { id },
        select: { detailsJson: true },
      });
      if (row) {
        const supplement = this.readSupplementPaidFromDetails(row.detailsJson);
        const baselineCandidate =
          (options?.previousCatalogNetCents ?? 0) >= 50
            ? options!.previousCatalogNetCents!
            : Math.max(0, collected - supplement);
        await this.ensureOnlinePaidBaseline(id, row.detailsJson, baselineCandidate);
      }
    }

    let supplementUrl: string | null = null;
    let creditCents = 0;
    let emailSent = false;

    if (delta > 50 && existing.paymentCapturedAt && autoCreateSupplementCheckout) {
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
        note: 'Différence suite à modification de la réservation',
      });
    }

    if (hadSigned) {
      try {
        await this.rentalContracts.refreshSignedContractAfterScheduleChange(id);
      } catch (err) {
        this.logger.warn(
          `Contrat signé non actualisé (${id}): ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (notifyClient) {
      try {
        if (hadSigned) {
          const signedMail = await this.rentalContracts.sendSignedContractEmail(id, { force: true });
          emailSent = signedMail.sent;
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
    const updated = await this.issueRefund(id, {
      amount: input.amount,
      note: input.note,
      cancelReservation: input.cancelReservation !== false,
    });
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

    await this.syncCouponRedemptionForReservation(updated);
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

    await this.syncCouponRedemptionForReservation(updated);
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
    if (
      existing.status === 'REFUNDED' ||
      existing.status === 'PARTIALLY_REFUNDED' ||
      existing.refunds.length > 0
    ) {
      throw new BadRequestException(
        'Impossible de rétablir une réservation remboursée (totalement ou partiellement).',
      );
    }

    const nextStatus: ReservationStatus = existing.paymentCapturedAt ? 'RESERVED_PAID' : 'PENDING_PAYMENT';
    const totalDueCents = await computeReservationTotalDueCents(
      this.prisma,
      reservationPricingInputFromRow(
        existing,
        mapReservationExtrasForPricing(existing.extras, { onlineOnly: true }),
      ),
    );

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

    const couponRecorded = await this.syncCouponRedemptionForReservation(updated);

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
    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: this.reservationInclude,
    });
    if (!existing) throw new NotFoundException('Réservation introuvable.');

    const sessionIds = new Set<string>();
    for (const inst of existing.installmentPlan) {
      const sid = inst.stripeCheckoutSessionId?.trim();
      if (sid) sessionIds.add(sid);
    }
    const rootSid = existing.stripeCheckoutSessionId?.trim();
    if (rootSid) sessionIds.add(rootSid);

    if (sessionIds.size === 0) {
      throw new BadRequestException('Aucune session Stripe associée à cette réservation.');
    }

    let anyOk = false;
    for (const sessionId of sessionIds) {
      if (await this.notifications.confirmPaymentFromCheckoutSession(sessionId)) {
        anyOk = true;
      }
    }
    const refundSync = await this.syncStripeRefunds(id);
    if (!anyOk && refundSync.importedCents < 1) {
      throw new BadRequestException(
        'Paiement non confirmé côté Stripe (aucune session payée trouvée — vérifiez acompte / solde).',
      );
    }
    if (anyOk) {
      await this.rentalContracts.ensureForReservation(id);
    }
    const full = await this.prisma.reservation.findUnique({
      where: { id },
      include: { extras: { include: { extra: true } }, ...this.reservationInclude },
    });
    const mapped = await this.mapReservationRowForApi(full);
    if (mapped && typeof mapped === 'object') {
      return {
        ...mapped,
        stripeRefundSync: refundSync,
      };
    }
    return mapped;
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

    await this.assertExtrasStockForInput(input, id);

    const scheduleChanged = this.scheduleChanged(existing, input.boatId, start, end);
    const hadSigned = Boolean(existing.rentalContract?.signedAt);

    const airbusBadge = await this.resolveAirbusBadgeForSave(input);
    const data = this.buildReservationData(input, existing.status, airbusBadge);
    if (existing.paymentCapturedAt) {
      delete (data as { totalDueCents?: number | null }).totalDueCents;
    }
    const previousRefunds = existing.refunds;

    if (scheduleChanged) {
      const pricing = await this.applyCatalogPricingForSchedule(
        input.boatId,
        start,
        end,
        existing,
      );
      data.rentalPriceCents = pricing.rentalPriceCents;
      data.depositAmountCents = pricing.depositAmountCents;
      data.detailsJson = pricing.detailsJson ?? data.detailsJson;
    }

    await this.prisma.reservation.update({ where: { id }, data });
    await this.syncMemberAirbusBadge(input.clientMemberId, airbusBadge);
    await this.syncMemberContractFields(input.clientMemberId, input.detailsJson ?? data.detailsJson ?? null);

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
      const pricingChanged =
        Boolean(existing.paymentCapturedAt) &&
        this.catalogPricingChanged(
          existing,
          input,
          {
            discountPercent: data.discountPercent ?? null,
            couponCode: data.couponCode ?? null,
            rentalPriceCents: data.rentalPriceCents ?? null,
          },
          scheduleChanged,
        );

      if (pricingChanged) {
        const previousCatalogNet = await computeReservationTotalDueCents(
          this.prisma,
          reservationPricingInputFromRow(
            existing,
            mapReservationExtrasForPricing(existing.extras, { onlineOnly: true }),
          ),
        );
        const newCatalogNet = await computeReservationTotalDueCents(
          this.prisma,
          reservationPricingInputFromRow(
            full,
            mapReservationExtrasForPricing(full.extras, { onlineOnly: true }),
          ),
        );
        await this.reconcileScheduleChangePayment(id, existing, newCatalogNet, {
          hadSignedContract: hadSigned,
          notifyClient: false,
          autoCreateSupplementCheckout: false,
          previousCatalogNetCents: previousCatalogNet,
        });
        const refreshed = await this.prisma.reservation.findUnique({
          where: { id },
          include: { extras: { include: { extra: true } }, ...this.reservationInclude },
        });
        if (refreshed) full = refreshed;
      } else {
        full = await this.syncComputedTotalDueCents(full);
      }

      await this.syncInstallmentPlan(full.id, {
        installments: input.installments ?? null,
        depositPercent: input.depositPercent ?? null,
        methods: input.installmentMethods as PaymentMethod[] | undefined,
      });
      const refetchedPlan = await this.prisma.reservation.findUnique({
        where: { id: full.id },
        include: { extras: { include: { extra: true } }, ...this.reservationInclude },
      });
      if (refetchedPlan) full = refetchedPlan;

      await this.syncCouponRedemptionForReservation(full);
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

    return this.mapReservationRowForApi(full);
  }

  private couponRedemptionSnapshot(row: {
    couponCode: string | null;
    clientMemberId: string | null;
    clientEmail: string | null;
    startAt: Date;
    endAt: Date;
    status: ReservationStatus;
    cancelledAt: Date | null;
    paymentCapturedAt: Date | null;
  }) {
    return {
      couponCode: row.couponCode,
      clientMemberId: row.clientMemberId,
      clientEmail: row.clientEmail,
      startAt: row.startAt,
      endAt: row.endAt,
      status: row.status,
      cancelledAt: row.cancelledAt,
      paymentCapturedAt: row.paymentCapturedAt,
    };
  }

  private async syncCouponRedemptionForReservation(row: {
    couponCode: string | null;
    clientMemberId: string | null;
    clientEmail: string | null;
    startAt: Date;
    endAt: Date;
    status: ReservationStatus;
    cancelledAt: Date | null;
    paymentCapturedAt: Date | null;
  }) {
    const snapshot = this.couponRedemptionSnapshot(row);
    if (countsTowardCouponUsage(snapshot, new Date())) {
      return this.coupons.recordRedemptionForReservation(snapshot);
    }
    await this.coupons.removeRedemptionForReservation(snapshot);
    return { recorded: false, removed: true };
  }

  async remove(id: string) {
    await this.assertReservationEditable(id);
    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: this.reservationInclude,
    });
    if (!existing) throw new NotFoundException('Réservation introuvable.');

    try {
      await this.coupons.removeRedemptionForReservation({
        couponCode: existing.couponCode,
        clientMemberId: existing.clientMemberId,
        clientEmail: existing.clientEmail,
        startAt: existing.startAt,
      });
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
