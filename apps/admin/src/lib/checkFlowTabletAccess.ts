import type { CheckFlowKind, TabletReservationRow } from '@/stores/checkFlow';

/** Jours après le départ (check-in) ou le retour (check-out) pour encore soumettre le formulaire. */
export const CHECK_FLOW_SUBMIT_GRACE_DAYS = 2;

export type TabletFlowAccessMode = 'submit' | 'done_today' | 'view' | 'expired';

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

  return { mode: 'submit' };
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
  });
}
