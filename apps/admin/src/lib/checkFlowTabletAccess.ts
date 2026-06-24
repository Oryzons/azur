import {
  CHECK_FLOW_SUBMIT_GRACE_DAYS,
  computeTabletFlowAccess,
  isReservationEligibleForCheckFlow,
  type CheckFlowPaymentContext,
  type TabletFlowAccess,
  type TabletFlowAccessMode,
} from '@bleu-calanque/shared';
import type { CheckFlowKind, TabletReservationRow } from '@/stores/checkFlow';

export {
  CHECK_FLOW_SUBMIT_GRACE_DAYS,
  computeTabletFlowAccess,
  isReservationEligibleForCheckFlow,
  type CheckFlowPaymentContext,
  type TabletFlowAccess,
  type TabletFlowAccessMode,
};

export function paymentContextFromTabletRow(
  reservation: TabletReservationRow,
): CheckFlowPaymentContext {
  return {
    status: reservation.status,
    cancelledAt: reservation.cancelledAt,
    paymentCapturedAt: reservation.paymentCapturedAt,
    installmentPlan: reservation.installmentPlan,
  };
}

export function tabletFlowAccessForReservation(
  reservation: TabletReservationRow,
  kind: CheckFlowKind,
): TabletFlowAccess {
  const sub = reservation.checkFlowSubmissions.find((s) => s.kind === kind) ?? null;
  return computeTabletFlowAccess({
    kind,
    reservationStartAt: reservation.startAt,
    reservationEndAt: reservation.endAt,
    submission: sub ? { id: sub.id, submittedAt: sub.submittedAt } : null,
    payment: paymentContextFromTabletRow(reservation),
  });
}
