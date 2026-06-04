import type { ReservationWizardDetails } from '@/pages/calendar/reservationWizardTypes';

export type ReservationStatus =
  | 'pending_payment'
  | 'reserved_paid'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded';

export const RESERVATION_STATUSES: { value: ReservationStatus; label: string }[] = [
  { value: 'pending_payment', label: 'En attente de paiement' },
  { value: 'reserved_paid', label: 'Réservée / payée' },
  { value: 'cancelled', label: 'Annulée' },
  { value: 'refunded', label: 'Remboursée' },
  { value: 'partially_refunded', label: 'Remboursée partiellement' },
];

/** Couleurs des blocs sur le calendrier (par statut visuel). */
export const CALENDAR_STATUS_COLORS = {
  pending_payment: '#FDBA74',
  reserved: '#2563EB',
  paid: '#16A34A',
  cancelled: '#DC2626',
  refunded: '#4F46E5',
  partially_refunded: '#C026D3',
} as const;

export const CALENDAR_STATUS_LEGEND: { label: string; color: string }[] = [
  { label: 'En attente de paiement', color: CALENDAR_STATUS_COLORS.pending_payment },
  { label: 'Réservée', color: CALENDAR_STATUS_COLORS.reserved },
  { label: 'Payée', color: CALENDAR_STATUS_COLORS.paid },
  { label: 'Annulée', color: CALENDAR_STATUS_COLORS.cancelled },
  { label: 'Remboursée', color: CALENDAR_STATUS_COLORS.refunded },
  { label: 'Remb. partiel', color: CALENDAR_STATUS_COLORS.partially_refunded },
];

const API_TO_STATUS: Record<string, ReservationStatus> = {
  PENDING_PAYMENT: 'pending_payment',
  RESERVED_PAID: 'reserved_paid',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
};

const STATUS_TO_API: Record<ReservationStatus, string> = {
  pending_payment: 'PENDING_PAYMENT',
  reserved_paid: 'RESERVED_PAID',
  cancelled: 'CANCELLED',
  refunded: 'REFUNDED',
  partially_refunded: 'PARTIALLY_REFUNDED',
};

const BADGE_CLASS: Record<Exclude<ReservationStatus, 'reserved_paid'>, string> = {
  pending_payment: 'text-orange-700 bg-orange-100',
  cancelled: 'text-red-700 bg-red-50',
  refunded: 'text-indigo-800 bg-indigo-50',
  partially_refunded: 'text-fuchsia-800 bg-fuchsia-50',
};

export function statusLabel(status: ReservationStatus): string {
  return RESERVATION_STATUSES.find((s) => s.value === status)?.label ?? status;
}

/** Libellé affiché (distingue réservée / payée). */
export function statusDisplayLabel(
  status: ReservationStatus,
  details?: Partial<ReservationWizardDetails> | null,
): string {
  if (status === 'reserved_paid') {
    return details?.paymentCapturedAt ? 'Payée' : 'Réservée';
  }
  return statusLabel(status);
}

export function statusFromApi(api: string | null | undefined): ReservationStatus | null {
  if (!api) return null;
  return API_TO_STATUS[api] ?? null;
}

export function statusToApi(status: ReservationStatus): string {
  return STATUS_TO_API[status];
}

export function statusBadgeClass(
  status: ReservationStatus,
  details?: Partial<ReservationWizardDetails> | null,
): string {
  if (status === 'reserved_paid') {
    return details?.paymentCapturedAt ? 'text-emerald-800 bg-emerald-50' : 'text-blue-800 bg-blue-50';
  }
  return BADGE_CLASS[status];
}

export function parseEurosToNumber(v: string | null | undefined): number {
  if (!v?.trim()) return 0;
  const n = Number(v.replaceAll(',', '.').trim());
  return Number.isFinite(n) ? n : 0;
}

export function inferRefundStatus(
  details: Pick<ReservationWizardDetails, 'refunds' | 'rentalPrice'>,
): 'refunded' | 'partially_refunded' | null {
  const refunds = Array.isArray(details.refunds) ? details.refunds : [];
  if (!refunds.length) return null;
  const refunded = refunds.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const rental = parseEurosToNumber(details.rentalPrice);
  if (rental > 0 && refunded >= rental - 0.01) return 'refunded';
  return 'partially_refunded';
}

export function resolveReservationStatus(
  details: Partial<ReservationWizardDetails> | null | undefined,
  apiStatus?: string | null,
): ReservationStatus {
  const fromApi = statusFromApi(apiStatus);
  if (fromApi === 'cancelled' || details?.status === 'cancelled' || details?.cancelledAt) {
    return 'cancelled';
  }
  if (fromApi) return fromApi;
  if (details?.status) return details.status;
  const refundStatus = details ? inferRefundStatus(details as ReservationWizardDetails) : null;
  if (refundStatus) return refundStatus;
  if (details?.paymentCapturedAt) return 'reserved_paid';
  return 'pending_payment';
}

/** Applique les champs dérivés (cancelledAt) quand le statut change. */
export function syncStatusFields(patch: Partial<ReservationWizardDetails>): Partial<ReservationWizardDetails> {
  const next = { ...patch };
  if (next.status === 'cancelled') {
    next.cancelledAt = next.cancelledAt ?? new Date().toISOString();
  } else if (next.status !== undefined) {
    next.cancelledAt = null;
  }
  if (next.cancelledAt && next.status === undefined) {
    next.status = 'cancelled';
  }
  return next;
}

export function statusAfterPaymentCaptured(): Partial<ReservationWizardDetails> {
  return syncStatusFields({
    paymentCapturedAt: new Date().toISOString(),
    status: 'reserved_paid',
  });
}

export function statusAfterRefund(details: ReservationWizardDetails): ReservationStatus {
  const refundStatus = inferRefundStatus(details);
  if (refundStatus) return refundStatus;
  return details.status ?? 'reserved_paid';
}

export function reservationPillColor(reservation: {
  details?: Partial<ReservationWizardDetails> | null;
}): string {
  const details = reservation.details;
  if (isReservationCancelled(details)) {
    return CALENDAR_STATUS_COLORS.cancelled;
  }
  const status = resolveReservationStatus(details);

  switch (status) {
    case 'pending_payment':
      return CALENDAR_STATUS_COLORS.pending_payment;
    case 'reserved_paid':
      return details?.paymentCapturedAt ? CALENDAR_STATUS_COLORS.paid : CALENDAR_STATUS_COLORS.reserved;
    case 'cancelled':
      return CALENDAR_STATUS_COLORS.cancelled;
    case 'refunded':
      return CALENDAR_STATUS_COLORS.refunded;
    case 'partially_refunded':
      return CALENDAR_STATUS_COLORS.partially_refunded;
    default:
      return CALENDAR_STATUS_COLORS.reserved;
  }
}

export function isReservationCancelled(details: Partial<ReservationWizardDetails> | null | undefined): boolean {
  return resolveReservationStatus(details) === 'cancelled';
}

/** Statuts où la couleur de statut doit rester visible (pas de grayscale « terminé »). */
export function isReservationTerminalVisualStatus(status: ReservationStatus): boolean {
  return status === 'refunded' || status === 'partially_refunded' || status === 'cancelled';
}

export function reservationTerminalVisualStatus(
  reservation: { details?: Partial<ReservationWizardDetails> | null },
): ReservationStatus | null {
  const status = resolveReservationStatus(reservation.details);
  return isReservationTerminalVisualStatus(status) ? status : null;
}

/** Texte du bloc calendrier (clair sur fond orange pâle). */
export function reservationPillTextColor(details?: Partial<ReservationWizardDetails> | null): string {
  return resolveReservationStatus(details) === 'pending_payment' ? '#9A3412' : '#FFFFFF';
}
