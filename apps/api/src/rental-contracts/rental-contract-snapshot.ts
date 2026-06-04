import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { parseReservationContractFields } from './rental-contract-field-resolvers';

const reservationSnapshotInclude = {
  boat: { select: { id: true, name: true, detailsJson: true } },
  extras: { select: { extraId: true, quantity: true }, orderBy: { extraId: 'asc' as const } },
} satisfies Prisma.ReservationInclude;

export type ReservationContractSnapshotSource = Prisma.ReservationGetPayload<{
  include: typeof reservationSnapshotInclude;
}>;

/** Données de réservation figées dans le contrat (hors signatures et modèle CGV). */
export function buildReservationContractSnapshot(
  reservation: ReservationContractSnapshotSource,
): Record<string, unknown> {
  const contractFields = parseReservationContractFields(reservation.detailsJson);
  return {
    boatId: reservation.boatId,
    boatName: reservation.boat.name,
    boatDetailsJson: reservation.boat.detailsJson,
    startAt: reservation.startAt.toISOString(),
    endAt: reservation.endAt.toISOString(),
    clientFirstName: reservation.clientFirstName,
    clientLastName: reservation.clientLastName,
    clientEmail: reservation.clientEmail,
    clientPhone: reservation.clientPhone,
    civility: reservation.civility,
    clientCountry: reservation.clientCountry,
    clientAddress: reservation.clientAddress,
    clientPostalCode: reservation.clientPostalCode,
    clientCity: reservation.clientCity,
    passengerCount: reservation.passengerCount,
    hasChildren: reservation.hasChildren,
    childrenCount: reservation.childrenCount,
    rentalPriceCents: reservation.rentalPriceCents,
    detailsJson: reservation.detailsJson,
    contractFields,
    extras: reservation.extras.map((e) => ({ extraId: e.extraId, quantity: e.quantity })),
  };
}

export function hashReservationContractSnapshot(snapshot: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(snapshot), 'utf8').digest('hex');
}

export { reservationSnapshotInclude };
