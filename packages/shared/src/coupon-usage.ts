import { seasonYearForAprilSeptember } from './coupon-season';
import { isReservationPastEnd } from './reservation-lock';

function normalizeReservationStatus(status?: string | null): string {
  return (status ?? '').toUpperCase();
}

/**
 * La réservation ne doit plus compter dans le palier / journal coupon
 * (annulation, avoir, remboursement total, ou annulation + remboursement).
 */
export function isReservationVoidedForCoupon(
  status?: string | null,
  cancelledAt?: Date | string | null,
): boolean {
  if (cancelledAt) return true;
  const s = normalizeReservationStatus(status);
  return s === 'CANCELLED' || s === 'REFUNDED';
}

export type CouponCountableReservation = {
  id?: string;
  createdAt?: Date | string | null;
  couponCode?: string | null;
  clientMemberId?: string | null;
  clientEmail?: string | null;
  startAt: Date | string;
  endAt: Date | string;
  status?: string | null;
  cancelledAt?: Date | string | null;
  paymentCapturedAt?: Date | string | null;
};

export type CouponTierEvaluationContext = {
  /** Réservation existante : position figée via id / createdAt (API, fiche détail). */
  reservationId?: string;
  evaluationCreatedAt?: Date | string | null;
};

export function couponClientKey(r: {
  clientMemberId?: string | null;
  clientEmail?: string | null;
}): string {
  return r.clientMemberId?.trim() || r.clientEmail?.trim().toLowerCase() || '';
}

export function isSameCouponClientKey(
  a: { clientMemberId?: string | null; clientEmail?: string | null },
  b: { clientMemberId?: string | null; clientEmail?: string | null },
): boolean {
  const idA = a.clientMemberId?.trim();
  const idB = b.clientMemberId?.trim();
  if (idA && idB && idA === idB) return true;
  const emailA = a.clientEmail?.trim().toLowerCase();
  const emailB = b.clientEmail?.trim().toLowerCase();
  if (emailA && emailB && emailA === emailB) return true;
  const keyA = couponClientKey(a);
  const keyB = couponClientKey(b);
  return keyA !== '' && keyA === keyB;
}

/** Réservation payée / confirmée, éligible au palier coupon (sans exiger que le créneau soit passé). */
export function countsTowardCouponTier(
  row: Pick<CouponCountableReservation, 'status' | 'cancelledAt' | 'paymentCapturedAt'>,
): boolean {
  if (isReservationVoidedForCoupon(row.status, row.cancelledAt)) return false;
  if (row.paymentCapturedAt) return true;
  return normalizeReservationStatus(row.status) === 'RESERVED_PAID';
}

/**
 * Compte une utilisation coupon uniquement si la location est terminée (créneau passé),
 * payée, et non annulée / remboursée (journal Airbus, exports).
 */
export function countsTowardCouponUsage(
  row: Pick<CouponCountableReservation, 'status' | 'cancelledAt' | 'endAt' | 'paymentCapturedAt'>,
  asOf: Date = new Date(),
): boolean {
  if (!countsTowardCouponTier(row)) return false;
  return isReservationPastEnd(row.endAt, asOf);
}

function toEpochMs(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function couponReservationOrderKey(
  r: Pick<CouponCountableReservation, 'startAt' | 'createdAt' | 'id'>,
): [number, number, string] {
  return [toEpochMs(r.startAt), toEpochMs(r.createdAt), r.id ?? ''];
}

function compareCouponReservationOrder(a: [number, number, string], b: [number, number, string]): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2].localeCompare(b[2]);
}

function evaluationAnchorKey(
  evaluationDate: Date,
  reservations: readonly CouponCountableReservation[],
  context?: CouponTierEvaluationContext,
): [number, number, string] {
  const startMs = evaluationDate.getTime();
  if (context?.reservationId) {
    const self = reservations.find((r) => r.id === context.reservationId);
    if (self) return couponReservationOrderKey(self);
    return [
      startMs,
      toEpochMs(context.evaluationCreatedAt),
      context.reservationId,
    ];
  }
  // Nouvelle réservation : après toutes les existantes au même créneau.
  return [startMs, Number.MAX_SAFE_INTEGER, '\uffff'];
}

/**
 * Utilisations payées strictement avant la réservation évaluée (même saison, même client).
 * La 4e utilisation de la saison reçoit le palier dégradé (ex. 20 % au lieu de 50 %),
 * même si les 3 premières ne sont pas encore terminées.
 */
export function countPriorSeasonCountableCouponUses(
  reservations: readonly CouponCountableReservation[],
  couponCode: string,
  client: { clientMemberId?: string | null; clientEmail?: string | null },
  evaluationDate: Date,
  context?: CouponTierEvaluationContext,
): number {
  const code = couponCode.trim().replaceAll(/\s+/g, '').toUpperCase();
  const seasonY = seasonYearForAprilSeptember(evaluationDate);
  const anchor = evaluationAnchorKey(evaluationDate, reservations, context);

  return reservations.filter((r) => {
    if (context?.reservationId && r.id === context.reservationId) return false;
    if ((r.couponCode ?? '').trim().replaceAll(/\s+/g, '').toUpperCase() !== code) return false;
    if (!isSameCouponClientKey(r, client)) return false;
    if (!countsTowardCouponTier(r)) return false;
    const start = r.startAt instanceof Date ? r.startAt : new Date(r.startAt);
    if (seasonY != null && seasonYearForAprilSeptember(start) !== seasonY) return false;
    return compareCouponReservationOrder(couponReservationOrderKey(r), anchor) < 0;
  }).length;
}
