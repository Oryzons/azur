import type { Reservation } from '@/pages/calendar/reservationTypes';
import { reservationPaymentContext } from '@/lib/reservationOfflineDue';
import type { Extra } from '@/stores/extras';
import type { Boat } from '@/stores/boats';
import { BOAT_TYPES_UI } from '@/stores/boats';
import {
  isReservationCancelled,
  isReservationFullyPaid,
  resolveReservationStatus,
  statusBadgeClass,
  statusDisplayLabel,
  type ReservationStatus,
} from '@/lib/reservationStatus';

export type ReservationListFilter =
  | 'all'
  | 'upcoming'
  | 'past'
  | 'pending_payment'
  | 'paid'
  | 'cancelled';

export function reservationSearchHaystack(
  r: Reservation,
  boat: Boat | undefined,
  boatNameFallback: string,
): string {
  const typeLabel = boat
    ? (BOAT_TYPES_UI.find((x) => x.value === boat.boatType)?.label ?? boat.boatType)
    : '';
  const boatText = boat
    ? `${boat.name} ${boat.brand} ${boat.model} ${typeLabel}`.toLowerCase()
    : `${boatNameFallback} ${typeLabel}`.toLowerCase();
  const d = r.details;
  const client = d
    ? `${d.clientFirstName} ${d.clientLastName} ${d.clientEmail} ${d.clientPhone ?? ''}`.toLowerCase()
    : '';
  const status = resolveReservationStatus(d);
  return `${r.title} ${boatText} ${client} ${status}`.toLowerCase();
}

/** Recherche propriétaire : bateau et période uniquement (sans données client). */
export function ownerReservationSearchHaystack(
  r: Reservation,
  boat: Boat | undefined,
  boatNameFallback: string,
): string {
  const boatText = boat
    ? `${boat.name} ${boat.brand} ${boat.model}`.toLowerCase()
    : boatNameFallback.toLowerCase();
  return `${boatText} ${reservationPeriodShort(r)}`.toLowerCase();
}

export function reservationClientLabel(r: Reservation): string | null {
  const d = r.details;
  if (!d?.clientFirstName && !d?.clientLastName) return null;
  const civ = d.civility ? `${d.civility} ` : '';
  return `${civ}${d.clientFirstName ?? ''} ${d.clientLastName ?? ''}`.trim() || null;
}

export function reservationStatusForList(r: Reservation): ReservationStatus {
  return resolveReservationStatus(r.details);
}

export function reservationStatusBadge(
  r: Reservation,
  extrasCatalog?: readonly Extra[],
): { label: string; className: string } {
  const status = reservationStatusForList(r);
  const ctx = extrasCatalog
    ? reservationPaymentContext(r, extrasCatalog)
    : { installmentPlan: r.installmentPlan };
  return {
    label: statusDisplayLabel(status, r.details, ctx),
    className: statusBadgeClass(status, r.details, ctx),
  };
}

export function matchesReservationListFilter(
  r: Reservation,
  filter: ReservationListFilter,
  now = new Date(),
): boolean {
  const status = reservationStatusForList(r);
  const upcoming = r.end.getTime() >= now.getTime();
  const past = !upcoming;

  switch (filter) {
    case 'all':
      return true;
    case 'upcoming':
      return upcoming && !isReservationCancelled(r.details);
    case 'past':
      return past;
    case 'pending_payment':
      return status === 'pending_payment' && !isReservationCancelled(r.details);
    case 'paid':
      return (
        status === 'reserved_paid' &&
        isReservationFullyPaid({ installmentPlan: r.installmentPlan }, r.details)
      );
    case 'cancelled':
      return isReservationCancelled(r.details) || status === 'cancelled';
    default:
      return true;
  }
}

export function reservationPeriodShort(r: Reservation): string {
  const dateLabel = r.start.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const start = r.start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const end = r.end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${dateLabel} · ${start} — ${end}`;
}
