import { pad2, startOfDay } from '@/pages/calendar/calendarConstants';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import { computeReservationPricingCents, isThirdPartyOfflineExtra } from '@bleu-calanque/shared';
import { reservationsToCouponCountables } from '@/lib/couponReservation';
import { getEffectiveCouponDiscount, isCouponActiveNow, type Coupon } from '@/stores/coupons';
import { rentalDaysBetweenDates, splitExtrasByPaymentChannel, sumExtrasEuros } from '@/lib/extraPricing';
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
      extrasOffline: number;
      /** Extras payés directement au prestataire (skipper hors ligne). */
      extrasThirdParty: number;
      subtotal: number;
      manualDiscPct: number;
      afterManual: number;
      coupon: CouponInfo | null;
      couponDiscountOnRental: number;
      final: number;
      payableOnline: number;
      refunds: number;
    }
  | { ok: false };

export type CouponInfo = {
  code: string;
  kind: 'percent' | 'fixed';
  effectiveValue: number;
  tier: 'full' | 'degraded';
  applied: boolean;
};

export function computeReservationPricingBreakdown(
  r: Reservation,
  extrasCatalog: Extra[],
  couponsCatalog: Coupon[],
  allReservations: readonly Reservation[],
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
  const thirdPartyExtras = selectedExtras.filter((e) =>
    isThirdPartyOfflineExtra({ name: e.name, icon: e.icon, paymentChannel: e.paymentChannel }),
  );
  const businessExtras = selectedExtras.filter(
    (e) => !isThirdPartyOfflineExtra({ name: e.name, icon: e.icon, paymentChannel: e.paymentChannel }),
  );

  const start = r.start;
  let end = r.end;
  if (end.getTime() <= start.getTime()) end = new Date(start.getTime() + 60 * 60 * 1000);
  const rentalDays = rentalDaysBetweenDates(start, end);
  const { online: onlineExtras, offline: offlineExtras } = splitExtrasByPaymentChannel(businessExtras);
  const extrasOnline = sumExtrasEuros(rental, onlineExtras, rentalDays);
  const extrasOffline = sumExtrasEuros(rental, offlineExtras, rentalDays);
  const extrasThirdParty = sumExtrasEuros(rental, thirdPartyExtras, rentalDays);
  const extras = Math.round((extrasOnline + extrasOffline) * 100) / 100;

  const subtotal = Math.round((rental + extrasOnline) * 100) / 100;
  const manualFactor = 1 - manualDiscPct / 100;
  const afterManual = Math.round((rental + extrasOnline) * manualFactor * 100) / 100;

  const codeNorm = String(d.couponCode ?? '')
    .trim()
    .replaceAll(/\s+/g, '')
    .toUpperCase();
  const clientKey = d.linkedMemberId?.trim() || String(d.clientEmail ?? '').trim().toLowerCase() || '__guest__';
  const evalDate = new Date(`${isoDay(r.start)}T12:00:00.000`);

  const extrasForPricing = businessExtras.map((ex) => ({
    quantity: 1,
    paymentChannel: ex.paymentChannel === 'offline' ? 'OFFLINE' : 'ONLINE',
    extra: {
      priceKind: ex.priceKind === 'euro' ? ('EURO' as const) : ('PERCENT' as const),
      priceValue: ex.priceValue,
      billingUnit:
        ex.billingUnit === 'jour' ? ('JOUR' as const) : ex.billingUnit === 'semaine' ? ('SEMAINE' as const) : ('LOCATION' as const),
    },
  }));

  let coupon: CouponInfo | null = null;
  let effectiveCoupon: { discountKind: 'percent' | 'fixed'; discountValue: number } | null = null;

  if (codeNorm) {
    const matched = couponsCatalog.find((c) => c.code === codeNorm);
    if (matched?.enabled && isCouponActiveNow(matched, evalDate)) {
      const eff = getEffectiveCouponDiscount(
        matched,
        clientKey,
        reservationsToCouponCountables(allReservations.filter((x) => x.id !== r.id)),
        evalDate,
      );
      coupon = {
        code: codeNorm,
        kind: eff.discountKind,
        effectiveValue: eff.discountValue,
        tier: eff.tier,
        applied: true,
      };
      effectiveCoupon = { discountKind: eff.discountKind, discountValue: eff.discountValue };
    } else {
      coupon = { code: codeNorm, kind: 'percent', effectiveValue: 0, tier: 'full', applied: false };
    }
  }

  const priced = computeReservationPricingCents({
    rentalPriceCents: Math.round(rental * 100),
    discountPercent: manualDiscPct,
    extras: extrasForPricing,
    startAt: start,
    endAt: end,
    coupon: effectiveCoupon
      ? {
          discountKind: effectiveCoupon.discountKind === 'percent' ? 'PERCENT' : 'FIXED',
          discountValue: effectiveCoupon.discountValue,
        }
      : null,
  });

  const payableOnline = priced.payableOnlineCents / 100;
  const final = priced.grandTotalCents / 100;
  const couponDiscountOnRental = priced.couponDiscountOnRentalCents / 100;

  const refunds = Math.round(((Array.isArray(d.refunds) ? d.refunds : []) as { amount?: number }[]).reduce((sum, x) => sum + Number(x.amount || 0), 0) * 100) / 100;

  return {
    ok: true,
    rental,
    extras,
    extrasOffline,
    extrasThirdParty,
    subtotal,
    manualDiscPct,
    afterManual,
    coupon,
    couponDiscountOnRental,
    final,
    payableOnline,
    refunds,
  };
}

export function sumTotals(
  reservations: Reservation[],
  range: { start: Date; endExclusive: Date },
  extrasCatalog: Extra[],
  couponsCatalog: Coupon[],
) {
  const inRange = reservations.filter((r) => r.start >= range.start && r.start < range.endExclusive);
  const totals = inRange
    .map((r) => {
      const b = computeReservationPricingBreakdown(r, extrasCatalog, couponsCatalog, reservations);
      return b.ok ? Math.max(0, Math.round((b.final - b.refunds) * 100) / 100) : null;
    })
    .filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  const total = Math.round(totals.reduce((sum, x) => sum + x, 0) * 100) / 100;
  return { count: inRange.length, total };
}
