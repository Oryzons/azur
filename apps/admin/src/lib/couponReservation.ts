import type { Reservation } from '@/pages/calendar/reservationTypes';
import { resolveReservationStatus, statusToApi } from '@/lib/reservationStatus';
import type { CouponCountableReservation } from '@bleu-calanque/shared';

export function reservationToCouponCountable(r: Reservation): CouponCountableReservation | null {
  const d = r.details;
  if (!d) return null;
  const status = resolveReservationStatus(d);
  return {
    id: r.id,
    couponCode: d.couponCode,
    clientMemberId: d.linkedMemberId,
    clientEmail: d.clientEmail,
    startAt: r.start,
    endAt: r.end,
    status: statusToApi(status),
    cancelledAt: d.cancelledAt,
    paymentCapturedAt: d.paymentCapturedAt,
  };
}

export function reservationsToCouponCountables(reservations: readonly Reservation[]): CouponCountableReservation[] {
  return reservations
    .map(reservationToCouponCountable)
    .filter((row): row is CouponCountableReservation => row != null);
}

export function couponClientFromKey(clientKey: string): {
  clientMemberId?: string | null;
  clientEmail?: string | null;
} {
  if (clientKey.includes('@')) {
    return { clientEmail: clientKey };
  }
  return { clientMemberId: clientKey };
}
