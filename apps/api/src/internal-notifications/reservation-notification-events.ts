import type { InternalNotificationKind, Prisma } from '@prisma/client';

type ReservationRowWithRefunds = Prisma.ReservationGetPayload<{ include: { boat: true; refunds: true } }>;
type ReservationRowWithBoat = Prisma.ReservationGetPayload<{ include: { boat: true } }>;

export type ReservationNotificationEvent =
  | 'RESERVATION_CREATED'
  | 'RESERVATION_UPDATED'
  | 'RESERVATION_CANCELLED'
  | 'RESERVATION_RESTORED'
  | 'RESERVATION_PAID'
  | 'RESERVATION_REFUNDED'
  | 'RESERVATION_PARTIAL_REFUND'
  | 'RESERVATION_DELETED';

export function diffReservationNotificationEvents(
  before: ReservationRowWithRefunds | null,
  after: ReservationRowWithRefunds | null,
): ReservationNotificationEvent[] {
  if (!after && before) return ['RESERVATION_DELETED'];
  if (!after) return [];
  if (!before) return ['RESERVATION_CREATED'];

  const events: ReservationNotificationEvent[] = [];

  if (!before.cancelledAt && after.cancelledAt) events.push('RESERVATION_CANCELLED');
  else if (before.cancelledAt && !after.cancelledAt) events.push('RESERVATION_RESTORED');

  if (!before.paymentCapturedAt && after.paymentCapturedAt) events.push('RESERVATION_PAID');

  const bRef = before.refunds?.length ?? 0;
  const aRef = after.refunds?.length ?? 0;
  if (aRef > bRef) {
    if (after.status === 'REFUNDED') events.push('RESERVATION_REFUNDED');
    else events.push('RESERVATION_PARTIAL_REFUND');
  }

  if (before.status !== after.status) {
    if (after.status === 'CANCELLED' && !events.includes('RESERVATION_CANCELLED')) {
      events.push('RESERVATION_CANCELLED');
    }
    if (after.status === 'REFUNDED' && !events.includes('RESERVATION_REFUNDED')) {
      events.push('RESERVATION_REFUNDED');
    }
    if (after.status === 'PARTIALLY_REFUNDED' && !events.includes('RESERVATION_PARTIAL_REFUND')) {
      events.push('RESERVATION_PARTIAL_REFUND');
    }
  }

  const structural =
    before.title !== after.title ||
    before.boatId !== after.boatId ||
    before.startAt.getTime() !== after.startAt.getTime() ||
    before.endAt.getTime() !== after.endAt.getTime();
  const detailsChanged =
    before.detailsJson !== after.detailsJson ||
    before.rentalPriceCents !== after.rentalPriceCents;
  const hasSpecific = events.length > 0;

  if (structural || (detailsChanged && !hasSpecific)) {
    events.push('RESERVATION_UPDATED');
  }

  return [...new Set(events)];
}

export function eventToInternalKind(event: ReservationNotificationEvent): InternalNotificationKind {
  return event;
}

export function buildNotificationCopy(
  kind: InternalNotificationKind,
  reservation: ReservationRowWithBoat,
): { title: string; message: string } {
  const boat = reservation.boat
    ? `${reservation.boat.brand} ${reservation.boat.name}`.trim()
    : 'Bateau';
  const clientName =
    [reservation.clientFirstName, reservation.clientLastName].filter(Boolean).join(' ').trim() ||
    reservation.title?.trim() ||
    'Client';
  const when = reservation.startAt.toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const base = `${clientName} — ${boat}`;

  switch (kind) {
    case 'RESERVATION_CREATED':
      return { title: 'Nouvelle réservation', message: `${base} · ${when}` };
    case 'RESERVATION_UPDATED':
      return { title: 'Réservation modifiée', message: `${base} · ${when}` };
    case 'RESERVATION_CANCELLED':
      return { title: 'Réservation annulée', message: `${base} · ${when}` };
    case 'RESERVATION_RESTORED':
      return { title: 'Réservation rétablie', message: `${base} · ${when}` };
    case 'RESERVATION_REFUNDED':
      return { title: 'Réservation remboursée', message: base };
    case 'RESERVATION_PARTIAL_REFUND':
      return { title: 'Remboursement partiel', message: base };
    case 'RESERVATION_DELETED':
      return { title: 'Réservation supprimée', message: `${base} · ${when}` };
    case 'RESERVATION_PAID':
      return { title: 'Paiement encaissé', message: base };
    case 'RENTAL_CONTRACT_SIGNED':
      return { title: 'Contrat signé par le client', message: `${base} · signature en ligne` };
    default:
      return { title: 'Réservation', message: base };
  }
}

export type OwnerReservationNotifyPrefs = {
  ownerNotifyReservationsEnabled: boolean;
  ownerNotifyNewReservation: boolean;
  ownerNotifyReservationUpdated: boolean;
  ownerNotifyReservationCancelled: boolean;
  ownerNotifyReservationRestored: boolean;
  ownerNotifyReservationPaid: boolean;
};

export function ownerPrefsAllowReservationEvent(
  prefs: OwnerReservationNotifyPrefs,
  event: ReservationNotificationEvent,
): boolean {
  if (!prefs.ownerNotifyReservationsEnabled) return false;
  switch (event) {
    case 'RESERVATION_CREATED':
      return prefs.ownerNotifyNewReservation;
    case 'RESERVATION_UPDATED':
      return prefs.ownerNotifyReservationUpdated;
    case 'RESERVATION_CANCELLED':
      return prefs.ownerNotifyReservationCancelled;
    case 'RESERVATION_RESTORED':
      return prefs.ownerNotifyReservationRestored;
    case 'RESERVATION_PAID':
      return prefs.ownerNotifyReservationPaid;
    case 'RESERVATION_REFUNDED':
    case 'RESERVATION_PARTIAL_REFUND':
      return prefs.ownerNotifyReservationUpdated;
    case 'RESERVATION_DELETED':
      return prefs.ownerNotifyReservationCancelled;
    default:
      return false;
  }
}

export function buildOwnerReservationNotificationCopy(
  event: ReservationNotificationEvent,
  reservation: ReservationRowWithBoat,
): { title: string; message: string; kind: InternalNotificationKind } {
  const base = buildNotificationCopy(
    event === 'RESERVATION_CREATED' ? 'RESERVATION_CREATED' : eventToInternalKind(event),
    reservation,
  );
  if (event === 'RESERVATION_CREATED') {
    return {
      kind: 'RESERVATION_ON_OWNER_BOAT',
      title: 'Nouvelle réservation sur votre bateau',
      message: base.message,
    };
  }
  const kind = eventToInternalKind(event);
  const titleByEvent: Partial<Record<ReservationNotificationEvent, string>> = {
    RESERVATION_UPDATED: 'Réservation modifiée sur votre bateau',
    RESERVATION_CANCELLED: 'Réservation annulée sur votre bateau',
    RESERVATION_RESTORED: 'Réservation rétablie sur votre bateau',
    RESERVATION_PAID: 'Paiement sur votre bateau',
    RESERVATION_REFUNDED: 'Remboursement sur votre bateau',
    RESERVATION_PARTIAL_REFUND: 'Remboursement partiel sur votre bateau',
    RESERVATION_DELETED: 'Réservation supprimée sur votre bateau',
  };
  return {
    kind,
    title: titleByEvent[event] ?? base.title,
    message: base.message,
  };
}

export function settingsAllowsKind(
  settings: {
    onReservationCreated?: boolean;
    onReservationUpdated?: boolean;
    onReservationCancelled?: boolean;
    onReservationRestored?: boolean;
    onRefundCreated?: boolean;
    onReservationDeleted?: boolean;
    onPaymentCaptured?: boolean;
  } | null,
  kind: InternalNotificationKind,
): boolean {
  if (!settings) return true;
  switch (kind) {
    case 'RESERVATION_CREATED':
      return settings.onReservationCreated ?? true;
    case 'RESERVATION_UPDATED':
      return settings.onReservationUpdated ?? true;
    case 'RESERVATION_CANCELLED':
      return settings.onReservationCancelled ?? true;
    case 'RESERVATION_RESTORED':
      return settings.onReservationRestored ?? true;
    case 'RESERVATION_REFUNDED':
    case 'RESERVATION_PARTIAL_REFUND':
      return settings.onRefundCreated ?? true;
    case 'RESERVATION_DELETED':
      return settings.onReservationDeleted ?? true;
    case 'RESERVATION_PAID':
      return settings.onPaymentCaptured ?? true;
    case 'PAYMENT_ONLINE_CAPTURED':
      return settings.onPaymentCaptured ?? true;
    case 'RENTAL_CONTRACT_SIGNED':
      return settings.onReservationUpdated ?? true;
    default:
      return true;
  }
}
