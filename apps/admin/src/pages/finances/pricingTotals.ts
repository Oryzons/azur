import { pad2, startOfDay } from '@/pages/calendar/calendarConstants';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import { applyCouponToRentalAndExtrasEuros } from '@bleu-calanque/shared';
import { getEffectiveCouponDiscount, isCouponActiveNow, type Coupon, type CouponRedemption } from '@/stores/coupons';
import type { Extra } from '@/stores/extras';

function isoDay(d: Date) {
  const x = startOfDay(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}

export function euro(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export type PricingBreakdown =
  | {
      ok: true;
      rental: number;
      extras: number;
      subtotal: number;
      manualDiscPct: number;
      afterManual: number;
      coupon: CouponInfo | null;
      final: number;
      refunds: number;
    }
  | { ok: false };

export type CouponInfo = {
  code: string;
  kind: 'percent' | 'fixed';
  effectiveValue: number;
  applied: boolean;
};

export function computeReservationPricingBreakdown(
  r: Reservation,
  extrasCatalog: Extra[],
  couponsCatalog: Coupon[],
  couponRedemptions: CouponRedemption[],
): PricingBreakdown {
  const d = r.details;
  if (!d) return { ok: false };

  const rawPrice = Number.parseFloat(String(d.rentalPrice ?? '').replace(',', '.'));
  const rawManual = Number.parseFloat(String(d.discountPercent ?? '').replace(',', '.'));
  const manualDiscPct = Number.isFinite(rawManual) ? Math.min(100, Math.max(0, rawManual)) : 0;

  const hasPrice = Number.isFinite(rawPrice) && rawPrice > 0;
  if (!hasPrice) return { ok: false };
  const rental = rawPrice;

  const selectedExtraIds = new Set(Object.entries(d.extras ?? {}).filter(([, v]) => Boolean(v)).map(([id]) => id));
  const selectedExtras = extrasCatalog.filter((e) => e.enabled && selectedExtraIds.has(e.id));

  const start = r.start;
  let end = r.end;
  if (end.getTime() <= start.getTime()) end = new Date(start.getTime() + 60 * 60 * 1000);
  const rentalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));

  const unitMultiplier = (u: 'location' | 'jour' | 'semaine') => {
    if (u === 'location') return 1;
    if (u === 'jour') return rentalDays;
    return Math.max(1, Math.ceil(rentalDays / 7));
  };

  const extrasEuro = selectedExtras
    .filter((e) => e.priceKind === 'euro')
    .reduce((sum, e) => sum + e.priceValue * unitMultiplier(e.billingUnit), 0);
  const extrasPercent = selectedExtras
    .filter((e) => e.priceKind === 'percent')
    .reduce((sum, e) => sum + (rental * (e.priceValue / 100)) * unitMultiplier(e.billingUnit), 0);
  const extras = Math.round((extrasEuro + extrasPercent) * 100) / 100;

  const subtotal = Math.round((rental + extras) * 100) / 100;
  const manualFactor = 1 - manualDiscPct / 100;
  const locationAfterManual = Math.round(rental * manualFactor * 100) / 100;
  const extrasAfterManual = Math.round(extras * manualFactor * 100) / 100;
  const afterManual = Math.round((locationAfterManual + extrasAfterManual) * 100) / 100;

  const codeNorm = String(d.couponCode ?? '')
    .trim()
    .replaceAll(/\s+/g, '')
    .toUpperCase();
  const clientKey = d.linkedMemberId?.trim() || String(d.clientEmail ?? '').trim().toLowerCase() || '__guest__';
  const evalDate = new Date(`${isoDay(r.start)}T12:00:00.000`);

  let final = afterManual;
  let coupon: CouponInfo | null = null;
  if (codeNorm) {
    const matched = couponsCatalog.find((c) => c.code === codeNorm);
    if (matched?.enabled && isCouponActiveNow(matched, evalDate)) {
      const eff = getEffectiveCouponDiscount(matched, clientKey, couponRedemptions, evalDate);
      coupon = { code: codeNorm, kind: eff.discountKind, effectiveValue: eff.discountValue, applied: true };
      final = applyCouponToRentalAndExtrasEuros(locationAfterManual, extrasAfterManual, {
        discountKind: eff.discountKind,
        discountValue: eff.discountValue,
      }).final;
    } else {
      coupon = { code: codeNorm, kind: 'percent', effectiveValue: 0, applied: false };
    }
  }
  final = Math.round(final * 100) / 100;

  const refunds = Math.round(((Array.isArray(d.refunds) ? d.refunds : []) as { amount?: number }[]).reduce((sum, x) => sum + Number(x.amount || 0), 0) * 100) / 100;

  return { ok: true, rental, extras, subtotal, manualDiscPct, afterManual, coupon, final, refunds };
}

export function sumTotals(
  reservations: Reservation[],
  range: { start: Date; endExclusive: Date },
  extrasCatalog: Extra[],
  couponsCatalog: Coupon[],
  couponRedemptions: CouponRedemption[],
) {
  const inRange = reservations.filter((r) => r.start >= range.start && r.start < range.endExclusive);
  const totals = inRange
    .map((r) => {
      const b = computeReservationPricingBreakdown(r, extrasCatalog, couponsCatalog, couponRedemptions);
      return b.ok ? Math.max(0, Math.round((b.final - b.refunds) * 100) / 100) : null;
    })
    .filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  const total = Math.round(totals.reduce((sum, x) => sum + x, 0) * 100) / 100;
  return { count: inRange.length, total };
}
