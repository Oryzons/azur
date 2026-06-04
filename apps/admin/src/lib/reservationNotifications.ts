import type { StoredReservation } from '@/stores/reservations';
import { inferRefundStatus, resolveReservationStatus } from '@/lib/reservationStatus';
import type { ReservationWizardDetails } from '@/pages/calendar/reservationWizardTypes';

export type ReservationNotificationKind =
  | 'reservation_created'
  | 'reservation_updated'
  | 'reservation_paid'
  | 'reservation_contract_signed'
  | 'reservation_cancelled'
  | 'reservation_restored'
  | 'reservation_refunded'
  | 'reservation_partial_refund'
  | 'reservation_deleted';

export function diffReservationNotificationKinds(
  before: StoredReservation,
  after: StoredReservation,
): ReservationNotificationKind[] {
  const kinds: ReservationNotificationKind[] = [];
  const b = before.details;
  const a = after.details;

  if (!b?.cancelledAt && a?.cancelledAt) kinds.push('reservation_cancelled');
  else if (b?.cancelledAt && !a?.cancelledAt) kinds.push('reservation_restored');

  if (!b?.paymentCapturedAt && a?.paymentCapturedAt) kinds.push('reservation_paid');

  if (!before.rentalContractSigned && after.rentalContractSigned) {
    kinds.push('reservation_contract_signed');
  }

  const bRefLen = b?.refunds?.length ?? 0;
  const aRefLen = a?.refunds?.length ?? 0;
  if (aRefLen > bRefLen && a) {
    const refundKind = inferRefundStatus(a as ReservationWizardDetails);
    kinds.push(refundKind === 'refunded' ? 'reservation_refunded' : 'reservation_partial_refund');
  }

  const bStatus = resolveReservationStatus(b, null);
  const aStatus = resolveReservationStatus(a, null);
  if (bStatus !== aStatus) {
    if (aStatus === 'cancelled' && !kinds.includes('reservation_cancelled')) {
      kinds.push('reservation_cancelled');
    }
    if (aStatus === 'refunded' && !kinds.includes('reservation_refunded')) {
      kinds.push('reservation_refunded');
    }
    if (aStatus === 'partially_refunded' && !kinds.includes('reservation_partial_refund')) {
      kinds.push('reservation_partial_refund');
    }
  }

  const structural =
    before.title !== after.title ||
    before.boatId !== after.boatId ||
    before.start !== after.start ||
    before.end !== after.end;
  const detailsChanged = JSON.stringify(b) !== JSON.stringify(a);
  const hasSpecific = kinds.length > 0;

  if (structural || (detailsChanged && !hasSpecific)) {
    kinds.push('reservation_updated');
  }

  return [...new Set(kinds)];
}

export function formatReservationWhen(startIso: string) {
  return new Date(startIso).toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatWhen(startIso: string) {
  return formatReservationWhen(startIso);
}

export function buildReservationNotification(
  kind: ReservationNotificationKind,
  reservation: StoredReservation,
  boatName: string,
): { title: string; message: string } {
  const client = reservation.title?.trim() || 'Client';
  const when = formatWhen(reservation.start);
  const boat = boatName || 'Bateau';

  switch (kind) {
    case 'reservation_created':
      return {
        title: 'Nouvelle réservation',
        message: `${client} — ${boat}, ${when}`,
      };
    case 'reservation_updated':
      return {
        title: 'Réservation modifiée',
        message: `${client} — ${boat}, ${when}`,
      };
    case 'reservation_paid':
      return {
        title: 'Paiement encaissé',
        message: `${client} — ${boat}`,
      };
    case 'reservation_contract_signed':
      return {
        title: 'Contrat signé',
        message: `${client} — ${boat}`,
      };
    case 'reservation_cancelled':
      return {
        title: 'Réservation annulée',
        message: `${client} — ${boat}, ${when}`,
      };
    case 'reservation_restored':
      return {
        title: 'Réservation rétablie',
        message: `${client} — ${boat}, ${when}`,
      };
    case 'reservation_refunded':
      return {
        title: 'Réservation remboursée',
        message: `${client} — ${boat}`,
      };
    case 'reservation_partial_refund':
      return {
        title: 'Remboursement partiel',
        message: `${client} — ${boat}`,
      };
    case 'reservation_deleted':
      return {
        title: 'Réservation supprimée',
        message: `${client} — ${boat}`,
      };
  }
}
