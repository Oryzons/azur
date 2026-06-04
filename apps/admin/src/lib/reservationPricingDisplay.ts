import type { Reservation } from '@/pages/calendar/reservationTypes';
import { computeReservationPricingBreakdown } from '@/pages/finances/pricingTotals';
import type { Coupon, CouponRedemption } from '@/stores/coupons';
import type { Extra } from '@/stores/extras';

export type ReservationPricingDisplay = {
  rentalBrutEuros: number | null;
  manualDiscPct: number;
  couponCode: string | null;
  couponLabel: string | null;
  couponApplies: boolean;
  totalTtcEuros: number | null;
  couponDiscountEuros: number | null;
  /** Total en base ≠ total recalculé (réservation non payée). */
  storedTotalMismatch: boolean;
};

export function computeReservationPricingDisplay(
  reservation: Reservation,
  extrasCatalog: readonly Extra[],
  coupons: readonly Coupon[],
  redemptions: readonly CouponRedemption[],
): ReservationPricingDisplay {
  const d = reservation.details;
  if (!d) {
    return emptyPricingDisplay();
  }

  const codeNorm = d.couponCode.trim().replaceAll(/\s+/g, '').toUpperCase();
  const rawManual = Number.parseFloat(d.discountPercent.replace(',', '.'));
  const manualDiscPct = Number.isFinite(rawManual) ? Math.min(100, Math.max(0, rawManual)) : 0;
  const storedTtc =
    reservation.totalDueCents != null && reservation.totalDueCents > 0
      ? Math.round(reservation.totalDueCents) / 100
      : null;
  const isPaid = Boolean(d.paymentCapturedAt);

  const breakdown = computeReservationPricingBreakdown(
    reservation,
    [...extrasCatalog],
    [...coupons],
    [...redemptions],
  );

  if (!breakdown.ok) {
    return {
      rentalBrutEuros: null,
      manualDiscPct,
      couponCode: codeNorm || null,
      couponLabel: null,
      couponApplies: false,
      totalTtcEuros: storedTtc,
      couponDiscountEuros: null,
      storedTotalMismatch: false,
    };
  }

  const computedFinal = breakdown.final;
  const totalTtcEuros = isPaid && storedTtc != null ? storedTtc : computedFinal;
  const storedTotalMismatch =
    !isPaid && storedTtc != null && Math.abs(storedTtc - computedFinal) > 0.01;

  let couponLabel: string | null = null;
  let couponApplies = false;
  let couponDiscountEuros: number | null = null;

  if (breakdown.coupon?.applied) {
    couponApplies = true;
    if (breakdown.coupon.kind === 'percent') {
      couponLabel = `Coupon −${breakdown.coupon.effectiveValue} %`;
    } else {
      couponLabel = `Coupon −${breakdown.coupon.effectiveValue.toFixed(2)} €`;
    }
    couponDiscountEuros = Math.max(0, Math.round((breakdown.afterManual - computedFinal) * 100) / 100);
  } else if (breakdown.coupon && !breakdown.coupon.applied) {
    couponLabel = 'Coupon non appliqué';
  }

  return {
    rentalBrutEuros: breakdown.rental,
    manualDiscPct,
    couponCode: codeNorm || null,
    couponLabel,
    couponApplies,
    totalTtcEuros,
    couponDiscountEuros,
    storedTotalMismatch,
  };
}

function emptyPricingDisplay(): ReservationPricingDisplay {
  return {
    rentalBrutEuros: null,
    manualDiscPct: 0,
    couponCode: null,
    couponLabel: null,
    couponApplies: false,
    totalTtcEuros: null,
    couponDiscountEuros: null,
    storedTotalMismatch: false,
  };
}
