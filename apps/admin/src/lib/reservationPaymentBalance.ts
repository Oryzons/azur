import {
  installmentPlanCollectedCents,
  resolveOnlinePaymentBalance,
  resolveReservationCollectedTotalCents,
  resolveReservationPaidBalance,
  resolveStripeGrossPaidCents,
  type InstallmentPlanItemView,
} from '@bleu-calanque/shared';
import type { Reservation } from '@/pages/calendar/reservationTypes';

export type ReservationPaymentBalance = {
  /** Montant déjà réglé (CB, TPE, espèces, virement, avoir client). */
  paidTotalCents: number;
  /** Part en ligne déjà réglée hors avoir (Stripe, TPE, etc.). */
  paidOnlineCents: number;
  remainingOnlineCents: number;
  /** Reste à payer = total TTC − payé. */
  remainingTotalCents: number;
  outstandingOnlineDueCents: number;
};

export function computeReservationPaymentBalance(input: {
  paymentCapturedAt?: string | null;
  totalDueCents?: number | null;
  installmentPlan?: readonly InstallmentPlanItemView[];
  grandTotalCents: number;
  payableOnlineCents: number;
  storeCreditAppliedCents?: number;
  stripePaidCents?: number;
  supplementPaidCents?: number;
  onlinePaidBaselineCents?: number;
  offlineDueCents?: number;
  offlinePaidCents?: number;
}): ReservationPaymentBalance {
  const plan = input.installmentPlan ?? [];
  const grandTotalCents = Math.max(0, input.grandTotalCents);
  const payableOnlineCents = Math.max(0, input.payableOnlineCents);
  const storeCreditAppliedCents = Math.max(0, input.storeCreditAppliedCents ?? 0);
  const stripePaidCents = Math.max(0, input.stripePaidCents ?? 0);
  const supplementPaidCents = Math.max(0, input.supplementPaidCents ?? 0);
  const onlinePaidBaselineCents = Math.max(0, input.onlinePaidBaselineCents ?? 0);
  const offlineDueCents = Math.max(0, input.offlineDueCents ?? 0);
  const offlinePaidCents = Math.min(
    offlineDueCents,
    Math.max(0, input.offlinePaidCents ?? 0),
  );

  if (plan.length >= 2) {
    const paidOnlineCents = installmentPlanCollectedCents(plan);
    const paidTotalCents = resolveReservationCollectedTotalCents({
      grandTotalCents,
      payableOnlineCents,
      settledOnlineCents: paidOnlineCents + storeCreditAppliedCents,
      offlineDueCents,
      offlinePaidCents,
    });
    const remainingOnlineCents = plan
      .filter((p) => p.status !== 'PAID')
      .reduce((sum, p) => sum + (p.amountCents ?? 0), 0);
    const offlineRemaining = Math.max(0, offlineDueCents - offlinePaidCents);
    return {
      paidTotalCents,
      paidOnlineCents,
      remainingOnlineCents,
      remainingTotalCents: remainingOnlineCents + offlineRemaining,
      outstandingOnlineDueCents: remainingOnlineCents,
    };
  }

  if (!input.paymentCapturedAt) {
    const online = resolveOnlinePaymentBalance({
      paymentCapturedAt: input.paymentCapturedAt,
      totalDueCents: input.totalDueCents,
      payableOnlineCents,
      storeCreditAppliedCents,
      stripePaidCents,
      supplementPaidCents,
    });
    const paidTotalCents = resolveReservationCollectedTotalCents({
      grandTotalCents,
      payableOnlineCents,
      settledOnlineCents: 0,
      offlineDueCents,
      offlinePaidCents,
    });
    const offlineRemaining = Math.max(0, offlineDueCents - offlinePaidCents);
    return {
      paidTotalCents,
      paidOnlineCents: 0,
      remainingOnlineCents: online.outstandingOnlineDueCents,
      remainingTotalCents: online.outstandingOnlineDueCents + offlineRemaining,
      outstandingOnlineDueCents: online.outstandingOnlineDueCents,
    };
  }

  const balance = resolveReservationPaidBalance({
    paymentCapturedAt: input.paymentCapturedAt,
    totalDueCents: input.totalDueCents,
    payableOnlineCents,
    grandTotalCents,
    storeCreditAppliedCents,
    stripePaidCents,
    supplementPaidCents,
    onlinePaidBaselineCents,
    offlineDueCents,
    offlinePaidCents,
  });

  return {
    paidTotalCents: balance.paidTotalCents,
    paidOnlineCents: balance.paidOnlineCents,
    remainingOnlineCents: balance.outstandingOnlineDueCents,
    remainingTotalCents: balance.remainingTotalCents,
    outstandingOnlineDueCents: balance.outstandingOnlineDueCents,
  };
}

/** Infère un supplément en ligne en attente sans recalcul tarifaire complet. */
export function inferOutstandingOnlineDueCents(
  reservation: Reservation,
  payableOnlineCents?: number | null,
): number {
  const d = reservation.details;
  if (!d?.paymentCapturedAt) return 0;
  const plan = reservation.installmentPlan ?? [];
  if (plan.length >= 2) {
    return plan
      .filter((p) => p.status !== 'PAID')
      .reduce((sum, p) => sum + (p.amountCents ?? 0), 0);
  }

  const storedDue = Math.max(0, reservation.totalDueCents ?? 0);
  if (storedDue >= 50 && (payableOnlineCents == null || payableOnlineCents < 1)) {
    return storedDue;
  }

  const payable = Math.max(0, payableOnlineCents ?? 0);
  const storeCredit = Math.max(0, reservation.storeCreditAppliedCents ?? 0);
  const stripePaid = resolveStripePaidCents(reservation);
  const supplementPaid = Math.max(0, Number(d?.supplementPaidCents) || 0);
  const onlinePaidBaseline = Math.max(0, Number(d?.onlinePaidBaselineCents) || 0);

  return resolveReservationPaidBalance({
    paymentCapturedAt: d.paymentCapturedAt,
    totalDueCents: reservation.totalDueCents,
    payableOnlineCents: payable,
    grandTotalCents: payable,
    storeCreditAppliedCents: storeCredit,
    stripePaidCents: stripePaid,
    supplementPaidCents: supplementPaid,
    onlinePaidBaselineCents: onlinePaidBaseline,
  }).outstandingOnlineDueCents;
}

export function resolveStripePaidCents(input: {
  stripeNetCents?: number | null;
  stripeFeeCents?: number | null;
}): number {
  return resolveStripeGrossPaidCents(input);
}
