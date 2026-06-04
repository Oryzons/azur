import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CouponDiscountKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { couponRequiresAirbusBadge } from './airbus-coupon.util';
import {
  clientKeyFromReservation,
  computeBrutCentsBeforeCoupon,
  effectiveDiscountPercentFromCents,
  isDegradedDiscountApplied,
  priorSeasonReservationsCount,
  seasonYearForAprilSeptember,
} from './coupon-usage.util';

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

    const memberIds = [...new Set(reservations.map((r) => r.clientMemberId).filter(Boolean))] as string[];
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

    const rowMeta: {
      clientKey: string;
      effectivePct: number | null;
      isDegraded: boolean;
    }[] = [];

    for (const r of reservations) {
      const clientKey = clientKeyFromReservation(r);
      const brutCents = computeBrutCentsBeforeCoupon(r);
      const ttcCents = r.totalDueCents ?? brutCents;
      const effectivePct = effectiveDiscountPercentFromCents(brutCents, ttcCents);
      const isDegraded = isDegradedDiscountApplied(effectivePct, coupon);

      rowMeta.push({ clientKey, effectivePct, isDegraded });

      const agg = clientAgg.get(clientKey) ?? { locationCount: 0, degradedCount: 0 };
      agg.locationCount += 1;
      if (isDegraded) agg.degradedCount += 1;
      clientAgg.set(clientKey, agg);
    }

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

    const csvBody = reservations
      .map((r, idx) => {
        const meta = rowMeta[idx]!;
        const agg = clientAgg.get(meta.clientKey)!;
        const brutCents = computeBrutCentsBeforeCoupon(r);
        const ttcCents = r.totalDueCents ?? brutCents;
        const degradedLabel =
          meta.isDegraded && coupon.discountKind === CouponDiscountKind.PERCENT
            ? `Oui (${coupon.seasonDegradedDiscountValue ?? meta.effectivePct} %)`
            : meta.isDegraded
              ? 'Oui'
              : 'Non';
        const effPct =
          meta.effectivePct != null
            ? String(meta.effectivePct)
            : coupon.discountKind === CouponDiscountKind.PERCENT
              ? String(coupon.discountValue)
              : '—';
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
