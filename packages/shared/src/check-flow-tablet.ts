import type { CheckFlowKind } from './enums';
import {
  hasPartialInstallmentPayment,
  isInstallmentPlanFullyPaid,
  isMultiInstallmentPlan,
  type InstallmentPlanItemView,
} from './payment-installments';

/** Jours après le départ (check-in) ou le retour (check-out) pour encore soumettre le formulaire. */
export const CHECK_FLOW_SUBMIT_GRACE_DAYS = 2;

export type TabletFlowAccessMode =
  | 'submit'
  | 'done_today'
  | 'view'
  | 'expired'
  | 'payment_required';

export type CheckFlowPaymentContext = {
  status?: string | null;
  cancelledAt?: string | Date | null;
  paymentCapturedAt?: string | Date | null;
  installmentPlan?: readonly InstallmentPlanItemView[];
};

function hasCapturedOnlinePayment(paymentCapturedAt?: string | Date | null): boolean {
  if (!paymentCapturedAt) return false;
  const t =
    paymentCapturedAt instanceof Date
      ? paymentCapturedAt.getTime()
      : new Date(paymentCapturedAt).getTime();
  return Number.isFinite(t);
}

/** Check-in/out autorisé uniquement si la réservation est payée ou payée partiellement. */
export function isReservationEligibleForCheckFlow(ctx: CheckFlowPaymentContext): boolean {
  const status = (ctx.status ?? '').toUpperCase();
  if (ctx.cancelledAt) return false;
  if (status === 'PENDING_PAYMENT' || status === 'CANCELLED') return false;
  if (status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED') return false;

  const plan = ctx.installmentPlan ?? [];
  if (isMultiInstallmentPlan(plan)) {
    return hasPartialInstallmentPayment(plan) || isInstallmentPlanFullyPaid(plan);
  }

  return hasCapturedOnlinePayment(ctx.paymentCapturedAt);
}

export type TabletFlowAccess = {
  mode: TabletFlowAccessMode;
  submissionId?: string;
};

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function endOfGraceDay(ref: Date, graceDays: number): Date {
  const deadline = new Date(ref);
  deadline.setDate(deadline.getDate() + graceDays);
  deadline.setHours(23, 59, 59, 999);
  return deadline;
}

export function computeTabletFlowAccess(params: {
  kind: CheckFlowKind;
  reservationStartAt: Date | string;
  reservationEndAt: Date | string;
  submission: { id: string; submittedAt?: Date | string } | null;
  now?: Date;
  graceDays?: number;
  payment?: CheckFlowPaymentContext;
}): TabletFlowAccess {
  const now = params.now ?? new Date();
  const graceDays = params.graceDays ?? CHECK_FLOW_SUBMIT_GRACE_DAYS;

  if (params.submission) {
    const submittedAt = params.submission.submittedAt
      ? new Date(params.submission.submittedAt)
      : now;
    if (isSameCalendarDay(submittedAt, now)) {
      return { mode: 'done_today', submissionId: params.submission.id };
    }
    return { mode: 'view', submissionId: params.submission.id };
  }

  const ref =
    params.kind === 'CHECK_IN'
      ? new Date(params.reservationStartAt)
      : new Date(params.reservationEndAt);

  if (now > endOfGraceDay(ref, graceDays)) {
    return { mode: 'expired' };
  }

  if (params.payment && !isReservationEligibleForCheckFlow(params.payment)) {
    return { mode: 'payment_required' };
  }

  return { mode: 'submit' };
}
