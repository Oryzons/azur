import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CouponDiscountKind, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { couponRequiresAirbusBadge } from './airbus-coupon.util';
import {
  computeReservationPricingCents,
  countsTowardCouponTier,
  resolveEffectiveCouponFromReservations,
  type CouponCountableReservation,
} from '@bleu-calanque/shared';
import { mapReservationExtrasForPricing } from '../pricing/reservation-pricing-map';
import { clientKeyFromReservation, computeBrutCentsBeforeCoupon } from './coupon-usage.util';

function csvEscape(v: string | number): string {
  const s = String(v ?? '');
  if (/[;"\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function formatEuros(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

type ExportReservation = Prisma.ReservationGetPayload<{
  include: { extras: { include: { extra: true } } };
}>;

function toCouponCountable(r: ExportReservation): CouponCountableReservation {
  return {
    id: r.id,
    createdAt: r.createdAt,
    couponCode: r.couponCode,
    clientMemberId: r.clientMemberId,
    clientEmail: r.clientEmail,
    startAt: r.startAt,
    endAt: r.endAt,
    status: r.status,
    cancelledAt: r.cancelledAt,
    paymentCapturedAt: r.paymentCapturedAt,
  };
}

@Injectable()
export class CouponsAirbusExportService {
  constructor(private readonly prisma: PrismaService) {}

  async buildCsv(couponId: string): Promise<{ csv: string; filename: string }> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) throw new NotFoundException('Coupon introuvable.');
    if (!couponRequiresAirbusBadge(coupon)) {
      throw new BadRequestException('L’export Airbus est réservé aux coupons partenaire Airbus.');
    }

    const reservations = await this.prisma.reservation.findMany({
      where: {
        couponCode: coupon.code,
        status: { not: 'CANCELLED' },
      },
      include: { extras: { include: { extra: true } } },
      orderBy: { startAt: 'asc' },
    });

    const eligible = reservations.filter((r) => countsTowardCouponTier(r));
    const countables = eligible.map(toCouponCountable);

    const memberIds = [...new Set(eligible.map((r) => r.clientMemberId).filter(Boolean))] as string[];
    const members =
      memberIds.length > 0
        ? await this.prisma.member.findMany({
            where: { id: { in: memberIds } },
            select: { id: true, airbusBadge: true },
          })
        : [];
    const badgeByMember = new Map(members.map((m) => [m.id, m.airbusBadge ?? '']));

    type ClientAgg = { locationCount: number; degradedCount: number };
    const clientAgg = new Map<string, ClientAgg>();

    type ExportRow = {
      reservation: ExportReservation;
      clientKey: string;
      brutCents: number;
      ttcCents: number;
      tierPercent: number | null;
      isDegraded: boolean;
    };

    const exportRows: ExportRow[] = eligible.map((r) => {
      const clientKey = clientKeyFromReservation(r);
      const eff = resolveEffectiveCouponFromReservations(
        {
          discountKind: coupon.discountKind,
          discountValue: coupon.discountValue,
          seasonMaxFullUsesPerClient: coupon.seasonMaxFullUsesPerClient,
          seasonDegradedDiscountValue: coupon.seasonDegradedDiscountValue,
        },
        r,
        r.startAt,
        coupon.code,
        countables,
        { reservationId: r.id, evaluationCreatedAt: r.createdAt },
      );
      const isDegraded = eff.tier === 'degraded';
      const extras = mapReservationExtrasForPricing(r.extras);
      const pricing = computeReservationPricingCents({
        rentalPriceCents: r.rentalPriceCents ?? 0,
        discountPercent: r.discountPercent,
        extras,
        startAt: r.startAt,
        endAt: r.endAt,
        coupon:
          coupon.discountKind === CouponDiscountKind.PERCENT ||
          coupon.discountKind === CouponDiscountKind.FIXED
            ? { discountKind: eff.discountKind, discountValue: eff.discountValue }
            : null,
      });
      const brutCents = computeBrutCentsBeforeCoupon({ ...r, extras });
      const ttcCents = pricing.grandTotalCents;

      const agg = clientAgg.get(clientKey) ?? { locationCount: 0, degradedCount: 0 };
      agg.locationCount += 1;
      if (isDegraded) agg.degradedCount += 1;
      clientAgg.set(clientKey, agg);

      const tierPercent =
        coupon.discountKind === CouponDiscountKind.PERCENT ? eff.discountValue : null;

      return { reservation: r, clientKey, brutCents, ttcCents, tierPercent, isDegraded };
    });

    const headers = [
      'Date réservation',
      'N° badge Airbus',
      'Prénom',
      'Nom',
      'Email',
      'Téléphone',
      'Prix brut (€)',
      'Prix TTC (€)',
      'Nb locations (client)',
      'Remise réduite (cette résa)',
      'Remise effective (%)',
      'Nb fois remise à 20% (client)',
    ];

    const csvBody = exportRows
      .map(({ reservation: r, clientKey, brutCents, ttcCents, tierPercent, isDegraded }) => {
        const agg = clientAgg.get(clientKey) ?? { locationCount: 0, degradedCount: 0 };
        const degradedLabel =
          isDegraded && coupon.discountKind === CouponDiscountKind.PERCENT
            ? `Oui (${coupon.seasonDegradedDiscountValue ?? tierPercent} %)`
            : isDegraded
              ? 'Oui'
              : 'Non';
        const effPct = tierPercent != null ? String(tierPercent) : '—';
        const badge =
          r.airbusBadge?.trim() ||
          (r.clientMemberId ? badgeByMember.get(r.clientMemberId) ?? '' : '');

        return [
          formatDateFr(r.startAt),
          badge,
          r.clientFirstName ?? '',
          r.clientLastName ?? '',
          r.clientEmail ?? '',
          r.clientPhone ?? '',
          formatEuros(brutCents),
          formatEuros(ttcCents),
          String(agg.locationCount),
          degradedLabel,
          effPct,
          String(agg.degradedCount),
        ]
          .map(csvEscape)
          .join(';');
      })
      .join('\n');

    const csv = `${headers.join(';')}\n${csvBody}`;
    const safeCode = coupon.code.replaceAll(/[^A-Za-z0-9_-]+/g, '_');
    return { csv, filename: `airbus-${safeCode}-${new Date().toISOString().slice(0, 10)}.csv` };
  }
}
