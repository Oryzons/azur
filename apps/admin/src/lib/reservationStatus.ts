import type { ReservationWizardDetails } from '@/pages/calendar/reservationWizardTypes';
import {
  hasPartialInstallmentPayment,
  isInstallmentPlanFullyPaid,
  isMultiInstallmentPlan,
  shouldShowPartialPaymentVisual,
  type InstallmentPlanItemView,
} from '@bleu-calanque/shared';

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
  partial_payment: '#D97706',
  paid: '#16A34A',
  cancelled: '#DC2626',
  refunded: '#4F46E5',
  partially_refunded: '#C026D3',
} as const;

export const CALENDAR_STATUS_LEGEND: { label: string; color: string }[] = [
  { label: 'En attente de paiement', color: CALENDAR_STATUS_COLORS.pending_payment },
  { label: 'Réservée', color: CALENDAR_STATUS_COLORS.reserved },
  { label: 'Payée partiellement', color: CALENDAR_STATUS_COLORS.partial_payment },
  { label: 'Payée', color: CALENDAR_STATUS_COLORS.paid },
  { label: 'Annulée', color: CALENDAR_STATUS_COLORS.cancelled },
  { label: 'Remboursée', color: CALENDAR_STATUS_COLORS.refunded },
  { label: 'Remb. partiel', color: CALENDAR_STATUS_COLORS.partially_refunded },
];

export type ReservationPaymentVisualContext = {
  installmentPlan?: readonly InstallmentPlanItemView[];
  /** Extras / montants à régler sur place (centimes). */
  offlineDueCents?: number;
};

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

export function isReservationFullyPaid(
  ctx: ReservationPaymentVisualContext,
  details?: Partial<ReservationWizardDetails> | null,
): boolean {
  if (shouldShowPartialPaymentVisual({
    paymentCapturedAt: details?.paymentCapturedAt,
    installmentPlan: ctx.installmentPlan,
    offlineDueCents: ctx.offlineDueCents,
  })) {
    return false;
  }
  const plan = ctx.installmentPlan ?? [];
  if (isMultiInstallmentPlan(plan)) return isInstallmentPlanFullyPaid(plan);
  return Boolean(details?.paymentCapturedAt);
}

/** Réservation annulée (créneau libéré), indépendamment d’un éventuel remboursement. */
export function hasReservationCancellation(
  details?: Partial<ReservationWizardDetails> | null,
): boolean {
  return Boolean(details?.cancelledAt) || details?.status === 'cancelled';
}

/** Libellé affiché (distingue réservée / payée partiellement / payée). */
export function statusDisplayLabel(
  status: ReservationStatus,
  details?: Partial<ReservationWizardDetails> | null,
  ctx: ReservationPaymentVisualContext = {},
): string {
  if (hasReservationCancellation(details)) {
    if (status === 'refunded') return 'Annulée · remboursée';
    if (status === 'partially_refunded') return 'Annulée · remb. partiel';
    return 'Annulée';
  }
  if (status === 'reserved_paid') {
    const partial = shouldShowPartialPaymentVisual({
      paymentCapturedAt: details?.paymentCapturedAt,
      installmentPlan: ctx.installmentPlan,
      offlineDueCents: ctx.offlineDueCents,
    });
    const plan = ctx.installmentPlan ?? [];
    if (isMultiInstallmentPlan(plan)) {
      if (isInstallmentPlanFullyPaid(plan)) return partial ? 'Payée partiellement' : 'Payée';
      if (hasPartialInstallmentPayment(plan)) return 'Payée partiellement';
      return 'Réservée';
    }
    if (partial) return 'Payée partiellement';
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
  ctx: ReservationPaymentVisualContext = {},
): string {
  if (hasReservationCancellation(details)) {
    if (status === 'refunded') return 'text-indigo-900 bg-indigo-50 ring-1 ring-red-200/60';
    if (status === 'partially_refunded') return 'text-fuchsia-900 bg-fuchsia-50 ring-1 ring-red-200/60';
    return BADGE_CLASS.cancelled;
  }
  if (status === 'reserved_paid') {
    const partial = shouldShowPartialPaymentVisual({
      paymentCapturedAt: details?.paymentCapturedAt,
      installmentPlan: ctx.installmentPlan,
      offlineDueCents: ctx.offlineDueCents,
    });
    const plan = ctx.installmentPlan ?? [];
    if (isMultiInstallmentPlan(plan)) {
      if (isInstallmentPlanFullyPaid(plan)) {
        return partial ? 'text-amber-800 bg-amber-50' : 'text-emerald-800 bg-emerald-50';
      }
      if (hasPartialInstallmentPayment(plan)) return 'text-amber-800 bg-amber-50';
      return 'text-blue-800 bg-blue-50';
    }
    if (partial) return 'text-amber-800 bg-amber-50';
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
  if (fromApi === 'refunded' || fromApi === 'partially_refunded') return fromApi;
  if (fromApi === 'cancelled' || details?.status === 'cancelled' || details?.cancelledAt) {
    return 'cancelled';
  }
  if (fromApi) return fromApi;
  if (details?.status === 'refunded' || details?.status === 'partially_refunded') {
    return details.status;
  }
  const refundStatus = details ? inferRefundStatus(details as ReservationWizardDetails) : null;
  if (refundStatus) return refundStatus;
  if (details?.status) return details.status;
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
  installmentPlan?: readonly InstallmentPlanItemView[];
  offlineDueCents?: number;
}): string {
  const details = reservation.details;
  const status = resolveReservationStatus(details);
  if (hasReservationCancellation(details)) {
    if (status === 'refunded') return CALENDAR_STATUS_COLORS.refunded;
    if (status === 'partially_refunded') return CALENDAR_STATUS_COLORS.partially_refunded;
    return CALENDAR_STATUS_COLORS.cancelled;
  }
  const plan = reservation.installmentPlan ?? [];

  switch (status) {
    case 'pending_payment':
      return CALENDAR_STATUS_COLORS.pending_payment;
    case 'reserved_paid': {
      const partial = shouldShowPartialPaymentVisual({
        paymentCapturedAt: details?.paymentCapturedAt,
        installmentPlan: plan,
        offlineDueCents: reservation.offlineDueCents,
      });
      if (isMultiInstallmentPlan(plan)) {
        if (isInstallmentPlanFullyPaid(plan)) {
          return partial ? CALENDAR_STATUS_COLORS.partial_payment : CALENDAR_STATUS_COLORS.paid;
        }
        if (hasPartialInstallmentPayment(plan)) return CALENDAR_STATUS_COLORS.partial_payment;
        return CALENDAR_STATUS_COLORS.reserved;
      }
      if (partial) return CALENDAR_STATUS_COLORS.partial_payment;
      return details?.paymentCapturedAt ? CALENDAR_STATUS_COLORS.paid : CALENDAR_STATUS_COLORS.reserved;
    }
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
  return hasReservationCancellation(details);
}

/** Rétablissement possible uniquement pour une annulation sans remboursement. */
export function canRestoreReservation(
  details: Partial<ReservationWizardDetails> | null | undefined,
  status?: ReservationStatus | null,
): boolean {
  if (!hasReservationCancellation(details)) return false;
  const resolved = status ?? resolveReservationStatus(details);
  if (resolved === 'refunded' || resolved === 'partially_refunded') return false;
  const refunds = Array.isArray(details?.refunds) ? details.refunds : [];
  return refunds.length === 0;
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
