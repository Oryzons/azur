import type { Reservation } from '@/pages/calendar/reservationTypes';
import {
  resolveReservationStatus,
  statusDisplayLabel,
  type ReservationStatus,
} from '@/lib/reservationStatus';
import { getEffectiveCouponDiscount, type Coupon } from '@/stores/coupons';
import { countsTowardCouponTier, seasonYearForAprilSeptember } from '@bleu-calanque/shared';
import type { Extra } from '@/stores/extras';
import { reservationToCouponCountable, reservationsToCouponCountables } from '@/lib/couponReservation';

export type CouponUsageEntry = {
  reservationId: string;
  startAt: string;
  status: ReservationStatus;
  statusLabel: string;
  tier: 'full' | 'degraded';
  percent: number | null;
};

export type CouponUsageGroup = {
  key: string;
  clientKey: string;
  count: number;
  fullCount: number;
  degradedCount: number;
  lastStartAt: string;
  lastEffectivePercent: number | null;
  seasonYear: number | null;
  usages: CouponUsageEntry[];
  outOfSeasonCount: number;
};

function clientKeyFromReservation(r: Reservation): string {
  const d = r.details;
  return d?.linkedMemberId?.trim() || d?.clientEmail?.trim().toLowerCase() || '';
}

function activeSeasonYear(reference = new Date()): number | null {
  return seasonYearForAprilSeptember(reference);
}

function effectiveCouponForReservation(
  r: Reservation,
  coupon: Pick<Coupon, 'discountKind' | 'discountValue' | 'seasonRule' | 'code'>,
  allReservations: readonly Reservation[],
): { percent: number | null; tier: 'full' | 'degraded' } {
  const clientKey = clientKeyFromReservation(r);
  if (!clientKey) return { percent: null, tier: 'full' };
  const eff = getEffectiveCouponDiscount(
    coupon as Coupon,
    clientKey,
    reservationsToCouponCountables(allReservations),
    r.start,
    { reservationId: r.id },
  );
  if (eff.discountKind !== 'percent') return { percent: null, tier: eff.tier };
  return { percent: eff.discountValue, tier: eff.tier };
}

export function formatUsageDiscountBadge(
  coupon: Pick<Coupon, 'discountKind' | 'discountValue' | 'seasonRule'>,
  effectivePct: number | null,
): string {
  if (effectivePct != null && coupon.discountKind === 'percent') {
    return `−${effectivePct} %`;
  }
  if (coupon.discountKind === 'fixed') {
    return `−${coupon.discountValue.toFixed(2).replace('.', ',')} €`;
  }
  return `−${coupon.discountValue} %`;
}

export function buildCouponUsageGroupsFromReservations(
  reservations: readonly Reservation[],
  couponCode: string,
  coupon: Pick<Coupon, 'id' | 'discountKind' | 'discountValue' | 'seasonRule' | 'code'>,
  _extrasCatalog: readonly Extra[],
): CouponUsageGroup[] {
  const code = couponCode.trim().toUpperCase();
  const seasonYear = coupon.seasonRule ? activeSeasonYear(new Date()) : null;

  const withCoupon = reservations.filter((r) => {
    const c = r.details?.couponCode?.trim().replaceAll(/\s+/g, '').toUpperCase();
    return c === code;
  });

  const map = new Map<string, CouponUsageGroup>();

  for (const r of withCoupon) {
    const key = clientKeyFromReservation(r);
    if (!key) continue;

    const countable = reservationToCouponCountable(r);
    const inSeason = seasonYear == null || seasonYearForAprilSeptember(r.start) === seasonYear;
    const counts = countable != null && countsTowardCouponTier(countable);

    let group = map.get(key);
    if (!group) {
      group = {
        key,
        clientKey: key,
        count: 0,
        fullCount: 0,
        degradedCount: 0,
        lastStartAt: r.start.toISOString(),
        lastEffectivePercent: null,
        seasonYear,
        usages: [],
        outOfSeasonCount: 0,
      };
      map.set(key, group);
    }

    if (!inSeason) {
      group.outOfSeasonCount += 1;
      continue;
    }

    if (!counts) continue;

    const { percent: eff, tier } = effectiveCouponForReservation(r, coupon, reservations);
    const status = resolveReservationStatus(r.details);
    const entry: CouponUsageEntry = {
      reservationId: r.id,
      startAt: r.start.toISOString(),
      status,
      statusLabel: statusDisplayLabel(status, r.details, { installmentPlan: r.installmentPlan }),
      tier,
      percent: eff,
    };

    group.usages.push(entry);
    group.count += 1;
    if (tier === 'degraded') group.degradedCount += 1;
    else group.fullCount += 1;

    if (r.start.getTime() > new Date(group.lastStartAt).getTime()) {
      group.lastStartAt = r.start.toISOString();
      group.lastEffectivePercent = eff;
    }
  }

  for (const group of map.values()) {
    group.usages.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }

  return [...map.values()]
    .filter((g) => g.count > 0 || g.outOfSeasonCount > 0)
    .sort((a, b) => new Date(b.lastStartAt).getTime() - new Date(a.lastStartAt).getTime());
}

export function formatUsageTierBadges(
  coupon: Pick<Coupon, 'discountKind' | 'discountValue' | 'seasonRule'>,
  group: Pick<CouponUsageGroup, 'fullCount' | 'degradedCount' | 'count' | 'seasonYear'>,
): { fullLabel: string | null; degradedLabel: string | null; totalLabel: string } {
  const fullPct = coupon.discountKind === 'percent' ? coupon.discountValue : null;
  const degradedPct = coupon.seasonRule?.degradedDiscountValue ?? null;

  return {
    fullLabel: group.fullCount > 0 && fullPct != null ? `${group.fullCount}× ${fullPct} %` : null,
    degradedLabel:
      group.degradedCount > 0 && degradedPct != null ? `${group.degradedCount}× ${degradedPct} %` : null,
    totalLabel:
      group.seasonYear != null
        ? `${group.count} loc. payée(s) (saison ${group.seasonYear})`
        : `${group.count} location(s) payée(s)`,
  };
}
