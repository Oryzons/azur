import {
  getReservationLockMessage,
  isReservationLocked,
  isReservationPaid,
  isReservationPastEnd,
  type ReservationLockContext,
} from '../../../../packages/shared/src/reservation-lock';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import type { ReservationWizardDetails } from '@/pages/calendar/reservationWizardTypes';
import { resolveReservationStatus } from '@/lib/reservationStatus';

export type { ReservationLockContext };
export {
  getReservationLockMessage,
  isReservationLocked,
  isReservationPaid,
  isReservationPastEnd,
};

export function reservationLockContext(
  reservation: Pick<Reservation, 'end' | 'checkInDone' | 'checkOutDone'> & {
    details?: Partial<ReservationWizardDetails> | null;
  },
): ReservationLockContext {
  const details = reservation.details;
  return {
    endAt: reservation.end,
    paymentCapturedAt: details?.paymentCapturedAt ?? null,
    adminStatus: details?.status ?? (details ? resolveReservationStatus(details) : null),
    checkInDone: Boolean(reservation.checkInDone),
    checkOutDone: Boolean(reservation.checkOutDone),
  };
}

export function isReservationLockedFromReservation(
  reservation: Pick<Reservation, 'end' | 'checkInDone' | 'checkOutDone'> & {
    details?: Partial<ReservationWizardDetails> | null;
  },
): boolean {
  return isReservationLocked(reservationLockContext(reservation));
}

export function getReservationLockMessageFromReservation(
  reservation: Pick<Reservation, 'end' | 'checkInDone' | 'checkOutDone'> & {
    details?: Partial<ReservationWizardDetails> | null;
  },
): string | null {
  return getReservationLockMessage(reservationLockContext(reservation));
}
