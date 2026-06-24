import { isMultiInstallmentPlan, rentalDaysBetween } from '@bleu-calanque/shared';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import { computeReservationPricingBreakdown } from '@/pages/finances/pricingTotals';
import { splitExtrasByPaymentChannel, sumExtrasEuros } from '@/lib/extraPricing';
import type { Coupon } from '@/stores/coupons';
import type { Extra } from '@/stores/extras';
import {
  computeReservationPaymentBalance,
  inferOutstandingOnlineDueCents,
  resolveStripePaidCents,
} from '@/lib/reservationPaymentBalance';
import type { ReservationPaymentVisualContext } from '@/lib/reservationStatus';

/** Montant TTC des extras « hors ligne » sélectionnés (centimes). */
export function computeReservationOfflineDueCents(
  reservation: Reservation,
  extrasCatalog: readonly Extra[],
): number {
  const d = reservation.details;
  if (!d) return 0;
  const selectedIds = new Set(
    Object.entries(d.extras ?? {})
      .filter(([, on]) => Boolean(on))
      .map(([id]) => id),
  );
  const selected = extrasCatalog.filter((e) => selectedIds.has(e.id));
  const { offline } = splitExtrasByPaymentChannel(selected);
  if (offline.length === 0) return 0;
  const rental = Number.parseFloat(String(d.rentalPrice ?? '').replace(',', '.'));
  const rentalEuros = Number.isFinite(rental) ? rental : 0;
  const days = rentalDaysBetween(reservation.start, reservation.end);
  const euros = sumExtrasEuros(rentalEuros, offline, days);
  return Math.max(0, Math.round(euros * 100));
}

function inferRemainingTotalCents(
  reservation: Reservation,
  extrasCatalog: readonly Extra[],
  outstandingOnlineDueCents: number,
): number | undefined {
  const d = reservation.details;
  const plan = reservation.installmentPlan ?? [];
  const offlineDueCents = computeReservationOfflineDueCents(reservation, extrasCatalog);
  const offlinePaidCents = Math.max(0, Number(d?.offlinePaidCents) || 0);
  const offlineRemainingCents = Math.max(0, offlineDueCents - offlinePaidCents);

  if (isMultiInstallmentPlan(plan)) {
    const unpaidInstallments = plan
      .filter((p) => p.status !== 'PAID')
      .reduce((sum, p) => sum + (p.amountCents ?? 0), 0);
    return unpaidInstallments + offlineRemainingCents;
  }

  if (outstandingOnlineDueCents >= 50) {
    return outstandingOnlineDueCents + offlineRemainingCents;
  }

  if (d?.paymentCapturedAt) {
    const storedDue = Math.max(0, reservation.totalDueCents ?? 0);
    if (storedDue >= 50) {
      return storedDue + offlineRemainingCents;
    }
    return offlineRemainingCents >= 50 ? offlineRemainingCents : 0;
  }

  if (reservation.totalDueCents == null || reservation.totalDueCents < 1) {
    return offlineRemainingCents >= 50 ? offlineRemainingCents : 0;
  }

  return Math.max(0, reservation.totalDueCents) + offlineRemainingCents;
}

export function reservationPaymentContext(
  reservation: Reservation,
  extrasCatalog: readonly Extra[],
  opts?: {
    outstandingOnlineDueCents?: number;
    payableOnlineCents?: number | null;
    remainingTotalCents?: number;
  },
): ReservationPaymentVisualContext {
  const d = reservation.details;
  const outstandingOnlineDueCents =
    opts?.outstandingOnlineDueCents ??
    inferOutstandingOnlineDueCents(reservation, opts?.payableOnlineCents);
  const offlineDueCents = computeReservationOfflineDueCents(reservation, extrasCatalog);
  const offlinePaidCents = Math.max(0, Number(d?.offlinePaidCents) || 0);
  const remainingTotalCents =
    opts?.remainingTotalCents ??
    inferRemainingTotalCents(reservation, extrasCatalog, outstandingOnlineDueCents);

  return {
    installmentPlan: reservation.installmentPlan,
    offlineDueCents,
    offlinePaidCents,
    outstandingOnlineDueCents,
    paymentLinkUrl: reservation.paymentLinkUrl,
    remainingTotalCents,
  };
}

/** Contexte paiement complet (tarif recalculé + soldes réels). */
export function buildReservationPaymentContext(
  reservation: Reservation,
  extrasCatalog: readonly Extra[],
  couponsCatalog: readonly Coupon[] = [],
  allReservations: readonly Reservation[] = [],
): ReservationPaymentVisualContext {
  const d = reservation.details;
  const offlineDueCents = computeReservationOfflineDueCents(reservation, extrasCatalog);
  const offlinePaidCents = Math.max(0, Number(d?.offlinePaidCents) || 0);

  if (!d) {
    return reservationPaymentContext(reservation, extrasCatalog);
  }

  const breakdown = computeReservationPricingBreakdown(
    reservation,
    [...extrasCatalog],
    [...couponsCatalog],
    allReservations,
  );

  if (!breakdown.ok) {
    return reservationPaymentContext(reservation, extrasCatalog);
  }

  const payableOnlineCents = Math.round(breakdown.payableOnline * 100);
  const grandTotalCents = Math.round(breakdown.final * 100);
  const storeCreditAppliedCents = Math.max(0, reservation.storeCreditAppliedCents ?? 0);
  const stripePaidCents = resolveStripePaidCents(reservation);
  const supplementPaidCents = Math.max(0, Number(d.supplementPaidCents) || 0);
  const onlinePaidBaselineCents = Math.max(0, Number(d.onlinePaidBaselineCents) || 0);
  const balance = computeReservationPaymentBalance({
    paymentCapturedAt: d.paymentCapturedAt,
    totalDueCents: reservation.totalDueCents,
    installmentPlan: reservation.installmentPlan,
    grandTotalCents,
    payableOnlineCents,
    storeCreditAppliedCents,
    stripePaidCents,
    supplementPaidCents,
    onlinePaidBaselineCents,
    offlineDueCents,
    offlinePaidCents,
  });

  return reservationPaymentContext(reservation, extrasCatalog, {
    outstandingOnlineDueCents: balance.outstandingOnlineDueCents,
    payableOnlineCents,
    remainingTotalCents: balance.remainingTotalCents,
  });
}
