import type { Reservation } from '@/pages/calendar/reservationTypes';
import { computeReservationPricingBreakdown } from '@/pages/finances/pricingTotals';
import { buildReservationPaymentContext } from '@/lib/reservationOfflineDue';
import { isReservationFullyPaid, resolveReservationStatus } from '@/lib/reservationStatus';
import { resolveStoreCreditAppliedCents } from '@bleu-calanque/shared';
import type { Coupon } from '@/stores/coupons';
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
  /** Montant TTC encore enregistré en base (si différent du recalcul). */
  storedTotalTtcEuros: number | null;
  /** Avoir client imputé sur la part en ligne (€). */
  storeCreditAppliedEuros: number | null;
};

export function computeReservationPricingDisplay(
  reservation: Reservation,
  extrasCatalog: readonly Extra[],
  coupons: readonly Coupon[],
  allReservations: readonly Reservation[],
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
  const status = resolveReservationStatus(d);
  const isFullyPaid =
    isReservationFullyPaid(
      buildReservationPaymentContext(reservation, extrasCatalog, coupons, allReservations),
      d,
    ) ||
    status === 'refunded' ||
    status === 'partially_refunded';
  const hasAnyPayment =
    Boolean(d.paymentCapturedAt) || status === 'reserved_paid' || isFullyPaid;

  const breakdown = computeReservationPricingBreakdown(
    reservation,
    [...extrasCatalog],
    [...coupons],
    allReservations,
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
      storedTotalTtcEuros: storedTtc,
      storeCreditAppliedEuros: null,
    };
  }

  const computedFinal = breakdown.final;
  const computedPayableOnline = breakdown.payableOnline;
  const totalTtcEuros = computedFinal;
  // Le total en base peut être inférieur au recalcul (avoir client déduit) : ne pas alerter dans ce cas.
  const storedTotalMismatch =
    !hasAnyPayment &&
    storedTtc != null &&
    storedTtc > computedPayableOnline + 0.01;

  let couponLabel: string | null = null;
  let couponApplies = false;
  let couponDiscountEuros: number | null = null;

  if (breakdown.coupon?.applied) {
    couponApplies = true;
    const tierNote = breakdown.coupon.tier === 'degraded' ? ' (palier réduit)' : '';
    if (breakdown.coupon.kind === 'percent') {
      couponLabel = `Coupon −${breakdown.coupon.effectiveValue} %${tierNote}`;
    } else {
      couponLabel = `Coupon −${breakdown.coupon.effectiveValue.toFixed(2)} €${tierNote}`;
    }
    couponDiscountEuros = breakdown.couponDiscountOnRental;
  } else if (breakdown.coupon && !breakdown.coupon.applied) {
    couponLabel = 'Coupon non appliqué';
  }

  const payableOnlineCents = Math.round(computedPayableOnline * 100);
  const storedDueCents =
    reservation.totalDueCents != null && reservation.totalDueCents >= 0
      ? reservation.totalDueCents
      : null;
  const storeCreditAppliedCents = resolveStoreCreditAppliedCents(
    payableOnlineCents,
    storedDueCents,
    reservation.storeCreditAppliedCents ?? null,
  );
  const storeCreditAppliedEuros =
    storeCreditAppliedCents > 0 ? Math.round(storeCreditAppliedCents) / 100 : null;

  return {
    rentalBrutEuros: breakdown.rental,
    manualDiscPct,
    couponCode: codeNorm || null,
    couponLabel,
    couponApplies,
    totalTtcEuros,
    couponDiscountEuros,
    storedTotalMismatch,
    storedTotalTtcEuros: storedTtc,
    storeCreditAppliedEuros,
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
    storedTotalTtcEuros: null,
    storeCreditAppliedEuros: null,
  };
}
