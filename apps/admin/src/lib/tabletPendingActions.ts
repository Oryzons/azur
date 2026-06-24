import type { CheckFlowKind, TabletReservationRow } from '@/stores/checkFlow';
import { tabletFlowAccessForReservation } from '@/lib/checkFlowTabletAccess';

export type TabletPendingAction = {
  reservation: TabletReservationRow;
  kind: CheckFlowKind;
};

/** Actions check-in / check-out encore à faire pour une liste de réservations. */
export function listTabletPendingActions(rows: TabletReservationRow[]): TabletPendingAction[] {
  const out: TabletPendingAction[] = [];
  for (const reservation of rows) {
    const inAccess = tabletFlowAccessForReservation(reservation, 'CHECK_IN');
    if (inAccess.mode === 'submit') {
      out.push({ reservation, kind: 'CHECK_IN' });
    }
    const outAccess = tabletFlowAccessForReservation(reservation, 'CHECK_OUT');
    if (outAccess.mode === 'submit') {
      out.push({ reservation, kind: 'CHECK_OUT' });
    }
  }
  return out;
}

export function nextPendingKind(reservation: TabletReservationRow): CheckFlowKind | null {
  const inAccess = tabletFlowAccessForReservation(reservation, 'CHECK_IN');
  if (inAccess.mode === 'submit') return 'CHECK_IN';
  const outAccess = tabletFlowAccessForReservation(reservation, 'CHECK_OUT');
  if (outAccess.mode === 'submit') return 'CHECK_OUT';
  return null;
}

export function isReservationFullyValidated(reservation: TabletReservationRow): boolean {
  const inAccess = tabletFlowAccessForReservation(reservation, 'CHECK_IN');
  const outAccess = tabletFlowAccessForReservation(reservation, 'CHECK_OUT');
  const inOk = inAccess.mode === 'view' || inAccess.mode === 'done_today';
  const outOk = outAccess.mode === 'view' || outAccess.mode === 'done_today';
  return inOk && outOk;
}
