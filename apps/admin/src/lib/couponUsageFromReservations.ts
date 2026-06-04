import type { Reservation } from '@/pages/calendar/reservationTypes';
import { isReservationCancelled } from '@/lib/reservationStatus';
import type { Coupon } from '@/stores/coupons';
import type { Extra } from '@/stores/extras';

export type CouponUsageGroup = {
  key: string;
  clientKey: string;
  count: number;
  lastStartAt: string;
  degradedCount: number;
  /** Dernière remise réellement appliquée (d’après montants). */
  lastEffectivePercent: number | null;
};

function clientKeyFromReservation(r: Reservation): string {
  const d = r.details;
  return d?.linkedMemberId?.trim() || d?.clientEmail?.trim().toLowerCase() || '';
}

function parseEuros(s: string | undefined): number {
  const n = Number.parseFloat(String(s ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function rentalDaysForReservation(r: Reservation): number {
  const start = r.start.getTime();
  let end = r.end.getTime();
  if (end <= start) end = start + 60 * 60 * 1000;
  return Math.max(1, Math.ceil((end - start) / 86400000));
}

function unitMultiplier(billingUnit: Extra['billingUnit'], rentalDays: number): number {
  if (billingUnit === 'jour') return rentalDays;
  if (billingUnit === 'semaine') return Math.max(1, Math.ceil(rentalDays / 7));
  return 1;
}

function extrasEurosFromDetails(
  details: NonNullable<Reservation['details']>,
  extrasCatalog: readonly Extra[],
  rentalDays: number,
): number {
  let total = 0;
  const rental = parseEuros(details.rentalPrice);
  for (const ex of extrasCatalog) {
    if (!details.extras[ex.id]) continue;
    const mult = unitMultiplier(ex.billingUnit, rentalDays);
    if (ex.priceKind === 'euro') total += ex.priceValue * mult;
    else total += rental * (ex.priceValue / 100) * mult;
  }
  return total;
}

function brutEuros(r: Reservation, extrasCatalog: readonly Extra[]): number {
  const d = r.details;
  if (!d) return 0;
  const rental = parseEuros(d.rentalPrice);
  const manual = Number.parseFloat(d.discountPercent.replace(',', '.')) || 0;
  const sub = rental + extrasEurosFromDetails(d, extrasCatalog, rentalDaysForReservation(r));
  return Math.round(sub * (1 - Math.min(100, Math.max(0, manual)) / 100) * 100) / 100;
}

export function effectiveDiscountPercent(r: Reservation, extrasCatalog: readonly Extra[]): number | null {
  const brut = brutEuros(r, extrasCatalog);
  const ttc = r.totalDueCents != null && r.totalDueCents > 0 ? r.totalDueCents / 100 : brut;
  if (brut <= 0 || ttc <= 0) return null;
  return Math.round((1 - ttc / brut) * 1000) / 10;
}

export function isDegradedApplied(
  effectivePct: number | null,
  coupon: Pick<Coupon, 'discountKind' | 'discountValue' | 'seasonRule'>,
): boolean {
  if (effectivePct == null || !coupon.seasonRule) return false;
  if (coupon.discountKind !== 'percent') return false;
  const degraded = coupon.seasonRule.degradedDiscountValue;
  const full = coupon.discountValue;
  const distD = Math.abs(effectivePct - degraded);
  const distF = Math.abs(effectivePct - full);
  return distD < 1.5 && distD <= distF;
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
  coupon: Pick<Coupon, 'discountKind' | 'discountValue' | 'seasonRule'>,
  extrasCatalog: readonly Extra[],
): CouponUsageGroup[] {
  const code = couponCode.trim().toUpperCase();
  const matching = reservations.filter((r) => {
    const c = r.details?.couponCode?.trim().replaceAll(/\s+/g, '').toUpperCase();
    return c === code && !isReservationCancelled(r.details);
  });

  const map = new Map<string, CouponUsageGroup>();

  for (const r of matching) {
    const key = clientKeyFromReservation(r);
    if (!key) continue;
    const eff = effectiveDiscountPercent(r, extrasCatalog);
    const degraded = isDegradedApplied(eff, coupon);
    const startIso = r.start.toISOString();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        key,
        clientKey: key,
        count: 1,
        lastStartAt: startIso,
        degradedCount: degraded ? 1 : 0,
        lastEffectivePercent: eff,
      });
    } else {
      prev.count += 1;
      if (degraded) prev.degradedCount += 1;
      if (new Date(startIso).getTime() > new Date(prev.lastStartAt).getTime()) {
        prev.lastStartAt = startIso;
        prev.lastEffectivePercent = eff;
      }
    }
  }

  return [...map.values()].sort(
    (a, b) => new Date(b.lastStartAt).getTime() - new Date(a.lastStartAt).getTime(),
  );
}
